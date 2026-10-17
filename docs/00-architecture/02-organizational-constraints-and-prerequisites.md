---
title: "Step 0.1 — Prerequisites and setup"
sidebar_label: "0.1 Prerequisites and setup"
---

# Step 0.1 — Prerequisites and setup

:::info Step summary
**Goal:** a workstation that can run Terraform, kubectl and Docker against your AWS account, and an S3 bucket for Terraform state.
**Time:** about 20 minutes. **Run from:** any directory.
:::

## 1. AWS account

You need an AWS account (or a role in one) that can create VPC, EC2, EKS, IAM, EFS, ECR, S3, ELB, Route 53 and SQS resources.

Check these quotas in the region you will use (the default is `ap-northeast-1`):

| Quota | Why |
|---|---|
| Running On-Demand Standard instances (vCPU) | Infra nodes, monitoring nodes, the On-Demand part of pool 2 |
| All Standard Spot Instance Requests (vCPU) | Pools 1 and 2 |
| EC2-VPC Elastic IPs | One NAT gateway |
| VPCs per region | One new VPC |

```bash
aws service-quotas list-service-quotas --service-code ec2 \
  --query 'Quotas[?contains(QuotaName, `vCPU`)].{Name:QuotaName,Value:Value}' --output table
```

If your organization applies Service Control Policies (SCPs), confirm they allow EKS and EFS in the target region. An explicit SCP deny overrides any IAM permission.

## 2. Tools

| Tool | Version | Used for |
|---|---|---|
| AWS CLI | v2 | Credentials, ECR login, checks |
| Terraform | ≥ 1.10, < 2.0 | Infrastructure |
| kubectl | within one minor version of EKS 1.34 | Cluster access |
| Helm | v3 | cert-manager, Alloy |
| Docker with buildx | recent | Building images |
| argocd CLI | matching the server | `argocd app wait` |
| git, jq, python3, curl, openssl | any recent | Scripts and checks |

```bash
aws --version && terraform version && kubectl version --client && helm version
docker buildx version && argocd version --client && jq --version && python3 --version
```

## 3. AWS profile

Choose an AWS CLI profile that already exists on your machine. **`eks-core` is an example name, not a required or automatically created profile.** Use the same chosen name in `workshop.env`, the Terraform provider configuration, and the S3 backend configuration:

```bash
aws configure list-profiles
export AWS_PROFILE=eks-core   # example: replace with an existing profile from the list
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

If you have no configured profile, use your organization's sign-in method. For IAM Identity Center, configure it with `aws configure sso --profile "$AWS_PROFILE"`, then sign in with `aws sso login --profile "$AWS_PROFILE"` and repeat the identity check. Existing working profiles do not need to be recreated. Never put access keys into any repository.

## 4. Clone the four repositories side by side

The Terraform layers read Helm values from `../eks-core-gitops`, so keep the repositories in one parent directory.

```bash
mkdir -p ~/eks-core && cd ~/eks-core
git clone https://github.com/tranvix0910/eks-core-terraform.git
git clone https://github.com/tranvix0910/eks-core-gitops.git
git clone https://github.com/tranvix0910/eks-core-apps.git
git clone https://github.com/tranvix0910/eks-core-docs.git
```

ArgoCD deploys from a Git URL. If you will change charts or values (for example in [step 3.4](../apps-shopnow/pod-placement)), **fork `eks-core-gitops`** and use your fork's URL below.

## 5. Variables used in every step

Put these in a file such as `~/eks-core/workshop.env` and `source` it in every new terminal. **Replace the example `AWS_PROFILE=eks-core` line with the profile selected in step 3 before sourcing.** This file deliberately pins your chosen profile; exporting a different name before sourcing will not override that line.

```bash
# Where the repos live
export WORKSHOP_HOME=~/eks-core
export TF_DIR=$WORKSHOP_HOME/eks-core-terraform
export GITOPS_DIR=$WORKSHOP_HOME/eks-core-gitops
export APPS_DIR=$WORKSHOP_HOME/eks-core-apps
export PLAN_DIR=$WORKSHOP_HOME/plans          # saved Terraform plans
export EVIDENCE_DIR=$WORKSHOP_HOME/evidence   # outputs you keep as proof

# AWS
export AWS_PROFILE=eks-core                  # replace with the profile selected in step 3
export AWS_REGION=ap-northeast-1              # where the clusters run
export AWS_DEFAULT_REGION=$AWS_REGION
export STATE_REGION=ap-southeast-1            # where the Terraform state bucket lives
unset AWS_ACCOUNT_ID
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --query Account --output text); then
  unset AWS_ACCOUNT_ID
  printf 'Cannot load the AWS account. Check profile "%s" and its login.\n' "$AWS_PROFILE" >&2
  return 1   # this file must be sourced; stop before using an empty account ID
fi
export AWS_ACCOUNT_ID

# GitOps and images
export WORKSHOP_REPO_URL=https://github.com/tranvix0910/eks-core-gitops.git   # or your fork
export WORKSHOP_REVISION=main
export IMAGE_TAG=workshop-v1

mkdir -p "$PLAN_DIR" "$EVIDENCE_DIR"
```

```bash
source ~/eks-core/workshop.env && printf '%s %s\n' "$AWS_ACCOUNT_ID" "$AWS_REGION"
```

## 6. Create the Terraform state bucket

Each layer stores its state in one S3 bucket named `eks-tfstate-<account-id>`. Create it once:

```bash
AWS_REGION=$STATE_REGION bash "$TF_DIR/scripts/bootstrap-backend.sh"
aws s3api get-bucket-versioning --bucket "eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"
```

**Expected:** `"Status": "Enabled"`. The bucket blocks public access and is encrypted. Locking uses S3 lock files (`use_lockfile = true`), so no DynamoDB table is needed by the backends.

## 7. Give each layer your account values

Nothing account-specific is committed to Git. Each Terraform layer reads two local, gitignored files:

| File | Contains |
|---|---|
| `backend.hcl` | State bucket name and AWS profile for the S3 backend |
| `account.auto.tfvars` | `account_id` and `aws_profile` — the provider checks the account and uses the selected local profile |

```bash
python3 <<'PYCONFIG'
import json, os, re
from pathlib import Path
account = os.environ.get("AWS_ACCOUNT_ID", "")
profile = os.environ.get("AWS_PROFILE", "")
if not re.fullmatch(r"[0-9]{12}", account) or not profile:
    raise SystemExit("Load a valid AWS_ACCOUNT_ID and AWS_PROFILE before creating local files.")
root = Path(os.environ["TF_DIR"])
# Preflight all paths before writing anything; preserve existing local files.
for name in ("10-network", "20-cluster-workload", "21-cluster-observability"):
    layer = root / name
    if not (layer / "main.tf").is_file():
        raise SystemExit("Invalid Terraform layer: " + str(layer))
    for filename in ("backend.hcl", "account.auto.tfvars"):
        if (layer / filename).exists():
            raise SystemExit("Already exists; review/update this file instead of overwriting: " + str(layer / filename))
for name in ("10-network", "20-cluster-workload", "21-cluster-observability"):
    layer = root / name
    (layer / "backend.hcl").write_text(
        'bucket = ' + json.dumps("eks-tfstate-" + account) + '\nprofile = ' + json.dumps(profile) + '\n')
    (layer / "account.auto.tfvars").write_text(
        'account_id = ' + json.dumps(account) + '\naws_profile = ' + json.dumps(profile) + '\n')
PYCONFIG
git -C "$TF_DIR" status --short   # must not list backend.hcl or account.auto.tfvars
```

For an existing checkout, edit only the `profile` value in each `backend.hcl` and `aws_profile` in each `account.auto.tfvars`, preserving the account ID, bucket, and other settings. Local `*.auto.tfvars` override the example profile in tracked `terraform.tfvars`. After changing a previously initialized backend's profile, run `terraform -chdir="$TF_DIR/<layer>" init -reconfigure -backend-config=backend.hcl` for that layer; do not apply infrastructure merely to correct a CLI profile.

Region, CIDRs, node sizes and Kubernetes version live in each layer's `terraform.tfvars`. Change them there if you use a different region.

## Verify

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Next:** [0.2 Architecture](01-architecture-overview.md)

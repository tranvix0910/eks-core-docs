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
| AWS CLI | 2.35.24 | Credentials, ECR login, AWS checks |
| Terraform | 1.15.5 (the code requires ≥ 1.10, < 2.0) | All three infrastructure layers |
| kubectl | 1.34.11 (same minor as EKS 1.34) | Cluster access |
| Helm | 4.2.3 | cert-manager, Argo Rollouts, Alloy |
| Docker with buildx | Docker 29.5.3, buildx 0.34.1 | Building and pushing images |
| argocd CLI | 3.5.0 (matches ArgoCD chart 10.3.0) | `argocd app wait`, `sync`, `diff` |

The commands also use `git`, `jq` and `curl`, which most systems already have.

```bash
aws --version              # aws-cli/2.35.x
terraform version          # Terraform v1.15.x
kubectl version --client   # Client Version: v1.34.x
helm version --short       # v4.2.x
docker buildx version      # github.com/docker/buildx v0.34.x
argocd version --client    # argocd: v3.5.x
```

## 3. AWS profile

Choose an AWS CLI profile that already exists on your machine. **`eks-core` is an example name, not a required or automatically created profile.** Use the same chosen name in `workshop.env`, the Terraform provider configuration, and the S3 backend configuration:

```bash
aws configure list-profiles
export AWS_PROFILE=eks-core   # example: replace with an existing profile from the list
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

## 4. Clone the four repositories side by side

The Terraform layers read Helm values from `../eks-core-gitops`, so keep the repositories in one parent directory.

```bash
mkdir -p ~/eks-core && cd ~/eks-core
git clone https://github.com/tranvix0910/eks-core-terraform.git
git clone https://github.com/tranvix0910/eks-core-gitops.git
git clone https://github.com/tranvix0910/eks-core-apps.git
git clone https://github.com/tranvix0910/eks-core-docs.git
```

## 5. Variables used in every step

Put these in a file such as `~/eks-core/workshop.env` and `source` it in every new terminal. **Replace the example `AWS_PROFILE=eks-core` line with the profile selected in step 3 before sourcing.** This file deliberately pins your chosen profile; exporting a different name before sourcing will not override that line.

```bash
# Where the repos live
export WORKSHOP_HOME=~/eks-core
export TF_DIR=$WORKSHOP_HOME/eks-core-terraform
export GITOPS_DIR=$WORKSHOP_HOME/eks-core-gitops
export APPS_DIR=$WORKSHOP_HOME/eks-core-apps
export PLAN_DIR=$WORKSHOP_HOME/plans          # saved Terraform plans

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

mkdir -p "$PLAN_DIR"
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

The code in Git is the same for everyone, but your **AWS account ID** and **AWS profile** are yours. Each of the three layers reads them from two small files. Both are in `.gitignore`, so they never reach GitHub.

| File | What Terraform does with it |
|---|---|
| `backend.hcl` | `terraform init` reads it to find **where this layer's state is stored**: the S3 bucket `eks-tfstate-<account-id>`, reached with your profile. |
| `account.auto.tfvars` | `terraform plan/apply` loads it automatically. `account_id` makes the AWS provider **refuse to run against any other account** and fills `<AWS_ACCOUNT_ID>` in the Helm values; `aws_profile` chooses the credentials. |

**1. Copy the examples.** Every layer ships a `.example` of each file:

```bash
cd "$TF_DIR"
cp 10-network/backend.hcl.example                     10-network/backend.hcl
cp 10-network/account.auto.tfvars.example             10-network/account.auto.tfvars
cp 20-cluster-workload/backend.hcl.example            20-cluster-workload/backend.hcl
cp 20-cluster-workload/account.auto.tfvars.example    20-cluster-workload/account.auto.tfvars
cp 21-cluster-observability/backend.hcl.example       21-cluster-observability/backend.hcl
cp 21-cluster-observability/account.auto.tfvars.example 21-cluster-observability/account.auto.tfvars
echo "$AWS_ACCOUNT_ID $AWS_PROFILE"    # the two values to put into the files
```

**2. Edit the six files.** In each one, replace `<AWS_ACCOUNT_ID>` with your account ID and `eks-core` with your profile, the two values printed above. All three layers use the same values. With account `123456789012` and profile `eks-core` the files look like this:

```hcl title="backend.hcl"
bucket  = "eks-tfstate-123456789012"
profile = "eks-core"
```

```hcl title="account.auto.tfvars"
account_id  = "123456789012"
aws_profile = "eks-core"
```

**3. Check.**

```bash
cat "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars
grep -l '<AWS_ACCOUNT_ID>' "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars   # prints nothing
git -C "$TF_DIR" status --short                                                      # lists neither file
```

**Expected:** six files with your account ID and profile, no `<AWS_ACCOUNT_ID>` left, and `git status` shows none of them.

To change the profile later, edit `profile` in `backend.hcl` and `aws_profile` in `account.auto.tfvars`, then run `terraform -chdir="$TF_DIR/<layer>" init -reconfigure -backend-config=backend.hcl` for that layer. Nothing needs to be re-applied. Region, CIDRs, node sizes and the Kubernetes version stay in each layer's committed `terraform.tfvars`.

## Verify

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Next:** [0.2 Architecture](01-architecture-overview.md)

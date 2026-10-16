---
title: "Step 0 - Prepare tools, permissions, and Terraform state"
---

# Prepare before provisioning infrastructure

You need an AWS account allowed to create VPC, EC2, EKS, IAM, EFS, ECR, S3, ELB, and Route53 resources. The workshop creates billable resources; review quotas and account policies before the lab.

## 1. Tools and checkout

Install AWS CLI v2, Terraform 1.10 or later but below 2.0, kubectl compatible with the cluster, Helm, Docker with buildx, Git, jq, Python 3, Bash, and curl. Use an ArgoCD CLI version compatible with the server for sync/wait. Node/npm are only needed to build or view the documentation website.

```bash
bash
aws --version
terraform version
kubectl version --client
helm version
DockerVersion=$(docker version --format '{{.Client.Version}}')
printf '%s\n' "$DockerVersion"
docker buildx version
git --version
jq --version
python3 --version
```

Use a fork/branch you control when changing configuration. ArgoCD only reads pushed content; local edits that have not been pushed will not deploy.

## 2. Variables used throughout the labs

Run at the repository root:

```bash
export REPO_ROOT="$PWD"
export AWS_PROFILE=eks-core
export AWS_REGION=ap-northeast-1
export AWS_DEFAULT_REGION="$AWS_REGION"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export STATE_REGION=ap-southeast-1
export STATE_BUCKET="eks-tfstate-${AWS_ACCOUNT_ID}"
export WORKSHOP_REPO_URL="https://github.com/tranvix0910/eks-core-gitops.git"
export WORKSHOP_REVISION=main
export IMAGE_TAG=workshop-v1
mkdir -p .workshop/plans .workshop/evidence
aws sts get-caller-identity
```

Change the profile, account, URL, and revision for your environment. If credentials expire, sign in through your organization's authentication method and verify your identity again; do not put access keys in the repository. Do not store evidence containing tokens or passwords under `.workshop`.

## 3. Check environment configuration

Edit all three `terraform.tfvars` files to align `region`, `aws_profile`, `account_id`, tags, and Kubernetes version. Layer 10 also defines CIDRs/AZs; Layer 20 defines ECR/EFS settings; Layer 21 defines retention and private DNS.

Backends are hardcoded in each layer's `main.tf` and remote-state readers in `data.tf`. For a new account, update **both backend and remote-state configuration**, not just tfvars. Keep distinct keys:

| Layer | State key |
|---|---|
| `10-network` | `network/terraform.tfstate` |
| `20-cluster-workload` | `cluster-workload/terraform.tfstate` |
| `21-cluster-observability` | `cluster-observability/terraform.tfstate` |

Do not reuse the state of an existing environment whose resources you have not reviewed. `.terraform/modules/modules.json` is a cache, not the authoritative list of configured modules; run `init` after refactoring.

## 4. Bootstrap the backend

The existing script creates the S3 backend and a legacy DynamoDB table. Current backends use `use_lockfile=true`, so S3 lock files provide locking; the table created by the script has no effect unless the backend references it.

```bash
AWS_REGION="$STATE_REGION" bash scripts/bootstrap-backend.sh
aws s3api get-bucket-versioning --bucket "$STATE_BUCKET" --region "$STATE_REGION"
aws s3api get-public-access-block --bucket "$STATE_BUCKET" --region "$STATE_REGION"
```

Expect versioning `Enabled` and public access blocked. Restrict state readers because state can contain secrets even when outputs are marked `sensitive`. Do not commit `.tfplan`, `.tfstate`, `.terraform/`, `certs/key.pem`, or `.env`.

## 5. Quotas and organization policies

```bash
aws eks list-clusters --region "$AWS_REGION"
aws ec2 describe-availability-zones --region "$AWS_REGION" \
  --query 'AvailabilityZones[?State==`available`].ZoneName' --output table
aws service-quotas get-service-quota --service-code vpc --quota-code L-F678F1CE
aws ec2 describe-addresses --query 'length(Addresses)' --output text
aws service-quotas list-service-quotas --service-code ec2 \
  --query 'Quotas[?contains(QuotaName, `vCPU`)].{Name:QuotaName,Value:Value}' --output table
```

Compare the tfvars AZ list with your account. Both On-Demand and Spot vCPU quotas matter. Old instance prices or Spot availability figures are not guarantees.

The original account recorded an SCP restricting EKS/EFS regions and prohibiting Flow Log deletion. These are account-specific restrictions, not general AWS rules. `AdministratorAccess` does not override an SCP explicit deny. If destroy is blocked, work with the policy owner; do not default to `terraform state rm` to hide the failure.

`scripts/check-prereqs.sh` allocates and releases a test EIP; run it only when that operation is acceptable. Set `AWS_REGION` explicitly because the script's default still refers to the earlier environment.

## Step 0 completion gate

Your identity targets the correct account; quotas are sufficient; the backend is accessible; all layers agree on configuration; you can push Git changes; and you have a location for evidence. Next: [the network](03-layer-10-network.md).

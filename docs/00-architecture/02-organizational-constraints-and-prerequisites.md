# Organizational Constraints & Environment Preparation

This document records the AWS Organization policies (SCPs, AWS Config), resource quotas, and mandatory prerequisites required before executing any `terraform apply` on AWS account `<AWS_ACCOUNT_ID>`.

---

## 1. Organizational Constraints

### 1.1 — Service Control Policy (SCP) Region Lock
The organization enforces an immutable Service Control Policy:
* **Policy ARN**: `arn:aws:organizations::946807075264:policy/o-hn3gpvx3rg/service_control_policy/<SCP_POLICY_ID>`
* **Rule**: Explicit Deny on all `eks:*` and `elasticfilesystem:*` actions in all AWS regions worldwide **EXCEPT 3 REGIONS**:
  1. `ap-southeast-1` (Singapore)
  2. `ap-southeast-5` (Malaysia)
  3. `ap-northeast-1` (Tokyo)

> [!CAUTION]
> Local `AdministratorAccess` **CANNOT OVERRIDE** this SCP. Any attempt to create EKS clusters or EFS filesystems in regions like `us-east-1`, `ap-south-1`, or `ap-southeast-2` will fail immediately with `AccessDenied`. Modifying the SCP requires AWS Organization root admin privileges (`946807075264`).

### 1.2 — VPC Flow Logs: Mandatory & Deletion Prohibited
Two synchronized compliance rules:
1. **AWS Config Conformance Pack**: `vpc-flow-logs-enabled-conformance-pack-8bzjqtjiy` (rule `VPC_FLOW_LOGS_ENABLED`) requires all VPCs to have active Flow Logs.
2. **SCP `<SCP_POLICY_ID>`**: Explicit Deny on `ec2:DeleteFlowLogs`. No IAM principal can delete a VPC Flow Log once created.

#### Practical Implication for Terraform:
When recreating a VPC or migrating regions in Terraform:
* Terraform attempts to `Destroy` the old `aws_flow_log` resource -> Denied by SCP -> The entire `terraform apply` or `destroy` halts.
* **Standard Resolution**: Use `terraform state rm` to decouple Flow Logs from state before applying changes:
  ```bash
  terraform state rm 'module.vpc.aws_flow_log.this[0]'
  terraform state rm 'module.vpc.aws_cloudwatch_log_group.flow_log[0]'
  ```
  *(This command merely stops Terraform from tracking the old resource without calling deletion APIs on AWS).*

---

## 2. Pre-Deployment Setup

### 2.1 — AWS CLI Profile Configuration
All project workflows use the `eks-core` profile with default region `ap-northeast-1`:

```bash
# Verify caller identity
aws sts get-caller-identity --profile eks-core
# Expected Account: "<AWS_ACCOUNT_ID>"

# Set default region
aws configure set region ap-northeast-1 --profile eks-core
```

### 2.2 — Quota Verification
Before applying infrastructure, verify VPC and Elastic IP quotas in `ap-northeast-1`:

```bash
# Check maximum allowed VPCs
aws service-quotas get-service-quota \
  --service-code vpc \
  --quota-code L-F678F1CE \
  --region ap-northeast-1 \
  --profile eks-core

# Check available Elastic IPs
aws ec2 describe-addresses --region ap-northeast-1 --profile eks-core
```

### 2.3 — Bootstrap Terraform S3 Backend & DynamoDB Lock Table
Execute [scripts/bootstrap-backend.sh](https://github.com/tranvix0910/eks-core-terraform/blob/main/scripts/bootstrap-backend.sh) once to provision the state bucket and distributed locking table:

```bash
chmod +x scripts/bootstrap-backend.sh scripts/check-prereqs.sh
./scripts/check-prereqs.sh
./scripts/bootstrap-backend.sh
```

Standard backend configuration:
* **S3 Bucket**: `eks-tfstate-<AWS_ACCOUNT_ID>`
* **State Locking**: S3 native lockfile (`use_lockfile = true`), no DynamoDB table
* **Backend Region**: `ap-southeast-1` (centralized state store location, independent of target resource regions).

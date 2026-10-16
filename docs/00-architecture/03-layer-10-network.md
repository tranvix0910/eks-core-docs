---
title: "Step 1 - Create the network with Terraform"
---

# Create networking for both clusters

**Input:** preparation complete. **Output:** network state with outputs consumed by both cluster layers.

## 1. Review the files you will apply

| File | Purpose |
|---|---|
| `10-network/main.tf` | AWS provider, S3 backend, provider requirements |
| `variables.tf`, `terraform.tfvars` | Inputs and environment settings |
| `vpc.tf` | VPC, subnets, NAT, Flow Logs |
| `vpce.tf` | S3 Gateway Endpoint |
| `subnet_tags.tf` | Karpenter and load balancer discovery tags |
| `output.tf` | Output contract for Layers 20/21 |

The default example uses `10.20.0.0/16`, three `/24` public subnets, three `/20` workload subnets, and three `/20` observability subnets. The important requirements are nonoverlapping CIDRs and the correct AZ for each subnet group; the region itself is not a learning objective.

The lab uses one NAT to reduce baseline resources. If its AZ fails, egress from other AZs can be affected. The S3 Gateway Endpoint keeps S3 traffic within the VPC; it does not remove all NAT requirements for ECR APIs, chart registries, or dependency downloads.

## 2. Initialize and validate before planning

```bash
terraform -chdir=10-network init
terraform -chdir=10-network fmt -check
terraform -chdir=10-network validate
terraform -chdir=10-network plan -out="$REPO_ROOT/.workshop/plans/network.tfplan"
terraform -chdir=10-network show "$REPO_ROOT/.workshop/plans/network.tfplan"
```

Review CIDRs, AZs, NAT count, Flow Logs, and the provider account. For existing environments, inspect every replacement or destroy action and understand its cause before applying. Do not run `init -upgrade` during the workshop unless you intend to upgrade modules/providers.

## 3. Apply the saved plan

```bash
terraform -chdir=10-network apply "$REPO_ROOT/.workshop/plans/network.tfplan"
terraform -chdir=10-network output -json > .workshop/evidence/network-outputs.json
```

A saved plan corresponds to the state and configuration at planning time. Create a new plan if configuration changes or another operator updates the state afterward.

## 4. Inspect the actual network

```bash
export VPC_ID=$(terraform -chdir=10-network output -raw vpc_id)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[].{Id:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock}' --output table
aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$VPC_ID" --output json
aws ec2 describe-vpc-endpoints --filters "Name=vpc-id,Values=$VPC_ID" --output table
aws ec2 describe-flow-logs --filter "Name=resource-id,Values=$VPC_ID" --output table
```

Check tags: workload subnets use `karpenter.sh/discovery=eks-workload`; observability subnets use the second cluster's name. Public subnets have `kubernetes.io/role/elb=1`; private subnets have `kubernetes.io/role/internal-elb=1`. Do not use the same discovery value for both subnet groups.

## 5. Managing network changes

Edit tfvars → plan → review → apply. Do not rename outputs consumed through remote state. CIDR/AZ changes that replace subnets can affect downstream node groups and mount targets; plan those separately rather than continuing the workshop blindly.

**Completion gate:** VPC/subnets match the design, private subnets have required egress, Flow Logs operate, and outputs are complete. Next: [the workload cluster](04-layer-20-cluster-workload.md).

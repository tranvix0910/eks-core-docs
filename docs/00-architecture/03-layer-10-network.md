---
title: "Step 1.1 — Create the network"
sidebar_label: "1.1 Network"
---

# Step 1.1 — Create the network

:::info Step summary
**Goal:** one VPC with separate subnets for each cluster.
**Time:** about 5 minutes. **Run from:** `$TF_DIR/10-network`.
:::

## What this layer creates

| Resource | Value (from `terraform.tfvars`) |
|---|---|
| VPC | `10.20.0.0/16` across `ap-northeast-1a`, `1c`, `1d` |
| Public subnets | 3 × `/24` — load balancers, NAT |
| Workload subnets | 3 × `/20` — cluster 1 nodes and Pods |
| Observability subnets | 3 × `/20` — cluster 2 nodes and Pods |
| NAT gateway | one (`single_nat_gateway = true`) to keep the lab cheap |
| S3 gateway endpoint | S3 traffic (state, Mimir, Loki) stays inside the VPC |
| VPC Flow Logs | enabled |
| Discovery tags | `karpenter.sh/discovery=eks-workload` on workload subnets, ELB role tags on public/private subnets |

The `/20` subnets are large on purpose: with VPC CNI every Pod takes a VPC IP address.

## 1. Review the inputs

```bash
cat "$TF_DIR/10-network/terraform.tfvars"
```

Change `region`, `azs` and the CIDRs only if you deploy somewhere else. Keep the three subnet groups non-overlapping.

## 2. Plan

```bash
L=10-network
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
```

Read the plan summary. On an empty account you should see only `create` actions and no `destroy`.

## 3. Apply

```bash
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" output
```

## Verify

```bash
export VPC_ID=$(terraform -chdir="$TF_DIR/10-network" output -raw vpc_id)

aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[].{AZ:AvailabilityZone,CIDR:CidrBlock,Karpenter:Tags[?Key==`karpenter.sh/discovery`]|[0].Value}' \
  --output table
```

**Expected:**

- 9 subnets: three `/24`, three `10.20.16–48.0/20` tagged `eks-workload`, three `10.20.64–96.0/20` tagged `eks-observability`.
- `terraform output` lists `vpc_id`, `workload_node_subnet_ids` and `observability_node_subnet_ids` — the next two layers read these.

## Managing this layer later

Edit `terraform.tfvars` → plan → review → apply. Do not rename outputs; layers 20 and 21 read them. Any change that **replaces** a subnet also replaces the node groups and EFS mount targets in it, so plan that change separately.

**Next:** [1.2 Cluster 1 — Workload](04-layer-20-cluster-workload.md)

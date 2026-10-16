# Layer 10: Network & VPC (Terraform)

Comprehensive technical documentation for the network layer [10-network](https://github.com/tranvix0910/eks-core-terraform/tree/main/10-network), covering CIDR allocations, subnet topology, NAT Gateway architecture, Karpenter discovery tags, and VPC Flow Logs.

---

## 1. Overview & Scope

* **Purpose**: Provisions the shared Virtual Private Cloud (`eks-lab`) for both EKS clusters (`eks-workload` and `eks-observability`).
* **State File**: `network/terraform.tfstate` on S3 bucket `eks-tfstate-<AWS_ACCOUNT_ID>`.
* **Target Region**: `ap-northeast-1` (Tokyo).
* **Availability Zones**: `ap-northeast-1a`, `ap-northeast-1c`, `ap-northeast-1d` (Note: AWS Tokyo has no `1b` AZ).

---

## 2. Subnet IP Allocation

The VPC utilizes primary CIDR block **`10.20.0.0/16`** (total 65,536 IP addresses).

| Subnet Classification | CIDR Block | Count | AZ | Usage |
|---|---|---|---|---|
| **Public Subnets** | `10.20.0.0/24`<br>`10.20.1.0/24`<br>`10.20.2.0/24` | 3 | `1a`<br>`1c`<br>`1d` | Hosts NAT Gateway, Internet-facing ALBs (ArgoCD, Prometheus, Grafana, Frontend). |
| **Private Workload Subnets** | `10.20.16.0/20`<br>`10.20.32.0/20`<br>`10.20.48.0/20` | 3 | `1a`<br>`1c`<br>`1d` | Hosts EC2 Nodes and Pods for **`eks-workload`** (4,091 usable IPs per subnet). |
| **Private Observability Subnets** | `10.20.64.0/20`<br>`10.20.80.0/20`<br>`10.20.96.0/20` | 3 | `1a`<br>`1c`<br>`1d` | Hosts EC2 Nodes and Pods for **`eks-observability`** (4,091 usable IPs per subnet). |

```
10.20.0.0/16 (VPC eks-lab)
├── 10.20.0.0/24, 10.20.1.0/24, 10.20.2.0/24  ──> Public Subnets (NAT, Public ALBs)
├── 10.20.16.0/20, 10.20.32.0/20, 10.20.48.0/20 ─> Private Subnets (Cluster 1: Workload)
└── 10.20.64.0/20, 10.20.80.0/20, 10.20.96.0/20 ─> Private Subnets (Cluster 2: Observability)
```

---

## 3. Routing & NAT Gateway Topology

### 3.1 — Single Shared NAT Gateway
In [10-network/main.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/10-network/main.tf):
```hcl
enable_nat_gateway     = true
single_nat_gateway     = true
one_nat_gateway_per_az = false
```
* **Intentional Lab Tradeoff**: A single NAT Gateway (in Public Subnet `1a`) services all private subnets across both clusters, saving ~$65/month. All outbound Internet traffic from both clusters routes through this NAT Gateway.
* **Isolated Route Tables**: Despite sharing the VPC and NAT Gateway, route tables for Workload and Observability subnets are managed independently to ensure clean boundaries.

### 3.2 — S3 Gateway VPC Endpoint
* Enabled via `enable_s3_endpoint = true`.
* Directs all EKS node traffic destined for S3 (Mimir metrics, Loki logs, ECR image layers) over the private AWS backbone, bypassing the NAT Gateway completely and eliminating data transfer fees.

---

## 4. Karpenter & EKS Subnet Tag Discovery

Because both clusters share one VPC, **Karpenter discovery tags MUST differ per cluster**:

Defined in [10-network/subnet-tags.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/10-network/subnet-tags.tf):

```hcl
# Workload Subnets Tag
resource "aws_ec2_tag" "workload_karpenter" {
  for_each    = toset(module.vpc.private_subnets) # First 3 subnets
  resource_id = each.value
  key         = "karpenter.sh/discovery"
  value       = "eks-workload"
}

# Observability Subnets Tag
resource "aws_ec2_tag" "observability_karpenter" {
  for_each    = toset(slice(module.vpc.private_subnets, 3, 6))
  resource_id = each.value
  key         = "karpenter.sh/discovery"
  value       = "eks-observability"
}

# Tags for AWS Load Balancer Controller
# Public Subnets:      "kubernetes.io/role/elb" = "1"
# Private Subnets:     "kubernetes.io/role/internal-elb" = "1"
```

> [!WARNING]
> Applying identical discovery tags (`karpenter.sh/discovery = eks-workload`) to Observability subnets would cause Cluster 1's Karpenter to launch workload nodes into Cluster 2's network, breaking routing and security isolation.

---

## 5. VPC Flow Logs Configuration

```hcl
enable_flow_log                                 = true
create_flow_log_cloudwatch_log_group            = true
create_flow_log_cloudwatch_iam_role             = true
flow_log_cloudwatch_log_group_retention_in_days = 3
```
* Captures ALL traffic (Accept + Reject) into CloudWatch Log Group `/aws/vpc-flow-log/eks-lab`.
* Retention: **3 days** (optimal for short-term network diagnostics and cost efficiency).

---

## 6. Deployment Workflow

```bash
export AWS_PROFILE=eks-core
cd 10-network
terraform init
terraform plan
terraform apply -auto-approve
```

**Key Outputs Consumed by Layers 20 and 21**:
* `vpc_id`: The VPC ID.
* `vpc_cidr`: `10.20.0.0/16`.
* `workload_node_subnet_ids`: 3 Subnet IDs for Cluster 1.
* `observability_node_subnet_ids`: 3 Subnet IDs for Cluster 2.
* `public_subnet_ids`: 3 Subnet IDs for public load balancers.

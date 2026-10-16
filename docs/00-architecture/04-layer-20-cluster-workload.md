# Layer 20: EKS Workload Cluster (Terraform)

Comprehensive technical documentation for the workload cluster infrastructure in [20-cluster-workload](https://github.com/tranvix0910/eks-core-terraform/tree/main/20-cluster-workload), covering the EKS Control Plane, the `infra` Managed Node Group, the AWS-side Karpenter setup, EKS Pod Identity, ECR repositories, EFS storage, and the Rancher Security Group.

---

## 1. Cluster Specifications

* **Cluster Name**: `eks-workload`
* **Kubernetes Version**: `1.34`
* **Network Consumption**: Consumes outputs from `10-network` (`vpc_id`, `vpc_cidr`, `workload_node_subnet_ids`).
* **State File**: `cluster-workload/terraform.tfstate` on S3 bucket `eks-tfstate-<AWS_ACCOUNT_ID>`.

---

## 2. Base Managed Node Group: `infra`

```hcl
node_groups = {
  infra = {
    instance_types = ["t3.large"]
    capacity_type  = "ON_DEMAND"
    min_size       = 3
    max_size       = 4
    desired_size   = 3
    labels         = { role = "infra" }
    taints         = {} # INTENTIONALLY UNTAINTED
  }
}
```

### Why Node Group `infra` is Intentionally Untainted
* Consists of 3 On-Demand `t3.large` instances distributed across 3 AZs.
* Hosts critical operational controllers: **ArgoCD, Karpenter Controller, cert-manager, Rancher, Prometheus Agent, Grafana Alloy**.
* **Safety Principle**: The Karpenter Controller must NEVER run on nodes managed by Karpenter itself. If it runs on dynamic nodes, Karpenter's consolidation engine could de-provision the very node running the controller during low load, leaving nothing behind to scale the cluster back up.
* Managed by AWS EKS Managed Node Groups, ensuring baseline infrastructure resilience.

---

## 3. AWS-Side Karpenter Resources (`module.karpenter`)

Module `terraform-aws-modules/eks/aws//modules/karpenter` v21.0 provisions all AWS prerequisites:

1. **Node IAM Role**: `Karpenter-eks-workload` (configured with `node_iam_role_use_name_prefix = false` for deterministic naming). Attached with `AmazonSSMManagedInstanceCore`.
2. **SQS Interruption Queue**: Buffers Spot interruption warnings sent 2 minutes in advance.
3. **5 EventBridge Rules**:
   * Spot Interruptions (`aws.ec2` - EC2 Spot Instance Interruption Warning).
   * Rebalance Recommendations (`aws.ec2` - EC2 Instance Rebalance Recommendation).
   * State Changes (`aws.ec2` - EC2 Instance State-change Notification).
   * Health Events (`aws.health` - AWS Health Event).
   * Capacity Reservation Changes.
4. **EKS Access Entry**: Authorizes IAM Role `Karpenter-eks-workload` to join the EKS cluster (replacing the legacy `aws-auth` ConfigMap).

> [!NOTE]
> This Terraform module **ONLY PROVISIONS AWS RESOURCES**. It **DOES NOT INSTALL THE HELM CONTROLLER OR CRDS**. In-cluster Karpenter components are installed separately via GitOps.

---

## 4. EKS Pod Identity Associations

Layer 20 configures 4 EKS Pod Identity associations in namespace `kube-system`:

| Component | ServiceAccount | Policy / Module |
|---|---|---|
| **EBS CSI Driver** | `ebs-csi-controller-sa` | `attach_aws_ebs_csi_policy = true` |
| **EFS CSI Driver** | `efs-csi-controller-sa` | `attach_aws_efs_csi_policy = true` |
| **AWS Load Balancer Controller** | `aws-load-balancer-controller` | `attach_aws_lb_controller_policy = true` |
| **Karpenter Controller** | `karpenter` | Built into `module.karpenter` (`create_pod_identity_association = true`) |

---

## 5. ECR Repositories & EFS Storage

* **ECR Repositories** ([modules/ecr](https://github.com/tranvix0910/eks-core-terraform/tree/main/20-cluster-workload/modules/ecr)):
  Provisions 6 dedicated repositories for ShopNow:
  1. `shopnow/shopnow-frontend`
  2. `shopnow/shopnow-config-server`
  3. `shopnow/shopnow-discovery-server`
  4. `shopnow/shopnow-product-service`
  5. `shopnow/shopnow-shopping-cart-service`
  6. `shopnow/shopnow-user-service`
* **EFS Filesystem** ([modules/efs](https://github.com/tranvix0910/eks-core-terraform/tree/main/20-cluster-workload/modules/efs)):
  Provisions a shared Elastic File System with NFS port 2049 restricted to the `eks-workload` node security group.

---

## 6. Rancher Cross-Cluster Security Group (Circular Dependency 20 ↔ 21)

```hcl
resource "aws_security_group" "rancher_internal_alb" { ... }

resource "aws_vpc_security_group_ingress_rule" "rancher_from_cluster_observability" {
  security_group_id            = aws_security_group.rancher_internal_alb.id
  referenced_security_group_id = data.terraform_remote_state.cluster_observability.outputs.node_security_group_id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}
```

* Permits `cattle-cluster-agent` on `eks-observability` nodes to communicate back to Rancher on `eks-workload` over port 443.
* **Bootstrapping Circular Loop**: During a fresh build, temporarily comment out this rule in Layer 20, apply Layer 20 -> Apply Layer 21 -> Uncomment and re-apply Layer 20.

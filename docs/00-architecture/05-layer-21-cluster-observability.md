# Layer 21: EKS Observability Cluster (Terraform)

Comprehensive technical documentation for the observability cluster infrastructure in [21-cluster-observability](https://github.com/tranvix0910/eks-core-terraform/tree/main/21-cluster-observability), covering the EKS Control Plane, the `monitoring` Node Group, S3 storage for Mimir and Loki, 2-hop Security Groups for the Internal ALB, Route53 Private Hosted Zone, and ACM TLS Certificates.

---

## 1. Cluster Specifications

* **Cluster Name**: `eks-observability`
* **Kubernetes Version**: `1.34`
* **Network Consumption**: Reads outputs from `10-network` (`vpc_id`, `vpc_cidr`, `observability_node_subnet_ids`).
* **Node Security Group Consumption**: Reads `workload_node_security_group_id` from `20-cluster-workload`.
* **State File**: `cluster-observability/terraform.tfstate` on S3 bucket `eks-tfstate-<AWS_ACCOUNT_ID>`.

---

## 2. Base Managed Node Group: `monitoring`

```hcl
node_groups = {
  monitoring = {
    instance_types = ["t3.medium"]
    capacity_type  = "ON_DEMAND"
    min_size       = 2
    max_size       = 3
    desired_size   = 2
    labels         = { role = "monitoring" }
    taints         = {}
  }
}
```

* **High Availability (Minimum 2 Nodes)**: Ensures resilience during node upgrades, control plane maintenance, or AZ disruptions. Mimir, Loki, and Grafana remain fully operational on the surviving node.

---

## 3. S3 Storage & EKS Pod Identity for Mimir & Loki

Layer 21 provisions 2 dedicated S3 Buckets:
1. `eks-observability-mimir-<AWS_ACCOUNT_ID>`: Stores Mimir TSDB metric blocks.
2. `eks-observability-loki-<AWS_ACCOUNT_ID>`: Stores Loki log chunks.

### S3 Bucket Configuration:
* **Versioning**: Enabled.
* **Public Access Block**: All 4 public access blocking controls enabled.
* **Lifecycle Policy**: Automated expiration after **30 days** (cost-optimized retention).
* **Encryption**: SSE-S3 (AES256).

### EKS Pod Identity Associations:
* `mimir-sa` in namespace `monitoring` bound to the Mimir S3 IAM policy.
* `loki-sa` in namespace `monitoring` bound to the Loki S3 IAM policy.
* `ebs-csi-controller-sa` in namespace `kube-system` bound to the AWS EBS CSI policy.
* `aws-load-balancer-controller` in namespace `kube-system` bound to the AWS LB Controller policy.

---

## 4. 2-Hop Internal Security Group Topology

Mimir's metric write path (`remote_write` port 9009) and Loki's log write path (`log push` port 3100) are unauthenticated ingestion endpoints. They are **STRICTLY PRIVATE**, accessible only via the Internal ALB over a 2-hop Security Group path:

```
Prometheus / Alloy (eks-workload Node SG)
   │
   │  Hop 1: Cluster 1 Node SG ──> Internal ALB SG (Ports: 9009, 3100)
   ▼
Internal ALB (SG: eks-observability-internal-alb)
   │
   │  Hop 2: Internal ALB SG ──> Cluster 2 Node SG (Port: 8080, target-type: ip)
   ▼
Mimir Gateway Pods / Loki Gateway Pods
```

### Security Group Rules in `main.tf`:
1. `from_cluster_workload_mimir`: Ingress port 9009 from `workload_node_security_group_id`.
2. `from_cluster_workload_loki`: Ingress port 3100 from `workload_node_security_group_id`.
3. `observability_alb_to_targets`: Egress to `vpc_cidr` on all protocols to target Pod ENIs.
4. `node_from_observability_alb`: Ingress port 8080 on Cluster 2 node SG to receive forwarded traffic from the Internal ALB.

---

## 5. Private DNS & ACM Certificate (`dns.tf` & `tls.tf`)

* **Route53 Private Hosted Zone** (`observability.internal`):
  * Attached directly to VPC `10.20.0.0/16`.
  * 2 Alias A-records pointing to the Internal ALB:
    * `mimir.observability.internal` -> Internal ALB.
    * `loki.observability.internal` -> Internal ALB.
* **ACM Certificate Import** ([tls.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/21-cluster-observability/tls.tf)):
  * Imports cert-manager signed certificates (`certs/cert.pem`, `key.pem`, `chain.pem`) into AWS ACM for the Internal ALB HTTPS listeners.

> [!NOTE]
> During a fresh bootstrap, `dns.tf` and `tls.tf` must be commented out initially because the Internal ALB and certificate files are generated only after GitOps deploys the AWS LB Controller, Ingress, and cert-manager.

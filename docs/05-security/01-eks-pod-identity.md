# EKS Pod Identity Architecture & Implementation

Comprehensive technical guide on **EKS Pod Identity**, comparing it with legacy IRSA, explaining the `eks-pod-identity-agent` mechanism, and detailing IAM role associations across both clusters.

---

## 1. Why EKS Pod Identity Over IRSA

| Feature | Legacy IRSA (IAM Roles for Service Accounts) | Modern EKS Pod Identity |
|---|---|---|
| **OIDC Provider** | Required per EKS cluster | **Not Required** |
| **Trust Policy** | Complex JSON with OIDC sub/aud matching | Standard EKS service principal: `pods.eks.amazonaws.com` |
| **ServiceAccount** | Must add annotation `eks.amazonaws.com/role-arn` | **Zero annotations required** |
| **Cross-Cluster IAM** | Separate IAM role per cluster OIDC | 1 IAM role can be reused across multiple clusters |
| **Credential Injection** | Mutating Webhook + STS AssumeRoleWithWebIdentity | Node-local DaemonSet `eks-pod-identity-agent` |

---

## 2. Pod Identity Architecture & Mechanics

```
Pod (e.g. AWS LB Controller / Mimir)
  │
  ▼ (AWS SDK calls local link: http://169.254.170.23/v1/credentials)
eks-pod-identity-agent DaemonSet (running on node)
  │
  ▼ (Authenticates Pod token via EKS Control Plane)
AWS EKS Pod Identity Service
  │
  ▼ (Assumes configured IAM Role via STS)
Temporary AWS IAM Credentials returned to Pod (15m - 1h TTL)
```

---

## 3. Directory of IAM Associations in the Platform

* **`eks-workload`**:
  * EBS CSI Driver -> `ebs-csi-controller-sa`
  * EFS CSI Driver -> `efs-csi-controller-sa`
  * AWS Load Balancer Controller -> `aws-load-balancer-controller`
  * Karpenter Controller -> `karpenter`
* **`eks-observability`**:
  * EBS CSI Driver -> `ebs-csi-controller-sa`
  * AWS Load Balancer Controller -> `aws-load-balancer-controller`
  * Mimir -> `mimir`
  * Loki -> `loki`

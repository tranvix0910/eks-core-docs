# Karpenter Architecture: Two Halves (AWS Infrastructure vs In-Cluster Helm)

Deep-dive guide detailing the separation of responsibilities between Terraform and GitOps for **Karpenter v1.14.0** on Kubernetes 1.34, resolving the `no matches for kind "EC2NodeClass"` error, and explaining why the controller must reside in `kube-system`.

---

## 1. Division of Responsibilities: The Two Halves

Karpenter operates across two distinct planes:

```
┌────────────────────────────────────────────────────────┐
│ 1. AWS INFRASTRUCTURE HALF (Terraform Layer 20)        │
│    - IAM Role: Karpenter-eks-workload                  │
│    - IAM Policies: AmazonSSMManagedInstanceCore        │
│    - SQS Queue: Karpenter Interruption Buffer          │
│    - 5 EventBridge Rules (Spot Interruption, Rebalance)│
│    - EKS Pod Identity Association                      │
│    - EKS Access Entry for Karpenter Nodes              │
└───────────────────────────┬────────────────────────────┘
                            │ Hands over IAM & SQS
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. IN-CLUSTER KUBERNETES HALF (GitOps / Helm)          │
│    - Karpenter Controller Deployment (v1.14.0)         │
│    - Custom Resource Definitions (CRDs):               │
│        * ec2nodeclasses.karpenter.k8s.aws              │
│        * nodepools.karpenter.sh                        │
│        * nodeclaims.karpenter.sh                       │
│    - Manifests: EC2NodeClass & 4 NodePools             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Resolving `no matches for kind "EC2NodeClass"`

A frequent error during fresh bootstraps occurs when applying NodePool manifests before installing the Helm chart:
`error: unable to recognize "ec2nodeclass.yaml": no matches for kind "EC2NodeClass" in version "karpenter.k8s.aws/v1"`.

* **Root Cause**: Terraform's `module.karpenter` provisions AWS cloud objects only. It does not touch Kubernetes API schemas.
* **Resolution**: The Karpenter Helm chart must be installed first (`helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter --version 1.14.0`) to register the CRDs with the API Server before applying YAML manifests.

---

## 3. Why Karpenter Resides in Namespace `kube-system`

Karpenter Controller is installed explicitly in namespace **`kube-system`**:
1. **Pod Identity Compatibility**: Terraform's `module.karpenter` defaults the Pod Identity association to ServiceAccount `kube-system/karpenter`.
2. **System Precedence**: Prevents accidental deletion during application namespace cleanups.
3. **Core Infrastructure Role**: Placed on `infra` managed nodes alongside CoreDNS, kube-proxy, and AWS VPC CNI.

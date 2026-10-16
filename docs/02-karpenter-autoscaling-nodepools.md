# Karpenter — Controller, NodePool & Autoscaling on `eks-workload`

> Overview document covering cluster autoscaling with Karpenter v1.14.0 on Kubernetes 1.34.
> For deep-dive technical guides, see the [docs/02-karpenter/](https://github.com/tranvix0910/eks-core-docs/tree/main/docs/02-karpenter) directory.

---

## Karpenter Topic Index

1. [Karpenter Architecture: Two Distinct Halves (AWS Infra vs In-Cluster Helm)](02-karpenter/01-karpenter-two-halves-architecture.md)
   - Division of responsibility between Terraform and Helm.
   - Solving `no matches for kind "EC2NodeClass"`.
   - Compatibility matrix: Kubernetes 1.34 & Karpenter 1.14.0.
   - Mandatory installation in `kube-system` namespace.

2. [Configuring EC2NodeClass & 4 NodePools](02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md)
   - `EC2NodeClass` configuration (AMI alias AL2023, IMDSv2, EBS gp3 30Gi).
   - 4 NodePool definitions: `ms-od`, `ms-spot`, `batch-spot`, `arm64`.
   - Distinguishing between Taints and NodeSelectors.

3. [1:3 On-Demand:Spot Ratio & Limits.CPU Bug Analysis](02-karpenter/03-on-demand-spot-ratio-and-limits.md)
   - Pairing 2 NodePools with identical labels for a 1:3 ratio.
   - Analysis of `limits.cpu` discrepancies across documents (2 vs 24 vs 72).
   - Fixing the 1 vCPU (`medium`) node leak.

4. [Disruption Policy & Spot Interruption Handling](02-karpenter/04-disruption-and-spot-interruption.md)
   - Consolidation mechanism (`WhenEmptyOrUnderutilized`).
   - Node expiration policy `expireAfter: 720h`.
   - Handling Spot Interruption events via SQS and 5 EventBridge rules in 2 minutes.

---

## Operational Status

* **Controller**: Running 2/2 healthy replicas across 2 separate `infra` nodes in `kube-system`.
* **EC2NodeClass `default`**: Condition `Ready: True`, discovering 3 subnets in 3 Tokyo AZs (`ap-northeast-1a`, `1c`, `1d`) and 1 security group.
* **NodePools**: `ms-od` and `ms-spot` operational, ready to scale compute dynamically for ShopNow microservices.

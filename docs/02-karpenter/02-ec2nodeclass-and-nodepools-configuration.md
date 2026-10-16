# Configuring EC2NodeClass & 4 Karpenter NodePools

Technical reference guide for `EC2NodeClass` (Amazon Linux 2023, IMDSv2, EBS storage) and the 4 dedicated `NodePool` definitions in [platform/nodepools/](https://github.com/tranvix0910/eks-core-gitops/tree/main/platform/nodepools).

---

## 1. `EC2NodeClass` Configuration (`ec2nodeclass.yaml`)

Defines AWS-specific compute configurations:

```yaml
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiFamily: AL2023 # Amazon Linux 2023 (Containerd native, EKS 1.34 optimized)
  role: Karpenter-eks-workload # IAM Role created by Terraform
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: "eks-workload"
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: "eks-workload"
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 30Gi
        volumeType: gp3
        encrypted: true
  metadataOptions:
    httpEndpoint: enabled
    httpProtocolIPv6: disabled
    httpPutResponseHopLimit: 1
    httpTokens: required # Enforces IMDSv2 strictly
```

---

## 2. Directory of 4 Dedicated NodePools

| File | NodePool Name | Capacity Type | Taint Applied | Target Workload |
|---|---|---|---|---|
| `nodepool-2-ondemand.yaml` | `ms-od` | On-Demand | `workload=microservices:NoSchedule` | ShopNow Microservices Baseline (SLA floor) |
| `nodepool-2-spot.yaml` | `ms-spot` | Spot | `workload=microservices:NoSchedule` | ShopNow Microservices Scaling |
| `nodepool-1-spot.yaml` | `batch-spot` | Spot Only | `workload=batch:NoSchedule` | Batch Jobs, Async Workers |
| `nodepool-3-arm64.yaml` | `arm64` | Spot / On-Demand | `arch=arm64:NoSchedule` | ARM64 / Graviton Workloads |

---

## 3. Taints vs NodeSelectors

* **`nodeSelector`**: Directs a Pod to schedule on nodes with specific labels. However, it does NOT prevent other arbitrary Pods from landing on those nodes.
* **`taint`**: Protects the NodePool by actively repelling any Pod that lacks a matching `toleration`.
* **Standard Platform Policy**: All specialized NodePools (`ms-od`, `ms-spot`, `batch-spot`, `arm64`) require both matching `nodeSelector` and matching `toleration` in workload manifests.

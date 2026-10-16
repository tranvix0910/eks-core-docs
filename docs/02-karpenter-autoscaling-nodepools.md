---
title: "Karpenter - The three node groups in the assignment"
---

# From Pod resource requirements to EC2 nodes

Karpenter provisions EC2 capacity when no suitable node can host a Pod, then removes excess capacity according to policy. You declare **workload placement constraints**, rather than a fixed machine list.

| Assignment group | Kubernetes object | Workload |
|---|---|---|
| 1. Spot | `batch-spot` | Spot/batch test |
| 2. Mixed On-Demand and Spot | `ms-od` + `ms-spot` | ShopNow backends and EFS/availability tests |
| 3. ARM64 | `arm64` | ARM64 image test |

The `infra` Managed Node Group is separate from the three Karpenter groups. It keeps controllers running when dynamic pools are empty.

## Lab sequence

1. [Understand AWS resources and the controller](02-karpenter/01-karpenter-two-halves-architecture.md).
2. [Apply EC2NodeClass and NodePools](02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md).
3. [Measure the 1:3 ratio and current implementation limits](02-karpenter/03-on-demand-spot-ratio-and-limits.md).
4. [Check disruption and Spot interruption handling](02-karpenter/04-disruption-and-spot-interruption.md).
5. [Run an ARM64 container](02-karpenter/05-arm64-validation.md).

Creating CRDs is insufficient for acceptance. Run at least one successful Pod on each group with the correct capacity type/architecture. For the mixed pool, report both node and vCPU ratios because they can differ.

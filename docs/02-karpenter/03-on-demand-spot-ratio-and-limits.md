# 1:3 On-Demand to Spot Ratio & `limits.cpu` Bug Analysis

In-depth technical analysis on implementing an On-Demand to Spot ratio with Karpenter, analyzing the discrepancies in `limits.cpu` (2 vs 24 vs 72), and fixing 1 vCPU (`medium`) node leakage.

---

## 1. Implementing 1:3 On-Demand : Spot Ratio

Karpenter does not have a native "mixed instance ratio" parameter within a single NodePool. To achieve a **1:3 On-Demand to Spot ratio**:

1. Create **2 distinct NodePools** (`ms-od` and `ms-spot`).
2. Assign **identical node labels** (`workload: microservices`) and **identical taints** (`workload=microservices:NoSchedule`) to both.
3. Configure Karpenter **`weight`** and **`limits.cpu`**:

```
ms-od    weight: 100   limits.cpu: 24   (~25% Peak Load, On-Demand)
ms-spot  weight:  10   limits.cpu: 72   (~75% Peak Load, Spot)
```

### Execution Mechanics:
* Because `ms-od` has `weight: 100` (higher than `ms-spot`'s `weight: 10`), Karpenter prioritizes provisioning On-Demand instances first.
* Once `ms-od` consumes 24 vCPUs (reaching its hard ceiling), Karpenter automatically overflows new scheduling requests into `ms-spot` (Spot instances) up to 72 vCPUs.
* Result: 24 vCPUs On-Demand : 72 vCPUs Spot = **Exactly 1:3 Ratio**.

---

## 2. Analysis of `limits.cpu` Discrepancies (2 vs 24 vs 72)

During testing across different stages of the project, three numbers were used for `limits.cpu`:
* **`limits.cpu: 2`**: An initial lab restriction used to force Spot overflow testing with a single tiny Pod.
* **`limits.cpu: 24` (`ms-od`)**: Production sizing for the On-Demand baseline (~25% of total cluster capacity).
* **`limits.cpu: 72` (`ms-spot`)**: Sizing for the Spot expansion tier (~75% of total cluster capacity).

---

## 3. Fixing 1 vCPU (`medium`) Node Leakage

### The Bug:
When `node.kubernetes.io/instance-type` is left unrestricted or includes `t3.medium`, Karpenter occasionally selects `t3.medium` instances (2 vCPUs). Because the Kubernetes system overhead (kubelet, OS, daemonsets) reserves ~0.6 vCPUs, only ~1.4 vCPUs remain usable — insufficient to schedule multiple microservices, resulting in node fragmentation and cost waste.

### The Fix:
Constrain instance sizes to at least `large` (or `karpenter.k8s.aws/instance-cpu: "4"` or higher) in NodePool requirements:

```yaml
- key: karpenter.k8s.aws/instance-size
  operator: NotIn
  values: ["nano", "micro", "small", "medium"]
```

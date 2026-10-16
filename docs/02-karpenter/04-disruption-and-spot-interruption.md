# Disruption Policies & Spot Interruption Handling

Technical reference on Karpenter's automated node consolidation policies, node expiration lifecycles, and the EventBridge + SQS pipeline for handling Spot Interruption notices within 2 minutes.

---

## 1. Disruption & Consolidation Policies

Defined in `spec.disruption`:

```yaml
disruption:
  consolidationPolicy: WhenEmptyOrUnderutilized
  consolidateAfter: 30s
  expireAfter: 720h # 30 Days max node lifetime
```

* **`WhenEmptyOrUnderutilized`**: Karpenter actively analyzes cluster resource utilization. If workloads can be packed into fewer nodes or replaced with cheaper instance types, Karpenter provisions the replacement node, drains the old node safely, and terminates it.
* **`expireAfter: 720h`**: Forces a 30-day node rotation to continuously refresh AMI security patches and kernel updates.

---

## 2. Spot Interruption Pipeline (2-Minute Buffer)

When AWS needs to reclaim Spot capacity, EC2 emits an **EC2 Spot Instance Interruption Warning** exactly **2 minutes** before termination.

```
AWS EC2 Spot Interruption (2-minute warning)
   │
   ▼
Amazon EventBridge Rule (aws.ec2)
   │
   ▼
Amazon SQS Queue (Karpenter Interruption Queue)
   │
   ▼
Karpenter Controller (Polls SQS via IAM permissions)
   │
   ├── 1. Marks node unschedulable (cordon)
   ├── 2. Provisions replacement node immediately
   └── 3. Safely drains Pods (respecting PodDisruptionBudgets)
```

---

## 3. Disruption Controls & Safeguards

To prevent Karpenter from terminating nodes running stateful or critical workloads:
* Add annotation to Pod: `karpenter.sh/do-not-disrupt: "true"`.
* Configure `PodDisruptionBudget` (PDB) to guarantee minimum available replicas.

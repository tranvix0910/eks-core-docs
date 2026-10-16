---
title: "Consolidation, Spot interruption, and availability limits"
---

# Understand why a node is replaced

Karpenter can consolidate empty/underutilized nodes, replace drifted nodes, or handle interruptions. These are distinct paths, rather than a single generic autoscaling event.

## 1. Inspect current policy

```bash
kubectl --context eks-workload get nodepool ms-od ms-spot batch-spot arm64 -o yaml
kubectl --context eks-workload get nodeclaims
kubectl --context eks-workload -n kube-system logs deployment/karpenter --since=10m
```

Pools define `expireAfter`, `consolidationPolicy`, `consolidateAfter`, and disruption budgets. A NodePool budget limits certain Karpenter disruption operations; a PDB limits voluntary Pod eviction. They are different budgets.

## 2. Check the interruption pipeline

```bash
export WORKSHOP_QUEUE=$(terraform -chdir=20-cluster-workload output -raw karpenter_queue_name)
aws sqs get-queue-url --queue-name "$WORKSHOP_QUEUE"
aws events list-rules --name-prefix Karpenter --output table
```

Rule names depend on the module. If the filter returns nothing, inspect Terraform state resources and compare their targets/queue policies. Do not receive/delete queue messages just to inspect them; you could consume an event intended for the controller.

Spot interruptions offer limited warning, and recovery time is not guaranteed for every workload. PDBs cannot prevent provider-initiated EC2 reclamation; replicas across failure domains and an On-Demand baseline reduce its impact.

## 3. Test consolidation safely

Use the earlier Spot/ARM64 test workload, delete its Deployment, and watch NodeClaims/nodes and controller logs. `kubectl delete node` is not a consolidation test: deleting a node object does not prove Karpenter decided to remove capacity and terminated EC2 correctly.

## 4. Test an actual interruption

Use a separate lab with AWS FIS or an organization-approved simulation mechanism, one test node in scope, and clear stop criteria. Do not target nodes holding important databases/PVs merely to collect core acceptance evidence. The [PDB lab](../04-apps-shopnow/07-availability-and-pdb.md) first tests voluntary disruption through controlled eviction.

**Report:** disruption cause, affected node, replicas before/after, measured recovery time, EFS data persistence, and observed error rate. Do not state a fixed recovery duration without measurement.

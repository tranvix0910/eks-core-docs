---
title: "Step 3.4 — Spread replicas evenly across nodes and zones"
sidebar_label: "3.4 Even distribution"
---

# Step 3.4 — Spread replicas evenly across nodes and zones

:::info Step summary
**Goal:** prove the replicas of every service are spread across different worker nodes and Availability Zones.
**Requirement:** 5. **Time:** about 10 minutes. **Run from:** `$GITOPS_DIR`.
:::

## How spreading is enforced

Every backend chart (`apps/shopnow-backend-config/*-chart/templates/deployment.yaml`) sets two **topology spread constraints** whenever `replicaCount > 1`:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    minDomains: 2
    topologyKey: topology.kubernetes.io/zone   # spread across AZs
    whenUnsatisfiable: DoNotSchedule
    nodeAffinityPolicy: Honor
    nodeTaintsPolicy: Honor
    labelSelector:
      matchLabels: { app: <service> }
    matchLabelKeys: [pod-template-hash]
  - maxSkew: 1
    minDomains: 2
    topologyKey: kubernetes.io/hostname        # spread across nodes
    whenUnsatisfiable: DoNotSchedule
    nodeAffinityPolicy: Honor
    nodeTaintsPolicy: Honor
    labelSelector:
      matchLabels: { app: <service> }
    matchLabelKeys: [pod-template-hash]
```

| Field | Effect |
|---|---|
| `maxSkew: 1` | Between any two nodes (or zones), the replica count of a service differs by at most 1 |
| `whenUnsatisfiable: DoNotSchedule` | A hard rule: a replica that would break the spread stays `Pending` instead of doubling up |
| `minDomains: 2` | Needs at least two nodes / zones; with only one, Karpenter is asked for a second |
| `nodeAffinityPolicy` / `nodeTaintsPolicy: Honor` | Only pool 2 nodes count — infra, Spot and ARM64 nodes are ignored |
| `matchLabelKeys: [pod-template-hash]` | During a rolling update, old and new Pods are counted separately |

**Why topology spread instead of Pod anti-affinity?** Required anti-affinity (`one replica per node`) needs one node per replica and stops scaling once nodes run out. Topology spread allows 3 replicas on 2 nodes as 2 + 1 and scales further, while still guaranteeing an even split. It is also cheaper for the scheduler.

Karpenter reads these constraints: when the second replica cannot be placed, it launches a node in another zone rather than leaving it Pending for long.

## 1. Placement of every service

```bash
kubectl --context eks-workload get nodes -l workload=microservices -o json \
  | jq -r '.items[] | [.metadata.name, .metadata.labels["topology.kubernetes.io/zone"]] | @tsv' > /tmp/node-zone.tsv

kubectl --context eks-workload -n shopnow get pods -o json | jq -r '.items[]
  | select(.status.phase=="Running") | [.metadata.labels.app, .spec.nodeName] | @tsv' \
| awk -F'\t' 'NR==FNR {zone[$1]=$2; next} {print $1"\t"$2"\t"zone[$2]}' /tmp/node-zone.tsv - \
| sort | column -t | tee "$EVIDENCE_DIR/placement.txt"
```

**Expected:** for every service with two replicas, the two Pods are on **different nodes** and in **different zones**. Single-replica services (Eureka, databases) appear once.

## 2. Skew per service

```bash
awk '{n[$1]++; host[$1" "$2]++} END {for (k in host) {split(k,a," "); c[a[1]]++; if (host[k]>m[a[1]]) m[a[1]]=host[k]}
     for (s in n) printf "%-36s replicas=%d nodes=%d max-per-node=%d\n", s, n[s], c[s], m[s]}' \
  "$EVIDENCE_DIR/placement.txt" | sort
```

**Expected:** `max-per-node=1` for every two-replica service.

## 3. Three replicas on the proof workload

`workshop-proof` has three replicas and the same hard hostname rule, which shows how the spread behaves when there are more replicas than nodes:

```bash
kubectl --context eks-workload get nodes -l workload=microservices --no-headers | wc -l
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof -o wide
```

With two pool 2 nodes you see 2 + 1; with three or more, one per node. No node ever holds two more replicas than another.

## If a replica stays Pending

```bash
kubectl --context eks-workload -n shopnow describe pod <pending-pod> | grep -A3 Events
```

`didn't match pod topology spread constraints` means the scheduler is protecting the spread. Check that Karpenter can launch a pool 2 node in another zone (CPU limit, Spot capacity, subnets). Do not relax the rule to `ScheduleAnyway` — that removes the guarantee the requirement asks for.

**Next:** [3.5 PodDisruptionBudget](availability-and-pdb)

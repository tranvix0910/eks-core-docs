---
title: "Step 3.5 — PodDisruptionBudget and availability"
sidebar_label: "3.5 PodDisruptionBudget"
---

# Step 3.5 — PodDisruptionBudget and availability

:::info Step summary
**Goal:** prove the PodDisruptionBudget blocks an eviction that would hurt availability, allows one that would not, and that the API keeps answering during a node-style eviction.
**Requirement:** 6. **Time:** about 20 minutes. **Run from:** `$GITOPS_DIR`.
:::

## What a PDB does

A PodDisruptionBudget limits **voluntary evictions** — `kubectl drain`, node upgrades, Karpenter consolidation. Before evicting a Pod, Kubernetes checks the budget; if the eviction would leave too few healthy Pods, it is refused with HTTP 429.

| Workload | PDB | With 2 Ready replicas |
|---|---|---|
| Each backend (except Eureka) | `maxUnavailable: 1` | one Pod may be evicted at a time |
| `workshop-proof` (3 replicas) | `minAvailable: 2` | one eviction allowed; none if a Pod is already unready |

A PDB does **not** stop a direct `kubectl delete pod`, a node crash, or a Spot reclaim. Availability against those comes from multiple replicas spread over nodes and zones ([step 3.4](pod-placement)).

```bash
kubectl --context eks-workload -n shopnow get pdb
```

**Expected:** one PDB per backend (except Eureka) with `ALLOWED DISRUPTIONS 1`, and `workshop-proof` with `MIN AVAILABLE 2`.

## 1. An eviction is refused when the budget is 0

Make one `workshop-proof` Pod unready (its readiness probe checks a file on EFS), so only two of three are healthy and the budget drops to 0:

```bash
P=(kubectl --context eks-workload -n shopnow)
HOLD=$("${P[@]}" get pods -l app=workshop-proof -o jsonpath='{.items[0].metadata.name}')
"${P[@]}" exec "$HOLD" -- sh -c 'mv "/data/$HOSTNAME" "/data/$HOSTNAME.hold"'
"${P[@]}" wait "pod/$HOLD" --for=condition=Ready=false --timeout=2m
"${P[@]}" get pdb workshop-proof          # ALLOWED DISRUPTIONS 0
```

Now ask the API to evict a **different**, healthy Pod — exactly what `kubectl drain` does:

```bash
VICTIM=$("${P[@]}" get pods -l app=workshop-proof -o json | jq -r --arg h "$HOLD" '.items[] | select(.metadata.name!=$h) | .metadata.name' | head -1)
evict() { kubectl --context eks-workload create --raw "/api/v1/namespaces/shopnow/pods/$1/eviction" -f - <<JSON
{"apiVersion":"policy/v1","kind":"Eviction","metadata":{"name":"$1","namespace":"shopnow"}}
JSON
}
evict "$VICTIM" 2>&1 | tee "$EVIDENCE_DIR/pdb-refused.txt"
```

**Expected:** `Cannot evict pod as it would violate the pod's disruption budget` (HTTP 429), and the Pod is still running.

## 2. An eviction is allowed when the budget is 1

Restore the unready Pod, wait for the budget to return to 1, and repeat:

```bash
"${P[@]}" exec "$HOLD" -- sh -c 'mv "/data/$HOSTNAME.hold" "/data/$HOSTNAME"'
"${P[@]}" wait "pod/$HOLD" --for=condition=Ready --timeout=2m
"${P[@]}" get pdb workshop-proof          # ALLOWED DISRUPTIONS 1

evict "$VICTIM" | tee "$EVIDENCE_DIR/pdb-allowed.txt"
"${P[@]}" rollout status deployment/workshop-proof --timeout=10m
"${P[@]}" get pods -l app=workshop-proof -o wide
```

**Expected:** the eviction succeeds, the Deployment creates a replacement, and three Pods are Ready again.

## 3. The API stays up during an eviction

Keep the gateway port-forward running (`svc/shopnow-api-gateway-service 5860:5860`). In one terminal, poll the API:

```bash
for i in $(seq 1 90); do
  printf '%s %s\n' "$(date -u +%T)" "$(curl -s -o /dev/null -m 3 -w '%{http_code}' http://localhost:5860/product)"
  sleep 1
done | tee "$EVIDENCE_DIR/availability.txt"
```

In another terminal, evict one product Pod through the budget:

```bash
evict "$("${P[@]}" get pods -l app=shopnow-product-service -o jsonpath='{.items[0].metadata.name}')"
```

**Expected:** the eviction is accepted (budget 1), and the poll shows `200` throughout, or at most a brief gap while the gateway refreshes its Eureka view. Count the non-200 lines and report them.

## 4. A real drain (optional)

`kubectl drain` evicts every Pod on a node through the same budgets. Try it on a pool 2 node that holds no database:

```bash
kubectl --context eks-workload get pods -n shopnow -o wide | grep <node-name>
kubectl --context eks-workload drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl --context eks-workload uncordon <node-name>
```

Drain waits whenever an eviction would break a budget, then continues as replacements become Ready.

**Next:** [4.1 Private TLS and DNS](../platform-addons/cert-manager-and-internal-tls)

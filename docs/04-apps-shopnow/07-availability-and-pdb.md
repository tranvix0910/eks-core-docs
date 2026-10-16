---
title: "Step 7c - Test PodDisruptionBudget and availability"
---

# What does a PDB protect?

A PDB limits voluntary evictions through the Eviction API, such as maintenance/drain operations. It does not prevent direct Pod deletion, EC2 reclamation, node failure, or loss of a singleton database. Availability also needs Ready replicas, distributed placement, recovery capacity, and correct application error handling.

## 1. Inspect backend PDBs

```bash
kubectl --context eks-workload -n shopnow get pdb
kubectl --context eks-workload -n shopnow describe pdb shopnow-product-service-pdb
```

The chart uses `maxUnavailable: 1` when replicaCount>1. Two Ready replicas usually allow one eviction; with only one Ready replica, the budget may be zero. `ALLOWED DISRUPTIONS` is a snapshot, not a constant.

## 2. Test eviction blocking with an isolated workload

Require three Ready `workshop-proof` Pods and its `minAvailable=2` PDB. Do not deliberately break a real backend's readiness for this test.

```bash
export WORKSHOP_HOLD_POD=$(kubectl --context eks-workload -n shopnow get pods \
  -l app=workshop-proof -o jsonpath='{.items[0].metadata.name}')
kubectl --context eks-workload -n shopnow exec "$WORKSHOP_HOLD_POD" -- \
  sh -c 'mv "/data/$HOSTNAME" "/data/$HOSTNAME.readiness-hold"'
kubectl --context eks-workload -n shopnow wait "pod/$WORKSHOP_HOLD_POD" \
  --for=condition=Ready=false --timeout=1m
kubectl --context eks-workload -n shopnow get pdb workshop-proof
```

Wait for `ALLOWED DISRUPTIONS=0`. Select a different Pod for eviction:

```bash
export WORKSHOP_EVICT_POD=$(kubectl --context eks-workload -n shopnow get pods \
  -l app=workshop-proof -o json | jq -r --arg hold "$WORKSHOP_HOLD_POD" \
  '.items[] | select(.metadata.name != $hold) | .metadata.name' | head -n 1)
jq -n --arg pod "$WORKSHOP_EVICT_POD" \
  '{apiVersion:"policy/v1",kind:"Eviction",metadata:{name:$pod,namespace:"shopnow"}}' \
  > .workshop/eviction.json
kubectl --context eks-workload create \
  --raw "/api/v1/namespaces/shopnow/pods/$WORKSHOP_EVICT_POD/eviction" \
  -f .workshop/eviction.json
```

**Expected:** the API rejects the request with 429/PDB violation, and the target Pod remains. For any other response, save it and verify the PDB selector/status/RBAC; an arbitrary error does not prove PDB protection.

## 3. Restore readiness and test an allowed eviction

Always restore readiness, even if the previous result was unexpected:

```bash
kubectl --context eks-workload -n shopnow exec "$WORKSHOP_HOLD_POD" -- \
  sh -c 'mv "/data/$HOSTNAME.readiness-hold" "/data/$HOSTNAME"'
kubectl --context eks-workload -n shopnow wait "pod/$WORKSHOP_HOLD_POD" \
  --for=condition=Ready --timeout=1m
kubectl --context eks-workload -n shopnow get pdb workshop-proof
```

When the budget returns to 1 and all three Pods are Ready, submit the saved request again. It should succeed; the Deployment replaces the Pod and returns to three Ready replicas:

```bash
kubectl --context eks-workload create \
  --raw "/api/v1/namespaces/shopnow/pods/$WORKSHOP_EVICT_POD/eviction" \
  -f .workshop/eviction.json
kubectl --context eks-workload -n shopnow rollout status deployment/workshop-proof --timeout=10m
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof -o wide
```

## 4. Test API availability separately

Keep a gateway port-forward in another terminal. Record HTTP status codes while performing **one valid product Pod eviction**, with at least two product replicas Ready and its PDB permitting disruption:

```bash
for request in $(seq 1 120); do
  date -u +%FT%TZ
  curl --max-time 3 -s -o /dev/null -w '%{http_code}\n' http://localhost:5860/product
  sleep 1
done | tee .workshop/evidence/product-availability.txt
```

Select the correct product Pod and create an Eviction body using its name/namespace, following the earlier example. Proceed only when the budget allows and dependencies are healthy. Port-forward binds to a Pod and can disconnect if that gateway Pod is replaced; this test evicts product, not gateway. Record failures and recovery time rather than concluding that a PDB guarantees zero downtime.

Only attempt node drain after reviewing every Pod on the node and database/EBS impact. The basic lab does not include a cluster-wide drain command.

Reference: [Kubernetes disruptions and PDBs](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/).

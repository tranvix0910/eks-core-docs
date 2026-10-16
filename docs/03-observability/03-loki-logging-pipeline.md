---
title: "Step 4.3 — Ship logs to Loki with Alloy"
sidebar_label: "4.3 Logs → Loki"
---

# Step 4.3 — Ship logs to Loki with Alloy

:::info Step summary
**Goal:** Pod logs from every cluster 1 node queryable in Loki on cluster 2.
**Requirement:** 9. **Time:** about 15 minutes. **Run from:** `$GITOPS_DIR`.
:::

## How it is configured

Grafana **Alloy** runs as a DaemonSet — one agent per node, including Karpenter nodes. `examples/workshop/alloy-values.yaml` sets it up to:

- **tolerate every taint**, so it also runs on the Spot, mixed and ARM64 pools;
- read the node name from the Downward API and collect **only Pods on its own node** (no duplicates);
- read logs through the Kubernetes API (`loki.source.kubernetes`), so no host paths are mounted;
- add `cluster="eks-workload"`, `namespace`, `pod` and `container` labels;
- push to `https://loki.observability.internal:3100/loki/api/v1/push`, verifying the CA from step 4.1.

## 1. Install Alloy

```bash
helm repo add grafana https://grafana.github.io/helm-charts && helm repo update grafana
helm --kube-context eks-workload upgrade --install alloy grafana/alloy --version 1.11.1 \
  --namespace monitoring -f "$GITOPS_DIR/examples/workshop/alloy-values.yaml" --wait --timeout 10m
```

## 2. One agent on every node

```bash
kubectl --context eks-workload -n monitoring get daemonset alloy
kubectl --context eks-workload get nodes --no-headers | wc -l
```

**Expected:** DaemonSet `READY` equals the number of nodes.

## 3. Generate a log line to look for

`workshop-proof` (deployed in step 3.3) prints `workshop-proof <pod> <timestamp>` every 15 seconds:

```bash
kubectl --context eks-workload -n shopnow logs deployment/workshop-proof --tail=3
```

## Verify — query Loki directly

```bash
kubectl --context eks-observability -n monitoring port-forward svc/loki-gateway 13100:80   # terminal 1

START=$(( $(date +%s) - 900 ))000000000
curl -fsSG http://localhost:13100/loki/api/v1/query_range \
  --data-urlencode 'query={cluster="eks-workload", namespace="shopnow"} |= "workshop-proof"' \
  --data-urlencode "start=$START" --data-urlencode 'limit=5' \
  | jq -r '.data.result[].values[][1]' | tee "$EVIDENCE_DIR/loki-query.txt"
```

**Expected:** recent `workshop-proof …` lines with timestamps from the last few minutes.

| Symptom | Check |
|---|---|
| DaemonSet has fewer Ready Pods than nodes | `kubectl -n monitoring describe ds alloy` — tolerations, resources |
| Alloy logs `x509` | CA Secret `observability-alb-tls` in `monitoring` (step 4.1, section 5) |
| Alloy logs `no such host` | Private DNS records (step 4.1, section 4) |
| Query empty, no Alloy errors | Wait a minute; check the `cluster` label value in the query |

Loki runs with `auth_enabled: false` in this workshop, so only the private network and security groups protect it. Never expose the Loki gateway publicly.

**Next:** [4.4 Grafana](grafana-dashboards)

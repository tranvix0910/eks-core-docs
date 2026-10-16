---
title: "Collect logs on every worker with Alloy and send them to Loki"
---

# Collect the correct Pod on the correct node once

Alloy runs as a DaemonSet in cluster 1. `loki.source.kubernetes` reads logs through the Kubernetes API, **not host files** as `loki.source.file` does. The workshop configuration does not need a `/var/log/pods` mount.

## 1. Why use a separate override?

Older values tolerate only `CriticalAddonsOnly`, potentially missing mixed/batch/ARM64 nodes. A `HOSTNAME` selector can also receive the Pod name instead of the node name. The workshop override fixes both: tolerate all node taints for the agent, and inject `spec.nodeName` through Downward API as `NODE_NAME`. Discovery selects only Pods on that node.

Removing the node selector while running an unclustered DaemonSet can make multiple agents tail one stream. That creates duplication rather than reliability.

## 2. Install after the CA Secret and Loki are ready

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update grafana
helm template alloy grafana/alloy --version 1.11.1 --namespace monitoring \
  -f examples/workshop/alloy-values.yaml > .workshop/alloy-rendered.yaml
helm --kube-context eks-workload upgrade --install alloy grafana/alloy \
  --version 1.11.1 --namespace monitoring \
  -f examples/workshop/alloy-values.yaml --wait --timeout 10m
kubectl --context eks-workload -n monitoring get daemonset alloy
kubectl --context eks-workload -n monitoring get pods -l app.kubernetes.io/instance=alloy -o wide
```

Agents must cover every node whose logs are required, including Karpenter nodes. DaemonSet desired/ready counts are the first gate, not proof of Loki ingestion.

## 3. Generate test logs

`workshop-proof` emits a marker every 15 seconds. Check the source and sender:

```bash
kubectl --context eks-workload -n shopnow logs deployment/workshop-proof --tail=5
kubectl --context eks-workload -n monitoring logs -l app.kubernetes.io/instance=alloy \
  --all-containers=true --tail=30 --prefix
```

If the source Pod is missing, inspect NODE_NAME, pods/log RBAC, and discovery labels. If the source exists but push fails, inspect DNS/TLS/SGs, Loki limits, and readiness.

## 4. Query the receiver in cluster 2

```bash
kubectl --context eks-observability -n monitoring port-forward svc/loki-gateway 13100:80
```

In another terminal:

```bash
export WORKSHOP_LOG_START=$(python3 -c 'import time; print(time.time_ns()-15*60*10**9)')
curl -fsSG http://localhost:13100/loki/api/v1/query_range \
  --data-urlencode 'query={cluster="eks-workload",namespace="shopnow"} |= "workshop-proof"' \
  --data-urlencode "start=$WORKSHOP_LOG_START" --data-urlencode 'limit=20' | jq .
```

Pass when results contain a new marker with the correct Pod and namespace. Loki uses `auth_enabled=false` in this lab, so protect ingestion with private networking/SGs. Do not expose the raw Loki gateway publicly.

## 5. Storage and availability limits

SingleBinary uses one replica, replication factor 1, S3 storage, and disabled large caches to fit the lab. A receiver restart may cause an interruption; observe retries/loss rather than claiming HA because there are two worker nodes.

Reference: [Alloy loki.source.kubernetes](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.source.kubernetes/).

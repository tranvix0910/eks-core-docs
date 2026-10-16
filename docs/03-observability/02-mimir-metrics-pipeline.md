---
title: "Send Prometheus metrics to Mimir"
---

# Verify metrics hop by hop

## 1. Verify scraping before remote_write

Port-forward Prometheus in cluster 1:

```bash
kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
```

In another terminal:

```bash
curl -fsSG http://localhost:9090/api/v1/query --data-urlencode 'query=sum(up)' | jq .
kubectl --context eks-workload -n monitoring get servicemonitors,podmonitors
```

If local Prometheus has no data, fix scraping/service discovery before debugging cross-cluster networking. `serviceMonitorSelectorNilUsesHelmValues=false` allows selecting monitors outside the release, but ServiceMonitor selectors and endpoints must still be correct.

## 2. Inspect remote_write settings

Cluster 1 values define endpoint `https://mimir.observability.internal:9009/api/v1/push`, tenant header `X-Scope-OrgID: eks-workload`, a CA file, and external label `cluster=eks-workload`.

```bash
kubectl --context eks-workload -n monitoring get prometheus -o yaml
kubectl --context eks-workload -n monitoring get secret observability-alb-tls
kubectl --context eks-workload -n monitoring logs \
  prometheus-prometheus-kube-prometheus-prometheus-0 -c prometheus --tail=100
```

StatefulSet/Pod names depend on the release; inspect `get pods` if different. Look for TLS/x509, 401, 429, and dropped samples. A tenant header partitions data; it does not replace authentication or private SG access.

## 3. Query Mimir directly in cluster 2

```bash
kubectl --context eks-observability -n monitoring port-forward svc/mimir-gateway 19009:80
```

In another terminal:

```bash
curl -fsSG http://localhost:19009/prometheus/api/v1/query \
  -H 'X-Scope-OrgID: eks-workload' \
  --data-urlencode 'query=sum(up{cluster="eks-workload"})' | jq .
curl -fsSG http://localhost:19009/prometheus/api/v1/query \
  -H 'X-Scope-OrgID: eks-workload' \
  --data-urlencode 'query=count(kube_pod_info{cluster="eks-workload",namespace="shopnow"})' | jq .
```

Require `status=success` and nonempty results with values/recent timestamps. Empty results do not pass. Wait several scrape/remote_write intervals after an application starts, then compare the same query against local Prometheus.

## 4. Mimir/S3 and lab settings

Mimir uses ServiceAccount `mimir` and Pod Identity for the account's bucket. Values disable Kafka ingest storage and MinIO, enable direct push, and use replication factor 1 with zone-aware replication disabled. Do not enable Kafka or replication 3 without sufficient capacity and reviewed release configuration.

```bash
kubectl --context eks-observability -n monitoring get pods -l app.kubernetes.io/instance=mimir
kubectl --context eks-observability -n monitoring get pvc
export WORKSHOP_MIMIR_BUCKET=$(terraform -chdir=21-cluster-observability output -raw mimir_bucket_name)
aws s3api list-objects-v2 --bucket "$WORKSHOP_MIMIR_BUCKET" --max-keys 10 --query 'Contents[].Key'
```

Objects need not appear immediately after the first request; blocks flush periodically. Resolve AccessDenied/endpoint mismatches in component logs. Do not raise ingestion limits merely to hide uncontrolled cardinality growth.

## 5. Application HTTP metrics

Five Spring MVC services have the Micrometer dependency; expose `/actuator/prometheus` in effective configuration and create ServiceMonitors. The gateway currently lacks the Prometheus registry dependency. Until instrumentation is complete, use infrastructure metrics as evidence; do not relabel CPU cores as RPS.

---
title: "Step 4.2 — Ship metrics to Mimir"
sidebar_label: "4.2 Metrics → Mimir"
---

# Step 4.2 — Ship metrics to Mimir

:::info Step summary
**Goal:** cluster 1 metrics queryable in Mimir on cluster 2.
**Requirement:** 9. **Time:** about 10 minutes. **Run from:** any directory.
:::

## How it is configured

Prometheus on cluster 1 is installed by Terraform with `platform/addons/prometheus/values.yaml`. The relevant part:

```yaml
prometheus:
  prometheusSpec:
    externalLabels:
      cluster: eks-workload           # added to every series
    remoteWrite:
      - url: https://mimir.observability.internal:9009/api/v1/push
        headers:
          X-Scope-OrgID: eks-workload # Mimir tenant
        tlsConfig:
          caFile: /etc/prometheus/secrets/observability-alb-tls/ca.crt
```

Prometheus keeps scraping and storing locally as usual, and additionally streams every sample to Mimir.

## 1. Prometheus scrapes cluster 1

```bash
kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090   # terminal 1
curl -fsSG http://localhost:9090/api/v1/query --data-urlencode 'query=count(up==1)' | jq '.data.result[0].value[1]'
```

**Expected:** a number above zero. If local Prometheus has no data, fix scraping first; remote_write cannot send what was never scraped.

## 2. remote_write is healthy

```bash
curl -fsSG http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(prometheus_remote_storage_samples_total[5m])' | jq '.data.result[].value[1]'
curl -fsSG http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(prometheus_remote_storage_samples_failed_total[5m])' | jq '.data.result[].value[1]'
```

**Expected:** samples sent per second above zero, failed close to zero. Failures usually show up in the Prometheus log as `x509` (CA), `401/403` (tenant) or `429` (Mimir limits).

## Verify — query Mimir directly

```bash
kubectl --context eks-observability -n monitoring port-forward svc/mimir-gateway 19009:80   # terminal 2

curl -fsSG http://localhost:19009/prometheus/api/v1/query -H 'X-Scope-OrgID: eks-workload' \
  --data-urlencode 'query=count by (namespace) (kube_pod_info{cluster="eks-workload"})' \
  | jq -r '.data.result[] | "\(.metric.namespace) \(.value[1])"' | tee "$EVIDENCE_DIR/mimir-query.txt"
```

**Expected:** one line per cluster 1 namespace, including `shopnow`, counted from data that came through remote_write.

## 3. Data reaches S3

```bash
aws s3 ls "s3://$(terraform -chdir="$TF_DIR/21-cluster-observability" output -raw mimir_bucket_name)/" --recursive | head
```

Mimir flushes blocks to S3 every two hours, so the bucket may be empty during the first hours. `AccessDenied` in the Mimir ingester or compactor logs points at the Pod Identity association.

**Next:** [4.3 Logs → Loki](loki-logging-pipeline)

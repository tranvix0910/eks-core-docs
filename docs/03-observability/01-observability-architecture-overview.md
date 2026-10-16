---
title: "Step 8b - Verify centralized observability"
---

# From cluster 1 data to cluster 2 dashboards

This section completes the requirement to ship metrics and logs from cluster 1 to cluster 2. Installing Prometheus/Grafana in both places is insufficient; query **new** cluster 1 data from receivers in cluster 2.

## Two independent data paths

| Path | Sender in cluster 1 | Receiver in cluster 2 | Storage | Verification |
|---|---|---|---|---|
| Metrics | Prometheus scrape and remote_write | Mimir | S3 plus EBS WAL/cache | Query series labeled `cluster=eks-workload` |
| Logs | Alloy DaemonSet | Loki | S3 plus local state | Query a marker generated during this test |

Grafana in cluster 2 queries internal Mimir/Loki services. Prometheus in cluster 2 scrapes its own cluster. To view those metrics in the same UI, add a separate datasource or deliberately configure another remote_write path. Distinguish cluster 2 metrics from metrics forwarded from cluster 1.

## Lab order

1. Receiver stack Ready following the Layer 21 lab.
2. [Private TLS/DNS and CA trust](../01-platform-addons/03-cert-manager-and-internal-tls.md).
3. [Prometheus → Mimir](02-mimir-metrics-pipeline.md).
4. [Alloy → Loki](03-loki-logging-pipeline.md).
5. [Datasources, dashboards, and queries](04-grafana-dashboards.md).

## Minimum evidence

- Mimir returns `up` or kube-state/kubelet metrics labeled for cluster 1 with recent timestamps.
- The `workshop-proof` marker appears in Loki with the correct namespace/Pod/cluster, not just in `kubectl logs`.
- Senders no longer show TLS, tenant, rate-limit, or prolonged retry failures.
- Grafana in cluster 2 can query both intended datasources.

S3 is only part of the storage path. A Running receiver Pod does not prove working S3 IAM or completed data flushes. Inspect logs and buckets in the corresponding labs.

## Workshop scope

The core includes Kubernetes infrastructure metrics and container stdout/stderr. HTTP RPS/p95 require application instrumentation and a scrape endpoint; tracing requires its own SDK/collector/backend. Do not claim complete tracing/APM from a metrics-and-logs deployment. JavaMelody is a separate JVM lab in cluster 1.

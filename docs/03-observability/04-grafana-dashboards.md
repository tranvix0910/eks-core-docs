---
title: "Grafana - View and interpret centralized telemetry"
---

# Start with operational questions

You should be able to identify a service's nodes, resource consumption, restarts/errors, capacity changes, and related logs. A dashboard full of empty panels is not acceptance evidence.

## 1. Access cluster 2 Grafana

```bash
kubectl --context eks-observability -n monitoring port-forward svc/grafana 3000:80
```

Open `http://localhost:3000` and use the Secret for cluster 2's Grafana release. Do not reuse URLs/passwords recorded in older documentation.

## 2. Datasources

| Name | URL inside cluster 2 | Required configuration |
|---|---|---|
| Mimir | `http://mimir-gateway.monitoring.svc.cluster.local/prometheus` | Header `X-Scope-OrgID=eks-workload` |
| Loki | `http://loki-gateway.monitoring.svc.cluster.local` | No tenant authentication in this lab |
| Cluster 2 Prometheus, if added | `http://prometheus-kube-prometheus-prometheus.monitoring.svc:9090` | For cluster 2's own metrics |

Grafana values contain the first two. The dashboard JSON references UID `Mimir`; set `uid: Mimir` on that datasource, and `uid: Loki` if a dashboard uses it, then review/full apply Layer 21. Display names and UIDs are different fields.

Add a third datasource in the values read by Terraform, rather than only in the UI where a subsequent deployment may overwrite it.

## 3. Acceptance queries in Explore

Mimir:

```promql
sum(rate(container_cpu_usage_seconds_total{cluster="eks-workload",namespace="shopnow",container!="",container!="POD"}[5m])) by (pod)
```

```promql
sum(container_memory_working_set_bytes{cluster="eks-workload",namespace="shopnow",container!="",container!="POD"}) by (pod)
```

```promql
sum(increase(kube_pod_container_status_restarts_total{cluster="eks-workload",namespace="shopnow"}[15m])) by (pod)
```

Loki:

```logql
{cluster="eks-workload",namespace="shopnow"} |= "workshop-proof"
```

If labels are missing, inspect raw series/labels and scrape configuration. Do not remove the cluster filter merely to display a number whose origin is unclear.

## 4. Use existing dashboards carefully

The `enterprise-workload-dashboard` ConfigMap is created before Grafana full apply. After editing JSON, update the ConfigMap and confirm Grafana loads the new file; the chart/provider may require a controlled Pod restart.

Community dashboards assume specific jobs, labels, and datasource versions. Successful import does not guarantee meaningful panels. The current “Total Request Throughput” panel falls back to CPU; remove that fallback before reporting RPS. Cores and requests/second are different units.

Use HTTP RPS/error rate/latency only when applications expose those metrics and real series reach Mimir. A flat zero from `or vector(0)` may hide missing data rather than prove there are no errors.

## Evidence

Save the query, time range, datasource, result screenshot, and test timestamp. Include a new log marker and cluster 1 metrics. Do not capture credentials/tokens from datasource settings or terminals.

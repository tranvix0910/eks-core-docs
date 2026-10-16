# Centralized Observability Architecture & End-to-End Data Flow

Architecture guide detailing the telemetry data pipeline between `eks-workload` and `eks-observability`, covering metric ingestion via Grafana Mimir, log streaming via Grafana Loki, and unified visualization in Grafana Dashboards.

---

## 1. End-to-End Architecture & Data Flow

```
CLUSTER 1: eks-workload                    CLUSTER 2: eks-observability
┌──────────────────────────┐               ┌───────────────────────────────────────┐
│ Prometheus Agent         │               │ Internal ALB (Port 9009)              │
│ (remote_write HTTPS)     │──────────────>│  └──> Mimir Gateway ──> Ingester ──> S3│
└──────────────────────────┘               └───────────────────────────────────────┘
                                                           │
┌──────────────────────────┐               ┌───────────────┴───────────────────────┐
│ Grafana Alloy DaemonSet  │               │ Internal ALB (Port 3100)              │
│ (River push HTTPS)       │──────────────>│  └──> Loki Gateway  ──> Ingester ──> S3│
└──────────────────────────┘               └───────────────────────────────────────┘
                                                           │
                                                           ▼
                                           ┌───────────────────────────────────────┐
                                           │ Grafana Web UI (Public ALB Port 80)   │
                                           │ (Multi-tenant Mimir & Loki Explorer)  │
                                           └───────────────────────────────────────┘
```

---

## 2. Telemetry Volume & Verified Metrics

Real-world baseline metrics captured during cluster verification:
* **Prometheus Samples Pushed**: Over **330,000 samples** shipped to Mimir via `remote_write`.
* **Log Lines Ingested**: Over **19,000 log lines** collected by Alloy and queried in Loki.
* **Storage Retention**: All data automatically archived in S3 with a **30-day expiration lifecycle**.

---

## 3. Multi-Tenancy & Tenant Headers

Mimir requires tenant identification via HTTP header:
* In [values.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/addons/prometheus/values.yaml):
  ```yaml
  remoteWrite:
    - url: https://mimir.observability.internal:9009/api/v1/push
      headers:
        X-Scope-OrgID: "eks-workload"
  ```
* Grafana DataSource queries Mimir using header `X-Scope-OrgID: eks-workload` to isolate metrics cleanly per cluster.

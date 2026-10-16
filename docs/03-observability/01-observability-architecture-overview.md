---
title: "Step 4.0 — Centralized observability: how telemetry flows"
sidebar_label: "4.0 How telemetry flows"
---

# Step 4.0 — Centralized observability: how telemetry flows

:::info Step summary
**Goal:** understand the two paths that carry cluster 1's metrics and logs into cluster 2.
**Requirements:** 8, 9. **Time:** 5 minutes of reading.
:::

```mermaid
flowchart LR
  subgraph C1["Cluster 1 · eks-workload"]
    direction TB
    Targets["kubelet, cAdvisor, kube-state-metrics,<br/>node-exporter, services"] -- scrape --> Prom[Prometheus]
    Pods["Pod stdout/stderr"] -- "Kubernetes API" --> Alloy["Alloy · DaemonSet"]
  end
  Prom -- "remote_write HTTPS :9009<br/>X-Scope-OrgID: eks-workload<br/>label cluster=eks-workload" --> ALB[Internal ALB]
  Alloy -- "push HTTPS :3100<br/>label cluster=eks-workload" --> ALB
  subgraph C2["Cluster 2 · eks-observability"]
    ALB --> Mimir --> S3m[(S3 mimir)]
    ALB --> Loki --> S3l[(S3 loki)]
    Grafana --> Mimir
    Grafana --> Loki
  end
```

| Path | Sender (cluster 1) | Receiver (cluster 2) | How to tell it is cluster 1 data |
|---|---|---|---|
| Metrics | Prometheus scrapes locally, then `remote_write` | Mimir (tenant `eks-workload`) | label `cluster="eks-workload"` |
| Logs | Alloy on every node reads Pod logs | Loki | label `cluster="eks-workload"` |

- Both paths use the internal ALB and TLS from [step 4.1](../platform-addons/cert-manager-and-internal-tls); no traffic leaves the VPC.
- Mimir and Loki keep recent data on EBS and flush it to S3, so the data outlives any node of either cluster.
- Grafana in cluster 2 is the single place to query both. Cluster 2's own Prometheus only watches cluster 2.

## Steps in this module

1. [4.1 Private TLS and DNS](../platform-addons/cert-manager-and-internal-tls) — the connection.
2. [4.2 Metrics → Mimir](mimir-metrics-pipeline).
3. [4.3 Logs → Loki](loki-logging-pipeline).
4. [4.4 Grafana](grafana-dashboards).

The module is done when a **new** cluster 1 metric and a **new** cluster 1 log line can be queried in cluster 2 Grafana.

**Next:** [4.1 Private TLS and DNS](../platform-addons/cert-manager-and-internal-tls)

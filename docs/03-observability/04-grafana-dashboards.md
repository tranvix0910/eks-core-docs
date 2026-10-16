# Grafana Dashboards, Data Sources & Visualization

Technical documentation on **Grafana v10.5.15**, multi-tenant data source configuration for Mimir and Loki, and essential pre-configured operational dashboards.

---

## 1. Data Sources Configuration

Grafana is installed on `eks-observability` via Helm ([grafana/values.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/observability/grafana/values.yaml)).

### Configured Data Sources:
1. **Mimir (Prometheus Compatible)**:
   * **URL**: `http://mimir-gateway.monitoring.svc.cluster.local:80/prometheus`
   * **Custom HTTP Headers**: `X-Scope-OrgID: eks-workload`
2. **Loki (Logs Compatible)**:
   * **URL**: `http://loki-gateway.monitoring.svc.cluster.local:80`

---

## 2. Pinned Operational Dashboards

The following community-standard dashboards are imported for comprehensive monitoring:

* **Dashboard `1860` — Node Exporter Full**: CPU, memory, disk I/O, and network bandwidth per EC2 node.
* **Dashboard `315` — Kubernetes Cluster (Prometheus)**: Cluster-wide CPU/Memory quotas, Pod counts, and namespace utilization.
* **Dashboard `13639` — Logs / App Overview (Loki)**: Log streaming rate, error parsing, and application log search.

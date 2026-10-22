---
title: "Step 4.4 — Observe cluster 1 from Grafana"
sidebar_label: "4.4 Grafana"
---

# Step 4.4 — Observe cluster 1 from Grafana

:::info Step summary
**Goal:** query cluster 1 metrics and logs from the central Grafana in cluster 2.
**Requirements:** 8, 9. **Time:** about 10 minutes.
:::

## 1. Open Grafana

```bash
kubectl --context eks-observability -n monitoring port-forward svc/grafana 3000:80
kubectl --context eks-observability -n monitoring get secret grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode; echo
```

Open http://localhost:3000 and log in as `admin`.

## 2. Datasources

Terraform provisions them from `platform/observability/grafana/values.yaml`:

| Datasource | URL (inside cluster 2) | Notes |
|---|---|---|
| Mimir | `http://mimir-gateway.monitoring.svc.cluster.local/prometheus` | header `X-Scope-OrgID: eks-workload` |
| Loki | `http://loki-gateway.monitoring.svc.cluster.local` | — |

To add or change a datasource, edit that values file and re-apply layer 21; changes made only in the UI are lost on the next deploy.

## 3. Queries that prove the requirement

In **Explore**, choose **Mimir**:

```promql
# CPU per application Pod (cores)
sum by (pod) (rate(container_cpu_usage_seconds_total{cluster="eks-workload", namespace="shopnow", container!=""}[5m]))
```

```promql
# Memory per application Pod
sum by (pod) (container_memory_working_set_bytes{cluster="eks-workload", namespace="shopnow", container!=""})
```

```promql
# Cluster 1 nodes (infra + every Karpenter pool)
count(kube_node_info{cluster="eks-workload"})
```

Choose **Loki**:

```logql
{cluster="eks-workload", namespace="shopnow"} |= "workshop-proof"
```

**Expected:** data for the last 15 minutes in all four. Save a screenshot of each with the time range visible as evidence.

## 4. Dashboard

The **Enterprise Workload 360** dashboard (loaded in step 1.3) shows Pods, nodes, CPU, memory and restarts for cluster 1. Panels need the datasource UID `Mimir`; if a panel says *datasource not found*, set `uid: Mimir` on the Mimir datasource in the values file and re-apply layer 21.

## Ideas for more

- HTTP request rate and latency need the services to expose `/actuator/prometheus` and a ServiceMonitor; the five Spring MVC services already include Micrometer.
- Alert rules can be added to Mimir's ruler and routed through Alertmanager.

**Next:** [5.1 Acceptance](../operations/workshop-acceptance)

# Loki Logging Pipeline & Grafana Alloy DaemonSet

Technical reference on **Grafana Loki v7.3.0** (SingleBinary mode), S3 log storage, and **Grafana Alloy v1.11.1** DaemonSet log forwarding using River syntax.

---

## 1. Loki Configuration (SingleBinary Mode)

In [loki/values.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/observability/loki/values.yaml):
* **Mode**: `deploymentMode: SingleBinary` (optimized for lab scale).
* **Storage Backend**: AWS S3 (`eks-observability-loki-<AWS_ACCOUNT_ID>`) with TSDB index format (`schema: v13`).
* **Disabled Heavy Caches**: `chunksCache.enabled: false` and `resultsCache.enabled: false` to eliminate memory-heavy memcached pods.
* **Replication Factor**: `loki.commonConfig.replication_factor: 1`.

---

## 2. Grafana Alloy DaemonSet & River Syntax

Alloy collects container logs across all nodes in `eks-workload` and pushes them to Loki:

> [!IMPORTANT]
> **River Configuration Syntax**: Grafana Alloy uses the **River language**, which requires double slashes `//` for comments. Using standard bash hash `#` comments causes fatal parsing crashes:
> `Error: ...: expected expression, found IDENT "some_comment"`.

Alloy configuration snippet in [alloy/values.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/addons/alloy/values.yaml):
```river
discovery.kubernetes "pods" {
  role = "pod"
}

loki.source.kubernetes "pods" {
  targets    = discovery.kubernetes.pods.targets
  forward_to = [loki.write.endpoint.receiver]
}

loki.write "endpoint" {
  endpoint {
    url = "https://loki.observability.internal:3100/loki/api/v1/push"
    tls_config {
      ca_pem = "..." // Injected Private CA Certificate
    }
  }
}
```

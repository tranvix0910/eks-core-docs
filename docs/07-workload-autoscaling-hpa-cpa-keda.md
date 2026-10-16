# Workload Autoscaling: HPA, Cluster Proportional Autoscaler & KEDA

Deep-dive research on the three **pod-level (workload) autoscaling** mechanisms available on `eks-workload` and `eks-observability` — as distinct from **node-level** autoscaling, which is owned by Karpenter (see [docs/02-karpenter/](02-karpenter/01-karpenter-two-halves-architecture.md)). Covers mechanism internals, current implementation status in this repository, gaps, and a concrete adoption path for ShopNow and the observability stack.

> For actual deployment commands and load-test procedures, see the companion runbook: [docs/06-operations/04-workload-autoscaling-implementation-and-testing.md](06-operations/04-workload-autoscaling-implementation-and-testing.md).

---

## 1. Where This Fits in the Autoscaling Stack

Two independent scaling loops run in this platform, and they must not be confused:

```
┌─────────────────────────────────────────────────────────────┐
│  WORKLOAD AUTOSCALING (this document)                       │
│  "How many replicas of this Pod do I need?"                 │
│  Owners: HPA / CPA / KEDA                                   │
│  Input:  CPU, Memory, custom metrics, external events       │
│  Output: Deployment/StatefulSet .spec.replicas               │
└───────────────────────────┬───────────────────────────────────┘
                            │ pending Pods (unschedulable)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  CLUSTER AUTOSCALING (docs/02-karpenter/)                   │
│  "Do I have enough Nodes to run these Pods?"                 │
│  Owner:  Karpenter v1.14.0                                  │
│  Input:  Unschedulable Pods                                  │
│  Output: EC2 instances via 4 NodePools (ms-od/ms-spot/...)  │
└─────────────────────────────────────────────────────────────┘
```

Workload autoscaling decides **replica count**; Karpenter reacts to the result by provisioning or removing capacity. Getting workload autoscaling wrong (too aggressive, no stabilization window) directly drives unnecessary Karpenter churn and Spot interruption exposure.

---

## 2. Horizontal Pod Autoscaler (HPA)

### 2.1 Mechanism

Native Kubernetes controller (`autoscaling/v2`), reconciled by `kube-controller-manager` on a fixed poll interval (`--horizontal-pod-autoscaler-sync-period`, default 15s). For each `HorizontalPodAutoscaler` object it:

1. Reads current metric value for the target's Pods from one of three APIs:
   - **`metrics.k8s.io`** (Resource metrics: CPU/Memory) — served by **Metrics Server**.
   - **`custom.metrics.k8s.io`** (per-Pod custom metrics, e.g. `http_requests_per_second`) — served by an adapter (typically Prometheus Adapter).
   - **`external.metrics.k8s.io`** (metrics not tied to a Kubernetes object, e.g. SQS queue depth) — served by a cloud-specific adapter.
2. Computes desired replicas:
   ```
   desiredReplicas = ceil(currentReplicas × (currentMetricValue / desiredMetricValue))
   ```
3. Clamps to `[minReplicas, maxReplicas]` and applies `behavior.scaleUp`/`scaleDown` stabilization windows before mutating `.spec.replicas`.

### 2.2 Current State in This Repository

HPA is **already templated for all 6 ShopNow microservices** but **disabled by default**, and the metric source it depends on is **not yet deployed**:

| Service | Chart | `autoscaling.enabled` | min/max | Target CPU/Mem |
|---|---|---|---|---|
| `shopnow-api-gateway` | `apps/shopnow-backend-config/shopnow-api-gateway-chart` | `false` | 2 / 4 | 80% / 80% |
| `shopnow-cart-service` | `.../shopnow-cart-service-chart` | `false` | 2 / 4 | 80% / 80% |
| `shopnow-config-server` | `.../shopnow-config-server-chart` | `false` | 1 / 2 | 80% / 80% |
| `shopnow-discovery-server` | `.../shopnow-discovery-server-chart` | `false` | 1 / 1 | 80% / 80% |
| `shopnow-product-service` | `.../shopnow-product-service-chart` | `false` | 2 / 4 | 80% / 80% |
| `shopnow-user-service` | `.../shopnow-user-service-chart` | `false` | 2 / 4 | 80% / 80% |

Each chart's `templates/hpa.yaml` is a standard `autoscaling/v2` HPA gated behind `{{- if .Values.autoscaling.enabled }}`, targeting CPU + Memory utilization only (no custom metrics wired).

**Gap:** `platform/addons/metrics-server/` exists as a placeholder directory (`.gitkeep` only, no manifests, no ArgoCD Application referencing it). **Metrics Server is not actually running on `eks-workload`.** Flipping `autoscaling.enabled: true` today would produce an HPA stuck at `<unknown>/80%` — it has nothing to read CPU/Memory from.

`shopnow-discovery-server` (Eureka) is pinned `min: 1, max: 1` — correctly excluded from scaling since a Eureka registry is stateful-in-practice and typically run as a singleton per environment here.

### 2.3 Fix Path

1. Populate `platform/addons/metrics-server/` with the standard Helm chart (or static manifests) and wire it into the ArgoCD `Application` set following the sync-wave ordering in [docs/01-platform-addons/01-gitops-bootstrap-order.md](01-platform-addons/01-gitops-bootstrap-order.md) — Metrics Server has no dependency on cert-manager/LBC, so it can sync early.
2. Verify with `kubectl top pods -n <ns>` returns real numbers (not `<unknown>`).
3. Flip `autoscaling.enabled: true` per-service via Helm values, starting with `shopnow-api-gateway` (highest, most bursty traffic) and `shopnow-cart-service`.
4. Add a `behavior.scaleDown.stabilizationWindowSeconds: 300` block to avoid flapping replicas down right before Karpenter has finished consolidating the node it just provisioned for the scale-up — an interaction that currently doesn't exist because HPA is off, but will as soon as it's enabled.

---

## 3. Cluster Proportional Autoscaler (CPA)

### 3.1 Mechanism

`kubernetes-sigs/cluster-proportional-autoscaler` — despite the name, it does **not** scale the cluster (Karpenter's job). It scales the **replica count of one specific Deployment** proportionally to cluster size (node count or core count), independent of that Deployment's own CPU/traffic load. It runs as its own small Deployment, polling the Kubernetes API for node/core counts, and writes `.spec.replicas` on a target Deployment directly (no HPA object involved).

Two scaling modes, configured via a ConfigMap:

- **Linear**: `replicas = max(ceil(cores / coresPerReplica), ceil(nodes / nodesPerReplica), min)`, capped at `max`.
- **Ladder**: step function — a lookup table mapping node/core count ranges to a fixed replica count.

### 3.2 Why It Matters Here Specifically

CPA's canonical use case is **CoreDNS**. DNS query volume scales with the number of Pods/Nodes issuing lookups, not with CoreDNS's own resource pressure — exactly the input HPA cannot see (CoreDNS's own CPU stays flat right up until it becomes the bottleneck). Both clusters run CoreDNS as an EKS-managed core add-on with a static replica count.

**Current state: not deployed on either cluster.** No `cluster-proportional-autoscaler` manifests, Helm release, or ConfigMap exist anywhere under `gitops/` or `terraform/`. CoreDNS today scales exactly as wide as the EKS add-on's default replica count and stays there regardless of how large `eks-workload` grows via Karpenter.

### 3.3 When to Adopt

Not urgent at current scale (`infra`: 3× `t3.large` base + Karpenter bursts). Becomes relevant once:
- Karpenter routinely holds double-digit node counts during ShopNow traffic peaks (each node's kubelet + Pods all resolve DNS through CoreDNS), or
- `kubectl top pods -n kube-system -l k8s-app=kube-dns` / CoreDNS's own `coredns_dns_request_duration_seconds` metrics in Mimir show latency creeping up under load.

Reference starting config for this cluster's scale profile:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns-autoscaler
  namespace: kube-system
data:
  linear: |-
    {
      "coresPerReplica": 256,
      "nodesPerReplica": 16,
      "min": 2,
      "max": 8,
      "preventSinglePointFailure": true
    }
```

`min: 2` with `preventSinglePointFailure: true` keeps CoreDNS spread across ≥2 nodes at all times — worth cross-checking against whatever topology spread / PDB CoreDNS currently has as an EKS add-on before enabling this, so CPA doesn't fight the add-on's own defaults.

---

## 4. Kubernetes Event-Driven Autoscaling (KEDA)

### 4.1 Mechanism

CNCF project, not a Kubernetes built-in. KEDA does not replace HPA — it **generates and manages an HPA object underneath** a `ScaledObject`/`ScaledJob` CRD, feeding it metrics from 60+ "scalers" (Kafka, AWS SQS, CloudWatch, Prometheus, Cron, PostgreSQL, RabbitMQ, ...) via the same `external.metrics.k8s.io` mechanism HPA already understands.

Two components:
- **KEDA Operator** — watches `ScaledObject`/`ScaledJob` CRDs, creates/deletes the underlying HPA.
- **Metrics Adapter** — exposes each scaler's external metric to the Kubernetes Metrics API.

The one thing plain HPA structurally cannot do that KEDA can: **scale to zero**. HPA requires ≥1 running replica to read a metric from it, so it can never bring a Deployment down to 0. KEDA decouples "is there an active event" (its own `activationThreshold` check, works down to 0 replicas) from "how many replicas given the metric" (delegated to the HPA it manages), so a Deployment can idle at 0 and scale up on the first event.

### 4.2 Current State in This Repository

**Not deployed.** No `keda` Helm release, no `ScaledObject`/`ScaledJob` CRs anywhere in `gitops/`. There is also currently no queue/event-driven workload in ShopNow (all 6 services are synchronous request/response, fronted by `shopnow-api-gateway`) — so there's no existing consumer that KEDA would obviously slot under today.

### 4.3 Where It Would Actually Fit

Two concrete openings exist in this platform's own architecture, not hypothetical ones:

**a) Prometheus-scaler against Mimir, instead of standing up a Prometheus Adapter for custom-metric HPA.**
Cluster 1's Prometheus already `remote_write`s every ShopNow metric to Mimir over the internal ALB (`mimir.observability.internal:9009`, `X-Scope-OrgID: eks-workload`, TLS via the `observability-alb-tls` secret — see [docs/03-observability/02-mimir-metrics-pipeline.md](03-observability/02-mimir-metrics-pipeline.md)). Mimir exposes a Prometheus-compatible query API, so a KEDA `prometheus` scaler can query it directly for PromQL-based scaling (e.g. `sum(rate(http_server_requests_seconds_count{service="shopnow-api-gateway"}[2m]))`) without ever installing Prometheus Adapter — reusing infrastructure that already exists, rather than adding a second custom-metrics pipeline:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: api-gateway-request-rate
  namespace: shopnow
spec:
  scaleTargetRef:
    name: shopnow-api-gateway
  minReplicaCount: 2
  maxReplicaCount: 10
  triggers:
  - type: prometheus
    metadata:
      serverAddress: https://mimir.observability.internal:9009/prometheus
      query: sum(rate(http_server_requests_seconds_count{service="shopnow-api-gateway"}[2m]))
      threshold: "50"
      customHeaders: "X-Scope-OrgID=eks-workload"
```
This needs cluster 1's Pods to trust `eks-workload-ca` (the same internal CA already used for `remote_write` — see [docs/05-security/04-tls-certificate-lifecycle.md](05-security/04-tls-certificate-lifecycle.md)) when calling out to Mimir; not free, but no new trust chain either.

**b) `aws-sqs-queue` scaler, if/when ShopNow adds an async worker.**
Nothing in ShopNow today reads from SQS. But `20-cluster-workload` already provisions an SQS queue and IAM/Pod Identity wiring for Karpenter's own interruption handling (see [docs/02-karpenter/04-disruption-and-spot-interruption.md](02-karpenter/04-disruption-and-spot-interruption.md)), so the account/region/Pod-Identity pattern for granting a Pod `sqs:GetQueueAttributes`/`sqs:ReceiveMessage` is already established practice here, not a new pattern to introduce. Any future order-processing or notification worker should default to KEDA + SQS scale-to-zero rather than a bare Deployment, given that precedent.

### 4.4 Adoption Priority

Lower priority than fixing HPA (§2.3) — KEDA solves problems (event-driven workers, scale-to-zero, PromQL-based scaling) that don't exist in the current ShopNow architecture yet. Revisit when either (a) an async/queue-based service is added, or (b) CPU/Memory-based HPA proves too coarse for `shopnow-api-gateway` and request-rate-based scaling against Mimir becomes worth the added moving part.

---

## 5. Comparison Matrix

| | HPA | CPA | KEDA |
|---|---|---|---|
| **Kubernetes-native?** | Yes (`autoscaling/v2`) | No (SIG add-on, separate Deployment) | No (CNCF, builds HPA underneath) |
| **Scales** | Replicas of the target itself | Replicas of a target proportional to cluster size | Replicas of the target (via managed HPA) |
| **Metric input** | CPU/Mem (native), custom/external (via adapter) | Node/core count only | 60+ scalers: queues, Prometheus, cron, DBs, cloud metrics |
| **Scale to zero** | No | No | Yes |
| **Extra components to run** | Metrics Server (for CPU/Mem) | The CPA Deployment itself | KEDA Operator + Metrics Adapter |
| **Deployed in this repo today** | Templated, disabled, blocked on Metrics Server | Not deployed | Not deployed |
| **Best fit here** | ShopNow's 6 synchronous services | CoreDNS, once Karpenter node counts grow | Prometheus/Mimir-driven scaling; future SQS workers |

---

## 6. Recommended Rollout Order

1. **Now:** Deploy Metrics Server (§2.3) — unblocks the HPA objects that already exist in every ShopNow chart at zero new architectural surface area.
2. **Now:** Enable `autoscaling.enabled: true` for `shopnow-api-gateway` and `shopnow-cart-service` first (highest/most variable load), watch behavior for a full traffic cycle, then extend to `shopnow-config-server` and `shopnow-product-service`. Leave `shopnow-discovery-server` at `min:1/max:1`.
3. **Later, load-triggered:** If CoreDNS latency/error metrics in Mimir show pressure as Karpenter's average node count climbs, deploy CPA per §3.3.
4. **Later, feature-triggered:** Adopt KEDA only when either a queue-based worker is introduced (SQS scaler) or CPU/Mem-based HPA proves insufficient for `shopnow-api-gateway` and PromQL-based scaling against Mimir (§4.3a) is worth the added component.

Do not enable all three simultaneously against the same Deployment — HPA and a KEDA-managed HPA both claiming the same `scaleTargetRef` will fight each other. If §4 is adopted for a service already on plain HPA, delete the plain `HorizontalPodAutoscaler` object first (or set `autoscaling.enabled: false` in that chart) before applying the `ScaledObject`.

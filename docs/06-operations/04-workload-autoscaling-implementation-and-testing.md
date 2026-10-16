# Workload Autoscaling: Implementation & Testing Runbook

Step-by-step operational runbook for deploying **HPA**, **Cluster Proportional Autoscaler (CPA)**, and **KEDA** on `eks-workload`, and for proving each one actually scales before trusting it in front of real traffic. Concept/mechanism/gap-analysis lives in [docs/07-workload-autoscaling-hpa-cpa-keda.md](../07-workload-autoscaling-hpa-cpa-keda.md) — this document is the "do it" companion.

All commands assume the context set up in [docs/01-platform-addons/01-gitops-bootstrap-order.md](../01-platform-addons/01-gitops-bootstrap-order.md):
```bash
export AWS_PROFILE=eks-core
export AWS_REGION=ap-northeast-1
aws eks update-kubeconfig --name eks-workload --region ap-northeast-1 --profile eks-core --alias eks-workload
kubectl config use-context eks-workload
```

---

## 0. Preconditions Already Satisfied

Verified before writing this runbook, so none of the three parts below need to work around them:

* **`resources.requests.cpu: 250m`** is set on all 6 ShopNow charts (`apps/shopnow-backend-config/*/values.yaml`) — HPA cannot compute `%Utilization` without a CPU request; it's already there.
* **PDBs use `maxUnavailable`, not `minAvailable`** (`apps/shopnow-backend-config/*/templates/pdb.yaml`) — deliberately, because an absolute `minAvailable` breaks the moment HPA changes replica count. Nothing to fix here before enabling HPA.
* **AppProject `shopnow` already whitelists `group: autoscaling, kind: "*"`** (`platform/addons/argocd/appproject-shopnow.yaml`) — a plain `HorizontalPodAutoscaler` will sync without touching the AppProject. KEDA's `keda.sh` group is **not** whitelisted yet — Part C fixes that.
* ShopNow Applications are **ArgoCD-managed with `automated: {prune: true, selfHeal: true}`** (`platform/bootstrap/shopnow-applications.yaml`) — any values change pushed to `main` is picked up and applied automatically; a raw `kubectl apply` against the same object would just get reverted by self-heal. Every step below that changes a ShopNow workload edits the Application's Helm `values:` block and lets ArgoCD apply it, not `kubectl edit`.

---

## Part A — Horizontal Pod Autoscaler (ShopNow Microservices)

### Step 1 — Install Metrics Server

HPA's CPU/Memory metrics come from Metrics Server, which is not deployed yet (`platform/addons/metrics-server/` is currently an empty placeholder). Populate it:

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
helm repo update
```

`platform/addons/metrics-server/values.yaml`:
```yaml
# Cluster-internal only - no need to expose outside the API server's own
# in-cluster call path, unlike the observability stack's public/internal ALBs.
args:
  - --kubelet-preferred-address-types=InternalIP
  - --kubelet-use-node-status-port
  - --metric-resolution=15s

resources:
  requests:
    cpu: 50m
    memory: 100Mi
  limits:
    memory: 200Mi

replicas: 2

# Every node in this cluster is tainted (infra managed node group + each
# Karpenter NodePool) - without both of these the Pods sit Pending forever,
# same as every other controller-style addon here.
nodeSelector:
  role: infra
tolerations:
  - key: CriticalAddonsOnly
    operator: Exists
    effect: NoSchedule
```

```bash
helm upgrade --install metrics-server metrics-server/metrics-server \
  --version 3.12.2 \
  --namespace kube-system \
  -f platform/addons/metrics-server/values.yaml \
  --wait
```

> [!NOTE]
> Check `helm search repo metrics-server/metrics-server --versions` for the current chart version before installing — pin whatever `3.12.x`/`3.13.x` resolves at install time rather than trusting the number above blindly.

**Verify:**
```bash
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
kubectl top pods -n shopnow
```
`kubectl top` returning real numbers (not `error: Metrics API not available`) is the gate for Step 2. This alone doesn't move any replica count yet — no `HorizontalPodAutoscaler` exists until Step 2.

### Step 2 — Enable HPA for `shopnow-api-gateway` and `shopnow-cart-service`

Per the rollout order in the research doc, start with the two highest-traffic services. Edit `platform/bootstrap/shopnow-applications.yaml`, in the `shopnow-api-gateway` Application's inline `values:` block (same block that already overrides `image.repository` — keep the precedent of using inline `values:` for environment-level overrides rather than editing the chart's own `values.yaml` defaults):

```yaml
      values: |
        image:
          repository: "<AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/shopnow/shopnow-api-gateway"
        autoscaling:
          enabled: true
          minReplicas: 2
          maxReplicas: 6
          targetCPUUtilizationPercentage: 70
          targetMemoryUtilizationPercentage: 80
```

Repeat for `shopnow-cart-service` with `image.repository` unchanged and the same `autoscaling` block (its chart default is already `min:2/max:4` — raise `maxReplicas` to `6` only if load-testing in Step 4 shows it capping out).

The chart's `templates/hpa.yaml` doesn't currently expose a `behavior` block — add one so scale-down doesn't flap the moment CPU dips below 70% for a few seconds (relevant because a flapping HPA also drives unnecessary Karpenter node churn):

`apps/shopnow-backend-config/shopnow-api-gateway-chart/templates/hpa.yaml`, inside `spec:`:
```yaml
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
```

Commit and push to `main`. ArgoCD's `selfHeal` picks it up within its poll interval, or force it immediately:
```bash
argocd app sync shopnow-api-gateway shopnow-cart-service
```

**Verify:**
```bash
kubectl get hpa -n shopnow
kubectl describe hpa shopnow-api-gateway -n shopnow
```
Expect `TARGETS` to show real percentages (e.g. `12%/70%`), not `<unknown>/70%`. `<unknown>` means Step 1 isn't actually serving metrics for that Pod's labels — re-check `kubectl top pods -n shopnow` before moving on.

### Step 3 — Load Test to Prove Scale-Up and Scale-Down

Run a throwaway load generator **inside the cluster**, hitting the Service directly (`internalTrafficPolicy: Cluster`, so this bypasses the ALB entirely and stresses the Pods, not the load balancer):

```bash
kubectl run load-gen --rm -it --restart=Never --image=williamyeh/hey -n shopnow -- \
  hey -z 5m -c 50 http://shopnow-api-gateway-service.shopnow.svc.cluster.local:5860/actuator/health
```

In a second terminal, watch both loops simultaneously — HPA scaling replicas, and Karpenter provisioning nodes for them if the `infra` node group's headroom runs out:
```bash
kubectl get hpa shopnow-api-gateway -n shopnow --watch
kubectl get pods -n shopnow -l app=shopnow-api-gateway --watch
kubectl get nodeclaims --watch   # only if replica growth exceeds current node capacity
```

Expected sequence: CPU climbs past 70% → `REPLICAS` in `kubectl get hpa` output increases (bounded by `scaleUp.policies`, max +2 Pods/60s) → new Pods go `Pending` only if `infra` nodes are full, in which case Karpenter's `ms-od`/`ms-spot` NodePools should pick them up within ~60–90s (see [docs/02-karpenter/01-karpenter-two-halves-architecture.md](../02-karpenter/01-karpenter-two-halves-architecture.md)).

Kill the load generator (`Ctrl+C`, or let the 5-minute `-z` window expire) and keep watching `kubectl get hpa -n shopnow --watch`. Replica count should hold for **5 minutes** (`stabilizationWindowSeconds: 300`) before scaling back down one Pod at a time — that pause is the point of the `behavior` block from Step 2, not a bug.

### Step 4 — Extend to Remaining Services

Once `shopnow-api-gateway`/`shopnow-cart-service` have survived one full scale-up/scale-down cycle without errors, repeat Step 2 for `shopnow-config-server` and `shopnow-product-service`. Leave `shopnow-discovery-server` at `min:1/max:1` — a Eureka registry run as a singleton shouldn't be horizontally scaled without addressing peer replication first, which is out of scope here.

---

## Part B — Cluster Proportional Autoscaler (CoreDNS)

Not urgent at current scale (§3.3 of the research doc) — include this only once Karpenter is routinely holding double-digit node counts. Steps below for when that trigger is hit.

### Step 1 — Deploy CPA

No official Helm chart is maintained for this project; deploy the RBAC + Deployment + ConfigMap manifests directly, scoped to `kube-system`:

`platform/addons/cluster-proportional-autoscaler/coredns-autoscaler.yaml`:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: coredns-autoscaler
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: coredns-autoscaler
rules:
  - apiGroups: [""]
    resources: ["nodes"]
    verbs: ["list", "watch"]
  - apiGroups: [""]
    resources: ["replicationcontrollers/scale"]
    verbs: ["get", "update"]
  - apiGroups: ["apps"]
    resources: ["deployments/scale", "replicasets/scale"]
    verbs: ["get", "update"]
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "create"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: coredns-autoscaler
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: coredns-autoscaler
subjects:
  - kind: ServiceAccount
    name: coredns-autoscaler
    namespace: kube-system
---
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
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coredns-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: coredns-autoscaler
  template:
    metadata:
      labels:
        app: coredns-autoscaler
    spec:
      serviceAccountName: coredns-autoscaler
      containers:
        - name: autoscaler
          image: registry.k8s.io/cpa/cluster-proportional-autoscaler:1.9.0
          command:
            - /cluster-proportional-autoscaler
            - --namespace=kube-system
            - --configmap=coredns-autoscaler
            - --target=deployment/coredns
            - --logtostderr=true
            - --v=2
          resources:
            requests:
              cpu: 20m
              memory: 10Mi
```

> [!NOTE]
> Confirm `--target=deployment/coredns` matches the actual CoreDNS Deployment name for the EKS-managed `coredns` add-on version in use (`kubectl get deployment -n kube-system | grep -i dns`) — and check the current tag for `registry.k8s.io/cpa/cluster-proportional-autoscaler` at deploy time; `1.9.0` may not be the latest.

```bash
kubectl apply -f platform/addons/cluster-proportional-autoscaler/coredns-autoscaler.yaml
```

### Step 2 — Test Without Waiting for Real Node Growth

Waiting for Karpenter to organically add 16 nodes to see CoreDNS gain a replica is impractical to validate on demand. Instead, temporarily drop `nodesPerReplica` to force an immediate, deterministic reaction:

```bash
kubectl get deployment coredns -n kube-system -o jsonpath='{.spec.replicas}'   # baseline

kubectl patch configmap coredns-autoscaler -n kube-system --type merge -p \
  '{"data":{"linear":"{\"coresPerReplica\":256,\"nodesPerReplica\":1,\"min\":2,\"max\":8,\"preventSinglePointFailure\":true}"}}'

kubectl get deployment coredns -n kube-system -o jsonpath='{.spec.replicas}' --watch
```
With `nodesPerReplica: 1`, CoreDNS should scale to roughly the current node count (capped at `max: 8`) within one CPA poll cycle (default 10s). Confirm CPA itself made the change, not something else:
```bash
kubectl logs -n kube-system deployment/coredns-autoscaler --tail=20
```

**Revert immediately after confirming the reaction** — `nodesPerReplica: 1` is a test value, not a production one:
```bash
kubectl patch configmap coredns-autoscaler -n kube-system --type merge -p \
  '{"data":{"linear":"{\"coresPerReplica\":256,\"nodesPerReplica\":16,\"min\":2,\"max\":8,\"preventSinglePointFailure\":true}"}}'
```

---

## Part C — KEDA

Two tracks: a **zero-dependency smoke test** (cron scaler, proves KEDA itself is wired correctly) and the **actual recommended integration for this platform** (Prometheus scaler against Mimir, per §4.3a of the research doc). Do the smoke test first — if KEDA's own plumbing is broken, debugging that at the same time as a Mimir TLS trust issue is a bad time.

### Step 1 — Install KEDA

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
```

`platform/addons/keda/values.yaml`:
```yaml
# Every node in this cluster is tainted (infra managed node group + each
# Karpenter NodePool), same as every other controller-style addon here
# (see aws-load-balancer-controller/values.yaml) - without this the operator
# and metrics server Pods sit Pending forever.
nodeSelector:
  role: infra
tolerations:
  - key: CriticalAddonsOnly
    operator: Exists
    effect: NoSchedule

resources:
  operator:
    requests:
      cpu: 50m
      memory: 100Mi
  metricServer:
    requests:
      cpu: 50m
      memory: 100Mi
```

```bash
helm upgrade --install keda kedacore/keda \
  --version 2.17.2 \
  --namespace keda --create-namespace \
  -f platform/addons/keda/values.yaml \
  --wait
```

> [!NOTE]
> Run `helm search repo kedacore/keda --versions` first and pin the actual current version — don't take `2.17.2` above as verified-current.

**Verify:**
```bash
kubectl get pods -n keda
# Expect keda-operator and keda-operator-metrics-apiserver both Running
kubectl get apiservice v1beta1.external.metrics.k8s.io -o jsonpath='{.status.conditions[0].status}'
# Expect "True"
```

### Step 2 — Whitelist `keda.sh` in the ShopNow AppProject

Only needed if a `ScaledObject` will live in the `shopnow` namespace (recommended — keep it next to the Deployment it targets, same as the plain HPAs). Add to `platform/addons/argocd/appproject-shopnow.yaml`:
```yaml
  namespaceResourceWhitelist:
    - group: ""
      kind: "*"
    - group: "apps"
      kind: "*"
    - group: "batch"
      kind: "*"
    - group: "networking.k8s.io"
      kind: "*"
    - group: "policy"
      kind: "*"
    - group: "autoscaling"
      kind: "*"
    - group: "argoproj.io"
      kind: "*"
    - group: "keda.sh"
      kind: "*"
```
```bash
kubectl apply -f platform/addons/argocd/appproject-shopnow.yaml
```
Without this, a `ScaledObject` applied into `shopnow` fails sync with `"resource ScaledObject is not permitted in project shopnow"` — same failure mode the AppProject's own comments already describe for the `Namespace` exception.

### Step 3 — Smoke Test: Cron Scaler

Deploy a disposable target so this test can't affect a real ShopNow service, and confirm KEDA can drive a Deployment from 0 → N → 0 on a schedule with no external system involved:

```bash
kubectl create namespace keda-test
kubectl create deployment keda-smoke-test --image=nginx:alpine -n keda-test --replicas=0
```

`keda-smoke-test-scaledobject.yaml` — scales up for 2 minutes out of every 5, purely to observe the transition without waiting on a real event source:
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: keda-smoke-test
  namespace: keda-test
spec:
  scaleTargetRef:
    name: keda-smoke-test
  minReplicaCount: 0
  maxReplicaCount: 2
  cooldownPeriod: 30
  triggers:
    - type: cron
      metadata:
        timezone: Asia/Ho_Chi_Minh
        start: "*/5 * * * *"
        end: "2-4/5 * * * *"
        desiredReplicas: "2"
```
```bash
kubectl apply -f keda-smoke-test-scaledobject.yaml
kubectl get scaledobject -n keda-test --watch
kubectl get hpa -n keda-test --watch   # KEDA's own managed HPA, named keda-hpa-keda-smoke-test
kubectl get pods -n keda-test --watch
```
Expect: `keda-smoke-test` Deployment sits at `0/0` replicas outside the cron window, jumps to `2/2` inside it, and a `HorizontalPodAutoscaler` named `keda-hpa-keda-smoke-test` appears/disappears alongside — confirming KEDA is correctly generating and tearing down the underlying HPA.

Clean up once confirmed:
```bash
kubectl delete namespace keda-test
```

### Step 4 — Production Path: Prometheus Scaler Against Mimir

This is the integration actually worth keeping, per the research doc — it reuses the `remote_write` pipeline that already exists rather than adding Prometheus Adapter as a second custom-metrics system.

**Prerequisite — TLS trust.** Mimir's query endpoint sits behind the same internal ALB and `observability-alb-tls` cert chain Prometheus already trusts for `remote_write` (see [docs/05-security/04-tls-certificate-lifecycle.md](../05-security/04-tls-certificate-lifecycle.md)). KEDA's operator Pod needs that same CA to verify `mimir.observability.internal:9009` over HTTPS — mount it the same way `platform/addons/prometheus/values.yaml` does today (`caFile` pointing at a copy of `observability-alb-tls`'s `ca.crt`, since cert-manager only manages Secrets in its own cluster/namespace and this is a manual copy, same caveat already documented there).

```bash
kubectl get secret observability-alb-tls -n cert-manager -o jsonpath='{.data.ca\.crt}' | base64 -d > mimir-ca.crt
kubectl create secret generic mimir-ca -n shopnow --from-file=ca.crt=mimir-ca.crt
rm mimir-ca.crt
```

`ScaledObject` for `shopnow-api-gateway`, querying request rate directly from Mimir:
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: shopnow-api-gateway-request-rate
  namespace: shopnow
spec:
  scaleTargetRef:
    name: shopnow-api-gateway
  minReplicaCount: 2
  maxReplicaCount: 10
  cooldownPeriod: 300
  triggers:
    - type: prometheus
      metadata:
        serverAddress: https://mimir.observability.internal:9009/prometheus
        query: sum(rate(http_server_requests_seconds_count{service="shopnow-api-gateway"}[2m]))
        threshold: "50"
        customHeaders: "X-Scope-OrgID=eks-workload"
        unsafeSsl: "false"
```
If `spring-boot-starter-actuator` + Micrometer isn't already exposing `http_server_requests_seconds_count` and it's reaching Mimir, confirm with a query first before wiring the `ScaledObject` to it:
```bash
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
curl -s 'http://localhost:9090/api/v1/query?query=http_server_requests_seconds_count{service="shopnow-api-gateway"}' | jq
```

> [!IMPORTANT]
> Deploying this `ScaledObject` against `shopnow-api-gateway` while its plain `HorizontalPodAutoscaler` from Part A is still active will conflict — both claim `scaleTargetRef: shopnow-api-gateway`, and Kubernetes doesn't arbitrate between two HPAs (KEDA's own managed one plus the chart's plain one) targeting the same object. Set `autoscaling.enabled: false` back in `shopnow-applications.yaml`'s inline `values:` for this service before applying the `ScaledObject`, or point the `ScaledObject` at a different service than the ones already on plain HPA.

**Test:** same `hey` load generator from Part A Step 3, but now watch the KEDA-managed HPA and query Mimir directly to confirm the metric KEDA is reading matches what's actually happening:
```bash
kubectl run load-gen --rm -it --restart=Never --image=williamyeh/hey -n shopnow -- \
  hey -z 5m -c 50 http://shopnow-api-gateway-service.shopnow.svc.cluster.local:5860/actuator/health

kubectl get hpa -n shopnow --watch   # keda-hpa-shopnow-api-gateway-request-rate
kubectl get scaledobject shopnow-api-gateway-request-rate -n shopnow -o yaml   # status.conditions
```

---

## 4. Rollback

| Component | Rollback command |
|---|---|
| HPA (per service) | Set `autoscaling.enabled: false` in that service's inline `values:` in `shopnow-applications.yaml`, push, `argocd app sync` |
| Metrics Server | `helm uninstall metrics-server -n kube-system` — do this *after* disabling every HPA, otherwise they go `<unknown>` |
| CPA | `kubectl delete -f platform/addons/cluster-proportional-autoscaler/coredns-autoscaler.yaml` — CoreDNS keeps whatever replica count CPA last set until the add-on's own reconciler touches it |
| KEDA `ScaledObject` | `kubectl delete scaledobject <name> -n shopnow` — KEDA deletes the HPA it generated automatically; re-enable the plain HPA (`autoscaling.enabled: true`) if this service needs to keep scaling |
| KEDA (whole install) | Delete every `ScaledObject` first, then `helm uninstall keda -n keda` |

---

## 5. Status Checklist

| Step | Owner action | Verification command |
|---|---|---|
| Metrics Server deployed | Part A, Step 1 | `kubectl top pods -n shopnow` returns numbers |
| HPA enabled on `api-gateway` + `cart-service` | Part A, Step 2 | `kubectl get hpa -n shopnow` shows real `TARGETS %` |
| HPA scale-up/down proven under load | Part A, Step 3 | Replica count rose under `hey`, fell back after 5 min idle |
| CPA deployed (only once node count justifies it) | Part B, Step 1 | `kubectl get deployment coredns-autoscaler -n kube-system` |
| CPA reaction proven | Part B, Step 2 | CoreDNS replica count changed after `nodesPerReplica` patch, reverted after |
| KEDA installed | Part C, Step 1 | `kubectl get pods -n keda` both Running |
| `keda.sh` whitelisted | Part C, Step 2 | `ScaledObject` applies without AppProject error |
| KEDA plumbing proven (cron) | Part C, Step 3 | `keda-smoke-test` Deployment cycled 0→2→0 |
| KEDA/Mimir integration live (optional) | Part C, Step 4 | `keda-hpa-shopnow-api-gateway-request-rate` reacts to `hey` load |

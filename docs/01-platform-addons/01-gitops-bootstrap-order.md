# Platform Add-on Deployment Sequence (GitOps Bootstrap Order)

Step-by-step guide detailing the deployment order for platform add-ons across both EKS clusters (`eks-workload` and `eks-observability`), dependency chains, and the relationship between theoretical design (ArgoCD App-of-apps) and actual operations (Helm CLI).

---

## 1. Sync-Waves & Dependency Matrix

When fully automated via ArgoCD's `app-of-apps.yaml`, deployment follows strict **Sync-Waves**:

```
Wave -2: Custom Resource Definitions (CRDs)
Wave -1: Infrastructure Controllers (AWS LB Controller, External Secrets)
Wave  0: Karpenter NodePools & StorageClasses (must exist before Pods sync)
Wave  1: Observability Agents (Prometheus Operator, Grafana Alloy) & Core Tools (cert-manager, ArgoCD, Rancher)
Wave  2: Workload Microservices (ShopNow Database, Backend, Frontend Rollout)
```

---

## 2. Deployment Sequence on `eks-workload`

Configure your context:
```bash
aws eks update-kubeconfig --name eks-workload --region ap-northeast-1 --profile eks-core --alias eks-workload
kubectl config use-context eks-workload
```

### Step 1 — AWS Load Balancer Controller
Required by all future Ingresses and NLBs:
```bash
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  -f platform/addons/aws-load-balancer-controller/values.yaml \
  --wait
```

### Step 2 — Karpenter Controller & NodePools
> [!IMPORTANT]
> Install the Karpenter Controller Helm chart first to load the CRDs (`EC2NodeClass`, `NodePool`), then apply the NodePool manifests.

```bash
# 2a. Install Controller & CRDs (Mandatory in kube-system namespace)
helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter \
  --version 1.14.0 \
  --namespace kube-system \
  -f platform/addons/karpenter/values.yaml \
  --wait

# 2b. Apply NodeClass and NodePool manifests
kubectl apply -f platform/nodepools/ec2nodeclass.yaml
kubectl apply -f platform/nodepools/nodepool-2-ondemand.yaml
kubectl apply -f platform/nodepools/nodepool-2-spot.yaml
kubectl apply -f platform/nodepools/nodepool-1-spot.yaml
kubectl apply -f platform/nodepools/nodepool-3-arm64.yaml
```

### Step 3 — cert-manager & Internal Certificates
Required prior to Rancher (Rancher generates certs via cert-manager CRDs) and for the Observability CA:
```bash
helm upgrade --install cert-manager jetstack/cert-manager --version v1.21.1 \
  --namespace cert-manager --create-namespace \
  -f platform/addons/cert-manager/values.yaml \
  --wait

# Provision Private CA and TLS Certificate for the Internal ALB
kubectl apply -f platform/observability/tls/ca-issuer.yaml
kubectl apply -f platform/observability/tls/alb-cert.yaml
```

### Step 4 — ArgoCD & Argo Rollouts
```bash
# Install ArgoCD with UI Extension enabled
helm upgrade --install argocd argo/argo-cd --version 10.3.0 \
  --namespace argocd --create-namespace \
  -f platform/addons/argocd/values.yaml \
  --wait

# Install Argo Rollouts Controller
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Authorize AppProject shopnow to accept Rollout CRDs
kubectl apply -f platform/addons/argocd/appproject-shopnow.yaml
```

### Step 5 — Rancher Multi-Cluster Management
```bash
helm upgrade --install rancher rancher-stable/rancher --version 2.14.3 \
  --namespace cattle-system --create-namespace \
  -f platform/addons/rancher/values.yaml \
  --wait --timeout 10m

# Provision Internal NLB service for cluster agent registration
kubectl apply -f platform/addons/rancher/internal-nlb-service.yaml
```

### Step 6 — Prometheus & Grafana Alloy (Observability Agents)
```bash
# Kube-Prometheus-Stack (Prometheus Agent + Alertmanager)
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --version 88.1.5 --namespace monitoring --create-namespace \
  -f platform/addons/prometheus/values.yaml \
  --wait

# Grafana Alloy DaemonSet for log collection
helm upgrade --install alloy grafana/alloy --version 1.11.1 \
  --namespace monitoring \
  -f platform/addons/alloy/values.yaml \
  --wait
```

### Step 7 — Admin Ingress & ALB Access Table

```bash
kubectl apply -f platform/ingress/admin-ingress.yaml
```

Fetch the Application Load Balancer DNS hostname on `eks-workload`:
```bash
ALB_WORKLOAD_DNS=$(kubectl get ingress -n argocd argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "ALB Workload DNS: http://${ALB_WORKLOAD_DNS}"
```

#### 📋 Access Table for Components via Workload ALB (`eks-workload`):

All administrative tools and microservice ingresses share **1 single Public ALB** (`group.name: eks-workload`), multiplexed by listener port:

| Component / Application | Namespace | Port | Access URL & Protocol | Authentication Mechanism | Healthcheck Path |
|---|---|---|---|---|---|
| **ArgoCD Web UI** | `argocd` | **`80`** | `http://<ALB_WORKLOAD_DNS>` | `admin` / Password from Secret `argocd-initial-admin-secret` | `/healthz` |
| **Prometheus Server UI** | `monitoring` | **`9090`** | `http://<ALB_WORKLOAD_DNS>:9090` | Unauthenticated (Lab open) | `/-/healthy` |
| **Alertmanager UI** | `monitoring` | **`9093`** | `http://<ALB_WORKLOAD_DNS>:9093` | Unauthenticated (Lab open) | `/-/healthy` |
| **JavaMelody Collector UI** | `javamelody` | **`8081`** | `http://<ALB_WORKLOAD_DNS>:8081` | Unauthenticated (Lab open) | `/` |
| **ShopNow Frontend (React)** | `shopnow` | **`8082`** | `http://<ALB_WORKLOAD_DNS>:8082` | Public Web (Guest & Authenticated) | `/` |
| **ShopNow API Gateway** | `shopnow` | **`5860`** | `http://<ALB_WORKLOAD_DNS>:5860` | JWT Bearer Token (Keycloak) / GET `/product` open | `/actuator/health` |
| **Product Service (Direct)** | `shopnow` | **`5861`** | `http://<ALB_WORKLOAD_DNS>:5861` | Internal API / Public via Ingress | `/` |
| **Shopping Cart Service** | `shopnow` | **`5863`** | `http://<ALB_WORKLOAD_DNS>:5863` | Internal API / Public via Ingress | `/` |
| **User Service** | `shopnow` | **`5865`** | `http://<ALB_WORKLOAD_DNS>:5865` | Internal API / Public via Ingress | `/` |
| **Rancher Server Web UI** | `cattle-system` | **`8443`** | `https://localhost:8443` *(Port-forward)* | `admin` / Initial bootstrap password *(Port-forward required due to `Secure` cookie)* | `/healthz` |

> [!NOTE]
> Command to retrieve initial ArgoCD password:
> ```bash
> kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
> ```

---

## 3. Deployment Sequence on `eks-observability`

Configure your context:
```bash
aws eks update-kubeconfig --name eks-observability --region ap-northeast-1 --profile eks-core --alias eks-observability
kubectl config use-context eks-observability
```

### Step 1 — AWS Load Balancer Controller & StorageClass
```bash
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  -f platform/observability/aws-load-balancer-controller/values.yaml \
  --wait

kubectl apply -f platform/observability/storage/storageclass-gp3.yaml
```

### Step 2 — Mimir Distributed & Loki
```bash
# Mimir Distributed (Metrics in S3)
helm upgrade --install mimir grafana/mimir-distributed --version 6.1.0 \
  --namespace monitoring --create-namespace \
  -f platform/observability/mimir/values.yaml \
  --wait

# Loki (Logs in S3)
helm upgrade --install loki grafana/loki --version 7.3.0 \
  --namespace monitoring \
  -f platform/observability/loki/values.yaml \
  --wait
```

### Step 3 — Internal Ingress & Grafana Web UI
```bash
# Apply Internal Ingress for Mimir (9009) & Loki (3100)
kubectl apply -f platform/observability/ingress/internal-ingress.yaml

# Install Grafana Dashboard
helm upgrade --install grafana grafana/grafana --version 10.5.15 \
  --namespace monitoring \
  -f platform/observability/grafana/values.yaml \
  --wait

# Deploy Public Ingress for Grafana
kubectl apply -f platform/observability/ingress/grafana-ingress.yaml
```

Fetch the Grafana Public ALB DNS:
```bash
ALB_OBSERVABILITY_DNS=$(kubectl get ingress -n monitoring grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Grafana Public URL: http://${ALB_OBSERVABILITY_DNS}"
```

#### 📋 Access Table for Observability Components (`eks-observability`):

| Component | Load Balancer Scheme | Port | Target Endpoint & Protocol | Intended Consumers | Authentication |
|---|---|---|---|---|---|
| **Grafana Dashboard** | Public ALB | **`80`** (HTTP) | `http://<ALB_OBSERVABILITY_DNS>` | Platform Engineers & Developers | `admin` / Password in Secret `grafana` |
| **Mimir Push Endpoint** | Internal ALB | **`9009`** (HTTPS) | `https://mimir.observability.internal:9009/api/v1/push` | Prometheus Agent (`eks-workload`) | Header `X-Scope-OrgID: eks-workload` + TLS Cert |
| **Loki Push Endpoint** | Internal ALB | **`3100`** (HTTPS) | `https://loki.observability.internal:3100/loki/api/v1/push` | Grafana Alloy (`eks-workload`) | TLS Private CA Certificate |

> [!NOTE]
> Command to retrieve initial Grafana password:
> ```bash
> kubectl -n monitoring get secret grafana -o jsonpath="{.data.admin-password}" | base64 -d && echo
> ```

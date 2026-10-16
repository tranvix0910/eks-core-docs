# Blue-Green Deployment with Argo Rollouts — ShopNow Frontend

Comprehensive technical guide on implementing Blue-Green deployments for `shopnow-frontend` using **Argo Rollouts v1.9.0**, dual-service routing (`activeService` vs `previewService`), ArgoCD UI extension integration, and automated traffic switching.

---

## 1. Responsibilities: ArgoCD vs Argo Rollouts

* **ArgoCD**: GitOps synchronization engine. Ensures that the desired Git state matches the Kubernetes cluster state.
* **Argo Rollouts**: Advanced deployment controller replacing standard Kubernetes `Deployments`. Manages fine-grained Blue-Green transitions, preview testing, and zero-downtime traffic switching.

---

## 2. Blue-Green Strategy & Dual-Service Routing

Defined in [apps/shopnow-frontend-config/rollout.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/apps/shopnow-frontend-config/rollout.yaml):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: shopnow-frontend-rollout
  namespace: shopnow
spec:
  replicas: 2
  strategy:
    blueGreen:
      activeService: shopnow-frontend-service # Serves production users (Port 8082)
      previewService: shopnow-frontend-preview-service # Serves QA/Dev preview (Port 8085)
      autoPromotionEnabled: false # Requires manual approval or automated analysis
      scaleDownDelaySeconds: 30 # Keeps old Blue pods alive for 30s for zero-downtime draining
```

---

## 3. Second-by-Second Traffic Switching Timeline

```
T0:  Active (Blue v1.0.1) receives 100% user traffic via shopnow-frontend-service.
T1:  Git commit updates image to v1.0.2 -> Argo Rollouts provisions Green Pods.
T2:  Green Pods pass readiness probes -> Attached to shopnow-frontend-preview-service.
T3:  Engineers verify new release via Preview URL.
T4:  Engineer clicks "Promote" (or runs `kubectl argo rollouts promote ...`).
T5:  Argo Rollouts instantly switches selector on shopnow-frontend-service to Green.
T6:  AWS ALB registers new Green Pods instantly (target-type: ip).
T7:  30-second drain delay expires -> Old Blue Pods terminated safely.
```

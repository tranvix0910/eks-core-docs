---
title: "Extension - Release the frontend with blue-green deployments"
---

# Test a version before switching users

ArgoCD synchronizes desired state from Git. Argo Rollouts manages active/preview ReplicaSets and promotion timing. Install the Rollouts controller and CRD before syncing the frontend.

## 1. Inspect the current rollout

```bash
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -o yaml
kubectl --context eks-workload -n shopnow get svc shopnow-frontend-service shopnow-frontend-preview-service -o yaml
```

`activeService` serves users; `previewService` targets the version under test. `autoPromotionEnabled=false` provides a manual gate. `scaleDownDelaySeconds=30` retains the previous version briefly after promotion; it does not guarantee instant rollback indefinitely.

## 2. Deliver a new version through ArgoCD

Use a new tag, build/push the frontend, update the Application/values ArgoCD reads, and sync. Do not reuse one tag with `IfNotPresent` to demonstrate a new release.

```bash
argocd app get shopnow-frontend
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -w
```

## 3. Verify preview

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-frontend-preview-service 8083:80
```

Open `http://localhost:8083` and check UI/API URL, product listing, login, and cart operations using synthetic data. Preview port-forward does not change the API URL already baked into the image.

## 4. Promote or roll back

With a compatible `kubectl argo rollouts` plugin:

```bash
kubectl --context eks-workload argo rollouts get rollout shopnow-frontend-rollout -n shopnow
kubectl --context eks-workload argo rollouts promote shopnow-frontend-rollout -n shopnow
```

You can also use ArgoCD's promote action if supported by the extension/controller. Verify the active selector and actual requests after promotion.

For durable rollback, revert the image tag/commit in Git and sync. `argo rollouts undo` is an incident response operation; self-heal can restore the desired image if Git is unchanged. Blue-green switches active versions rather than providing weighted 10/90 canary routing.

**Evidence:** commits/tags before and after, working preview, active selector change after promotion, and successful rollback to the intended version.

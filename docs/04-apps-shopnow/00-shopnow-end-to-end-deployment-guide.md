---
title: "Step 6 - Deploy microservices through ArgoCD"
---

# Deploy ShopNow on the mixed node pool

**Input:** both clusters; ArgoCD; Ready NodePools; `efs-sc`; seven ECR images with a common tag; code/values pushed to the revision ArgoCD reads. TLS/telemetry can be completed after application deployment, but workshop acceptance remains incomplete until that path works.

## 1. Prepare configuration sources

Read the [image build lab](04-docker-build-multi-arch-and-ci.md) if images are missing. This repository has six backend charts and one frontend chart; do not deploy application Deployments outside ArgoCD with `kubectl apply`.

`examples/workshop/workload-values.yaml` enables EFS for every backend, selects the mixed pool, and configures two replicas and a PDB. `discovery-values.yaml` keeps Eureka at one replica because peer replication is not configured; report this exception rather than treating two independent registries as HA.

Review your changes, then commit/push the required configuration files. Do not use `git add .` in a checkout containing certificates/state/plans. ArgoCD reads remote content only; the Application renderer does not push automatically.

## 2. Render environment-specific Applications

```bash
bash examples/workshop/prepare-applications.sh
```

The script writes only `.workshop/applications` and does not apply anything. It uses `WORKSHOP_REPO_URL`, `WORKSHOP_REVISION`, `AWS_ACCOUNT_ID`, `AWS_REGION`, and `IMAGE_TAG`; preserves monorepo paths; and adds workshop values. Private repositories need credentials configured through your team's ArgoCD mechanism, never a token embedded in repoURL.

Review rendered files, especially `repoURL`, `targetRevision`, `valueFiles`, `image.repository`, `image.tag`, project, and destination. Do not let legacy CI update a separate configuration repository while Applications read this monorepo.

## 3. Create the AppProject and sign in

```bash
kubectl --context eks-workload apply -f platform/addons/argocd/appproject-shopnow.yaml
kubectl --context eks-workload -n argocd port-forward svc/argocd-server 8080:80
```

In another terminal:

```bash
argocd login localhost:8080 --plaintext
```

Use your own credentials. The current AppProject permits `sourceRepos: '*'`; narrow that to the workshop repository before sharing the environment. It permits namespace `shopnow` and selected resource groups. A fork must be included in allowed source repositories.

## 4. Deploy databases first

```bash
kubectl --context eks-workload apply -f .workshop/applications/shopnow-database-services.yaml
argocd app wait shopnow-database-services --sync --health --timeout 900
kubectl --context eks-workload -n shopnow get deployment,pods,pvc
```

PostgreSQL, MySQL, and Keycloak must be Ready, with database gp3 PVCs Bound. Single-replica databases use On-Demand/EBS; EFS serves microservice directories. Sample credentials are for synthetic data only; replace them with Secrets before using a shared environment with real data.

## 5. Config and discovery

```bash
kubectl --context eks-workload apply -f .workshop/applications/shopnow-discovery-server.yaml
kubectl --context eks-workload apply -f .workshop/applications/shopnow-config-server.yaml
argocd app wait shopnow-discovery-server --sync --health --timeout 900
argocd app wait shopnow-config-server --sync --health --timeout 900
```

Wait for foundational backends to become Healthy before API deployment. Sync-wave annotations on independent Applications do not replace these gates.

## 6. Four API backends

```bash
kubectl --context eks-workload apply -f .workshop/applications/shopnow-product-service.yaml
kubectl --context eks-workload apply -f .workshop/applications/shopnow-cart-service.yaml
kubectl --context eks-workload apply -f .workshop/applications/shopnow-user-service.yaml
kubectl --context eks-workload apply -f .workshop/applications/shopnow-api-gateway.yaml
argocd app wait shopnow-product-service --sync --health --timeout 900
argocd app wait shopnow-cart-service --sync --health --timeout 900
argocd app wait shopnow-user-service --sync --health --timeout 900
argocd app wait shopnow-api-gateway --sync --health --timeout 900
```

The cart Application name differs from its Deployment's `global.appName`: `shopnow-cart-service` creates `shopnow-shopping-cart-service-deployment`. Use the correct name for rollout/HPA inspection.

## 7. Frontend

```bash
kubectl --context eks-workload apply -f .workshop/applications/shopnow-frontend.yaml
argocd app get shopnow-frontend
kubectl --context eks-workload -n shopnow get rollouts
```

The frontend uses blue-green Rollout with `autoPromotionEnabled=false`. A valid update may be paused awaiting promotion; follow the [blue-green lab](03-blue-green-argo-rollouts.md) instead of manually changing replicas to force a green status.

## 8. Verify functionality and placement

```bash
kubectl --context eks-workload -n shopnow get pods -o wide
kubectl --context eks-workload get nodes -L workload,capacity,role,karpenter.sh/capacity-type
kubectl --context eks-workload -n shopnow get pvc,pdb
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-api-gateway-service 5860:5860
```

In another terminal, run `curl -f http://localhost:5860/product`. An empty array `[]` is valid if no products have been seeded. Access the frontend with `svc/shopnow-frontend-service 8082:80` port-forward; the browser must reach the API URL baked into its image.

**Pass:** Applications sync the intended commit, backend Pods are Ready on the mixed pool, every backend has an EFS PVC, and the frontend calls the API. Continue with EFS/placement/PDB tests to prove the requirements rather than relying on Pod status.

## 9. Managing changes

Edit the chart/values in the repository the Application actually reads → render → commit/push → ArgoCD diff/sync → verify behavior. `selfHeal` can revert kubectl changes to managed resources. When updating image settings in rendered Applications, render again and apply the relevant Application. In this bootstrap procedure, the operator owns Application specs; editing a local file does not automatically update them.

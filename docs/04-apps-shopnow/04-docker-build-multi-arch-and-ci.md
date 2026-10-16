---
title: "Step 3.1 — Build the ShopNow images and push them to ECR"
sidebar_label: "3.1 Build images"
---

# Step 3.1 — Build the ShopNow images and push them to ECR

:::info Step summary
**Goal:** seven images in ECR, all tagged `$IMAGE_TAG`.
**Time:** about 20 minutes (Maven and npm builds). **Run from:** `$APPS_DIR` (`eks-core-apps`).
:::

## What gets built

| Image (`shopnow/…`) | Source directory | Stack |
|---|---|---|
| `shopnow-frontend` | `shopnow-frontend` | React, served by Nginx |
| `shopnow-api-gateway` | `shopnow-backend/api-gateway` | Spring Cloud Gateway |
| `shopnow-config-server` | `shopnow-config-server` | Spring Cloud Config |
| `shopnow-discovery-server` | `shopnow-discovery-server` | Eureka |
| `shopnow-product-service` | `shopnow-product-service` | Spring Boot + PostgreSQL |
| `shopnow-shopping-cart-service` | `shopnow-shopping-cart-service` | Spring Boot + PostgreSQL |
| `shopnow-user-service` | `shopnow-user-service` | Spring Boot + Keycloak |

## 1. Set the build variables

```bash
export IMAGE_TAG=workshop-v1
export REACT_APP_BASE_API_URL=http://localhost:5860   # API URL the browser will call
export WORKSHOP_PLATFORMS=linux/amd64                 # pool 2 runs amd64 nodes
```

`REACT_APP_BASE_API_URL` is compiled into the frontend JavaScript at build time. `http://localhost:5860` works with the port-forward used in [step 3.2](shopnow-end-to-end-deployment-guide). If you later expose the API through a load balancer or domain, rebuild the frontend with that URL.

On an Apple Silicon Mac, keep `linux/amd64`: building without a platform produces ARM64 images that will not start on pool 2.

## 2. Build and push

```bash
cd "$APPS_DIR"
bash scripts/build-images.sh
```

The script logs in to ECR, then runs `docker buildx build --push` for each image with the tag `$IMAGE_TAG`.

## Verify

```bash
for repo in frontend api-gateway config-server discovery-server product-service shopping-cart-service user-service; do
  aws ecr describe-images --repository-name "shopnow/shopnow-$repo" --image-ids imageTag="$IMAGE_TAG" \
    --query 'imageDetails[0].[repositoryName,imageTags[0],imagePushedAt]' --output text
done | tee "$EVIDENCE_DIR/images.txt"

docker buildx imagetools inspect \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow/shopnow-product-service:$IMAGE_TAG"
```

**Expected:** seven lines, one per repository, and the manifest shows `linux/amd64`.

| Symptom | Fix |
|---|---|
| `no basic auth credentials` | ECR login expired — rerun the script |
| `RepositoryNotFoundException` | ECR repositories come from layer 20; check `ecr_repository_names` in its tfvars and apply |
| Pods later fail with `exec format error` | Image built for the wrong architecture; rebuild with `WORKSHOP_PLATFORMS=linux/amd64` |

## Releasing a new version later

Use a new tag for every release, for example `export IMAGE_TAG=workshop-v2`, rebuild, then render and apply the Applications again ([step 3.2](shopnow-end-to-end-deployment-guide), section 2). Never reuse a tag for different code; ArgoCD and Kubernetes cannot tell the images apart.

**Next:** [3.2 Deploy with ArgoCD](shopnow-end-to-end-deployment-guide)

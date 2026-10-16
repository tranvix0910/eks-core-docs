---
title: "Build images, push to ECR, and update GitOps"
---

# Build all images before creating Applications

## 1. Choose a browser-reachable API URL

For port-forward access in the workshop:

```bash
export IMAGE_TAG=workshop-v1
export REACT_APP_BASE_API_URL=http://localhost:5860
export WORKSHOP_PLATFORMS=linux/amd64
```

Create React App substitutes `REACT_APP_*` values **at build time**. Setting them in a Deployment or Nginx runtime environment does not modify built JavaScript. For ALB/custom-domain access, use that API endpoint and rebuild. On someone else's machine, `localhost` refers to their machine; they also need port-forward or a shared endpoint.

## 2. Build/push seven images

ECR repositories must already exist from Layer 20. Verify account/profile, then run:

```bash
aws sts get-caller-identity
terraform -chdir=20-cluster-workload output -json ecr_repository_urls
bash scripts/build-images.sh
```

The script uses the correct contexts for six backends and the frontend, tags from environment variables, and ECR password-stdin login. It performs real builds/pushes; do not run it merely to inspect configuration.

## 3. Verify images and architectures

```bash
aws ecr describe-images --repository-name shopnow/shopnow-product-service \
  --image-ids "imageTag=$IMAGE_TAG" --query 'imageDetails[].{Digest:imageDigest,Tags:imageTags}'
docker buildx imagetools inspect \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow/shopnow-product-service:$IMAGE_TAG"
```

Mixed nodes currently require amd64. On Apple Silicon, `--platform linux/amd64` avoids producing an ARM64-only image. For multi-architecture builds, set `WORKSHOP_PLATFORMS=linux/amd64,linux/arm64` and verify **both** platforms in the manifest list. Building a single platform is not a multi-architecture build.

## 4. Keep CI/CD consistent

Source commit → build/test → image tag/digest → ECR push → GitOps commit → ArgoCD sync → smoke test. Legacy `buildspec.yml` files still clone separate configuration repositories, skip tests, and omit the frontend build argument. Update them before using them as the current monorepo's pipeline.

A health-check command ending with `|| echo "Health check failed"` is not a quality gate: it can still let the pipeline succeed. Health/test gates must return a failure exit code and block GitOps updates.

After building, run the Application preparation script in the [deployment lab](00-shopnow-end-to-end-deployment-guide.md). Do not update tags in a repository ArgoCD does not read.

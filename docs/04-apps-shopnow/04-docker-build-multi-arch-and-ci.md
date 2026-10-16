# Multi-Architecture Docker Builds & React Crash Fix

Technical guide on building cross-platform container images with `docker buildx` on Apple Silicon Macs, injecting build arguments (`REACT_APP_BASE_API_URL`), and resolving the React runtime crash.

---

## 1. Multi-Arch Build Workflow (`linux/amd64`)

EKS workload nodes run on x86_64 (`amd64`). Developing on Apple Silicon Macs (ARM64) requires cross-compilation with `docker buildx`:

```bash
docker buildx build \
  --platform linux/amd64 \
  --build-arg REACT_APP_BASE_API_URL="http://<ALB_WORKLOAD_DNS>:5860" \
  -t <AWS_ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/shopnow/shopnow-frontend:v1.0.2_a48660f \
  --push .
```

---

## 2. Root-Cause Analysis: React Home Crash (`TypeError: n.map is not a function`)

### The Problem:
When accessing the frontend web UI, the home page crashed with a blank white screen and browser console error:
`TypeError: n.map is not a function`.

### The Root Cause:
* Create React App bakes environment variables (`REACT_APP_*`) into static JavaScript bundles **AT BUILD TIME**, not runtime.
* Because the container image was built without passing `REACT_APP_BASE_API_URL`, the frontend sent API calls to `undefined/product`, which failed and caused React's array mapping function to fail on `undefined`.

### The Permanent Fix:
Pass `--build-arg REACT_APP_BASE_API_URL="http://<ALB_DNS>:5860"` during `docker buildx`, ensuring API requests target the Spring Cloud Gateway correctly.

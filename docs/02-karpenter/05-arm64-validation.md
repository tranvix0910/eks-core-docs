---
title: "Step 2.4 — Run a workload on the ARM64 pool"
sidebar_label: "2.4 ARM64 pool"
---

# Step 2.4 — Run a workload on the ARM64 pool

:::info Step summary
**Goal:** prove pool 3 launches Graviton (ARM64) nodes and runs containers on them.
**Requirement:** 2 (ARM64 pool). **Time:** about 10 minutes. **Run from:** `$GITOPS_DIR`.
:::

## How a Pod reaches pool 3

`examples/workshop/arm64-proof.yaml` runs `busybox`, which is published for both amd64 and arm64. Its Pod spec:

```yaml
nodeSelector:
  arch: arm64                     # label set by NodePool arm64
  kubernetes.io/arch: arm64
tolerations:
  - key: arch
    operator: Equal
    value: arm64
    effect: NoSchedule            # taint set by NodePool arm64
```

An image must contain an `linux/arm64` variant to run here. A selector cannot turn an amd64-only image into an ARM64 one — you would get `exec format error`.

## 1. Check the image supports ARM64

```bash
docker buildx imagetools inspect public.ecr.aws/docker/library/busybox:1.37.0 | grep -E 'Platform: +linux/(amd64|arm64)'
```

## 2. Run the test workload

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/examples/workshop/arm64-proof.yaml"
kubectl --context eks-workload rollout status deployment/workshop-arm64 --timeout=10m
```

## Verify

```bash
kubectl --context eks-workload get pods -l app=workshop-arm64 -o wide
kubectl --context eks-workload get nodes -l karpenter.sh/nodepool=arm64 \
  -L kubernetes.io/arch,karpenter.sh/capacity-type,node.kubernetes.io/instance-type
kubectl --context eks-workload logs deployment/workshop-arm64
```

**Expected:** the Pod runs on a node from NodePool `arm64` with `kubernetes.io/arch=arm64` (a Graviton type such as `m7g` or `c7g`), and the log shows `aarch64`.

## 3. Clean up

```bash
kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/arm64-proof.yaml"
```

To move a real service to ARM64, build it for both platforms (`WORKSHOP_PLATFORMS=linux/amd64,linux/arm64` in [step 3.1](../apps-shopnow/docker-build-multi-arch-and-ci)) and give it the selector and toleration above. The project app stays on pool 2, as the assignment requires.

**Next:** [2.5 Kite dashboard](../platform-addons/kite-dashboard)

---
title: "Bước 2.4 — Test ARM64 Pool"
sidebar_label: "2.4 ARM64"
---

# Bước 2.4 — Test ARM64 Pool {#step-24--run-a-workload-on-the-arm64-pool}

:::info Nội dung thực hiện
**Mục tiêu:** tạo node Graviton và chạy Container ARM64 trên NodePool `arm64`.
**Yêu cầu:** 2 (pool ARM64). **Thời gian:** khoảng 10 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Node Selector cho ARM64 {#how-a-pod-reaches-pool-3}

`examples/workshop/arm64-proof.yaml` chạy `busybox`, được phát hành cho cả amd64 và arm64. Pod spec:

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

Image cần hỗ trợ `linux/arm64`. Nếu image chỉ có `amd64`, Container có thể lỗi `exec format error` dù Node Selector đã chọn đúng node.

## 1. Kiểm tra image hỗ trợ ARM64 {#1-check-the-image-supports-arm64}

```bash
docker buildx imagetools inspect public.ecr.aws/docker/library/busybox:1.37.0 | grep -E 'Platform: +linux/(amd64|arm64)'
```

## 2. Deploy Workload ARM64 {#2-run-the-test-workload}

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/examples/workshop/arm64-proof.yaml"
kubectl --context eks-workload rollout status deployment/workshop-arm64 --timeout=10m
```

## Kiểm tra kết quả {#verify}

```bash
kubectl --context eks-workload get pods -l app=workshop-arm64 -o wide
kubectl --context eks-workload get nodes -l karpenter.sh/nodepool=arm64 \
  -L kubernetes.io/arch,karpenter.sh/capacity-type,node.kubernetes.io/instance-type
kubectl --context eks-workload logs deployment/workshop-arm64 | tee "$EVIDENCE_DIR/pool3-arm64.txt"
```

**Kết quả cần có:** Pod chạy trên node thuộc NodePool `arm64`, có `kubernetes.io/arch=arm64`, dùng loại Graviton như `m7g` hoặc `c7g`; log hiển thị `aarch64`.

## 3. Cleanup {#3-clean-up}

```bash
kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/arm64-proof.yaml"
```

Để chuyển service thực tế sang ARM64, build cho cả hai nền tảng (`WORKSHOP_PLATFORMS=linux/amd64,linux/arm64` tại [bước 3.1](../apps-shopnow/docker-build-multi-arch-and-ci)), rồi cấu hình selector và toleration như trên. ShopNow vẫn ở pool 2 theo đề bài.

**Tiếp theo:** [2.5 Kite dashboard](../platform-addons/kite-dashboard)

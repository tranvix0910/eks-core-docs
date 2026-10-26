---
title: "Phần 2 — Cấu hình workload cluster"
sidebar_label: "2 · Cấu hình workload cluster"
---

# Phần 2 — Cấu hình workload cluster {#part-2--platform-on-cluster-1}

Khi cluster đã sẵn sàng, chúng ta kiểm tra các công cụ trên node group infra, cài thêm các add-on còn lại và tạo ba nhóm node Karpenter mà ứng dụng sẽ sử dụng.

## Nội dung {#contents}

1. [Các công cụ trên cluster](../platform-addons/gitops-bootstrap-order)
2. [Karpenter NodePools](../karpenter/ec2nodeclass-and-nodepools-configuration)
3. [Mixed pool 1:3](../karpenter/on-demand-spot-ratio-and-limits)
4. [ARM64](../karpenter/arm64-validation)
5. [Kite dashboard](../platform-addons/kite-dashboard)

**Kết quả sau phần này:** Công cụ vận hành chạy trên node `role=infra`; pool Spot, mixed và ARM64 sẵn sàng.

---
title: "Phần 1 — Hạ tầng với Terraform"
sidebar_label: "1 · Hạ tầng với Terraform"
---

# Phần 1 — Hạ tầng với Terraform {#part-1--infrastructure-with-terraform}

Terraform tạo network và hai EKS cluster theo ba layer, mỗi layer có state riêng. Chúng ta apply lần lượt network, workload cluster, observability cluster, rồi hoàn tất workload cluster.

## Nội dung {#contents}

1. [Cấu trúc Terraform](../architecture/terraform-workflow)
2. [Network](../architecture/layer-10-network)
3. [Cluster 1 · Workload](../architecture/layer-20-cluster-workload)
4. [Cluster 2 · Observability](../architecture/layer-21-cluster-observability)

**Kết quả sau phần này:** Hai cluster `eks-workload` và `eks-observability` đang chạy, các platform chart do Terraform cài đã sẵn sàng.

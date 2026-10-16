---
title: "Bước 5.1 — Checklist nghiệm thu"
sidebar_label: "5.1 Checklist nghiệm thu"
---

# Bước 5.1 — Checklist nghiệm thu {#step-51--acceptance-checklist}

:::info Tóm tắt bước thực hành
**Mục tiêu:** một bảng chứng minh từng yêu cầu được đáp ứng, kèm tệp bằng chứng đã lưu trong `$EVIDENCE_DIR`.
**Thời gian:** khoảng 20 phút.
:::

Đánh dấu mỗi dòng **Đạt**, **Không đạt** hoặc **Chưa thử**. Chỉ có tệp cấu hình chưa phải bằng chứng; cần output lệnh tương ứng.

| # | Yêu cầu | Kiểm tra (lệnh hoặc bước) | Đạt khi | Bằng chứng |
|---|---|---|---|---|
| — | Hai EKS cluster | `aws eks list-clusters` | Có `eks-workload` và `eks-observability`, trạng thái `ACTIVE` | Output |
| 1 | Công cụ hạ tầng trên Managed Node Group | [Kiểm chứng bước 2.1](../platform-addons/gitops-bootstrap-order#verify--every-tool-is-on-an-infra-node) | Prometheus, JavaMelody, Karpenter, ArgoCD đều trên `role=infra` | `infra-placement.txt` |
| 2a | Pool 1 — Spot | [Kiểm chứng bước 2.2](../karpenter/ec2nodeclass-and-nodepools-configuration#verify) | Pod thử trên `batch-spot`, `capacity-type=spot` | `pool1-spot.txt` |
| 2b | Pool 2 — 1 : 3 | [Kiểm chứng bước 2.3](../karpenter/on-demand-spot-ratio-and-limits#verify) | Bài thử có 1 node On-Demand + 3 Spot; đã khôi phục giới hạn 24 / 72 | `pool2-ratio-test.txt`, `pool2-capacity.txt` |
| 2c | Pool 3 — ARM64 | [Kiểm chứng bước 2.4](../karpenter/arm64-validation#verify) | Pod trên node `arm64`, log có `aarch64` | `pool3-arm64.txt` |
| 3 | Microservices trên pool 2 | [Kiểm chứng bước 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide#verify--microservices-on-pool-2-requirement-3) | Mọi backend Pod trên `ms-od` hoặc `ms-spot` | `pool2-placement.txt` |
| 4 | Persistent volume EFS | [Bước 3.3](../apps-shopnow/efs-persistent-volumes) | PVC RWX Bound; hai replica chia sẻ tệp; dữ liệu còn sau khi thay Pod | `efs-persistence.txt` |
| 5 | Phân bổ đều | [Bước 3.4](../apps-shopnow/pod-placement) | Mỗi service hai replica có `max-per-node=1` và hai zone | `placement.txt` |
| 6 | PodDisruptionBudget | [Bước 3.5](../apps-shopnow/availability-and-pdb) | Eviction bị chặn khi budget 0, được phép khi budget 1; API trả lời trong eviction | `pdb-refused.txt`, `pdb-allowed.txt`, `availability.txt` |
| 7 | Triển khai bằng ArgoCD | [Kiểm chứng bước 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide#verify--argocd-requirement-7) | Mọi Application `Synced` + `Healthy` | `argocd-apps.txt` |
| 8 | Observability tập trung | [Bước 1.3](../architecture/layer-21-cluster-observability) | Mimir, Loki, Grafana Ready trong cluster 2 | Ảnh chụp |
| 9a | Metrics chuyển sang cluster 2 | [Kiểm chứng bước 4.2](../observability/mimir-metrics-pipeline#verify--query-mimir-directly) | Mimir trả series `cluster="eks-workload"` | `mimir-query.txt` |
| 9b | Logs chuyển sang cluster 2 | [Kiểm chứng bước 4.3](../observability/loki-logging-pipeline#verify--query-loki-directly) | Loki trả dòng `workshop-proof` mới | `loki-query.txt` |

## Kịch bản demo (15 phút) {#demo-script-15-minutes}

1. Trình bày sơ đồ kiến trúc: hai cluster, infra node group, ba pool.
2. `kubectl get nodes -L role,karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch` — xem node infra và Karpenter cạnh nhau.
3. UI ArgoCD: mọi Application ShopNow xanh.
4. EFS: ghi tệp trong một Pod, đọc trong Pod khác.
5. Bảng placement: replica ở node và zone khác nhau.
6. PDB: eviction bị từ chối, sau đó được phép.
7. Grafana cluster 2: metric cluster 1 và dòng log mới.

## Giới hạn cần nêu rõ {#known-limits-to-state}

- Tỷ lệ 1:3 là ngân sách capacity 24 : 72 vCPU; khi ít tải, toàn bộ capacity có thể là On-Demand.
- Eureka và database chạy một replica mỗi thành phần, không có PDB.
- Mimir và Loki chạy một replica mỗi thành phần, chưa có HA.
- Công cụ quản trị truy cập qua port-forward và credentials demo.

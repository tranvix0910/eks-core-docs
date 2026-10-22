---
title: "Bước 5.1 — Checklist workshop"
sidebar_label: "5.1 Checklist workshop"
---

# Bước 5.1 — Checklist workshop {#step-51--acceptance-checklist}

Dùng checklist bên dưới để kiểm tra lại các phần đã triển khai. Mỗi mục có bài thực hành tương ứng và tên file để lưu output; mục chưa chạy thì ghi rõ là chưa thử.

**Thời gian:** khoảng 20 phút.

Chạy các bài kiểm tra rồi đánh dấu **Đạt**, **Không đạt** hoặc **Chưa thử**. Lưu output hoặc ảnh cho từng mục để có thể đối chiếu với cấu hình đã triển khai.

| # | Yêu cầu | Kiểm tra (lệnh hoặc bước) | Đạt khi | Kết quả kiểm tra |
|---|---|---|---|---|
| — | Hai EKS cluster | `aws eks list-clusters` | Có `eks-workload` và `eks-observability`, trạng thái `ACTIVE` | Output |
| 1 | công cụ vận hành trên Managed Node Group | [Kiểm tra bước 2.1](../platform-addons/gitops-bootstrap-order#verify--every-tool-is-on-an-infra-node) | Prometheus, JavaMelody, Karpenter, ArgoCD đều trên `role=infra` | `infra-placement.txt` |
| 2a | Pool 1 — Spot | [Kiểm tra bước 2.2](../karpenter/ec2nodeclass-and-nodepools-configuration#verify) | Pod thử trên `batch-spot`, `capacity-type=spot` | `pool1-spot.txt` |
| 2b | Pool 2 — 1 : 3 | [Kiểm tra bước 2.3](../karpenter/on-demand-spot-ratio-and-limits#verify) | Bài thử có 1 node On-Demand + 3 Spot; đã khôi phục giới hạn 24 / 72 | `pool2-ratio-test.txt`, `pool2-capacity.txt` |
| 2c | Pool 3 — ARM64 | [Kiểm tra bước 2.4](../karpenter/arm64-validation#verify) | Pod trên node `arm64`, log có `aarch64` | `pool3-arm64.txt` |
| 3 | microservices trên pool 2 | [Kiểm tra bước 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide#verify--microservices-on-pool-2-requirement-3) | Mọi backend Pod trên `ms-od` hoặc `ms-spot` | `pool2-placement.txt` |
| 4 | Persistent volume EFS | [Bước 3.3](../apps-shopnow/efs-persistent-volumes) | PVC RWX Bound; hai replica chia sẻ file; dữ liệu còn sau khi thay Pod | `efs-persistence.txt` |
| 5 | Phân bổ đều | [Bước 3.4](../apps-shopnow/pod-placement) | Mỗi service hai replica có `max-per-node=1` và hai zone | `placement.txt` |
| 6 | PodDisruptionBudget | [Bước 3.5](../apps-shopnow/availability-and-pdb) | eviction bị chặn khi budget 0, được phép khi budget 1; API trả lời trong eviction | `pdb-refused.txt`, `pdb-allowed.txt`, `availability.txt` |
| 7 | Triển khai bằng ArgoCD | [Kiểm tra bước 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide#verify--argocd-requirement-7) | Mọi Application `Synced` + `Healthy` | `argocd-apps.txt` |
| 8 | Observability tập trung | [Bước 1.3](../architecture/layer-21-cluster-observability) | Mimir, Loki, Grafana Ready trong cluster 2 | Ảnh chụp |
| 9a | Metrics chuyển sang cluster 2 | [Kiểm tra bước 4.2](../observability/mimir-metrics-pipeline#verify--query-mimir-directly) | Mimir trả series `cluster="eks-workload"` | `mimir-query.txt` |
| 9b | Logs chuyển sang cluster 2 | [Kiểm tra bước 4.3](../observability/loki-logging-pipeline#verify--query-loki-directly) | Loki trả dòng `workshop-proof` mới | `loki-query.txt` |

## Demo workshop (15 phút) {#demo-script-15-minutes}

1. Trình bày sơ đồ kiến trúc: hai cluster, infra node group, ba pool.
2. `kubectl get nodes -L role,karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch` — xem node infra và Karpenter cạnh nhau.
3. UI ArgoCD: mọi Application của ứng dụng đều Synced và Healthy.
4. EFS: ghi file trong một Pod, đọc trong Pod khác.
5. Bảng placement: replica ở node và zone khác nhau.
6. PDB: eviction bị từ chối, sau đó được phép.
7. Grafana cluster 2: metric cluster 1 và dòng log mới.

## Giới hạn của cấu hình workshop {#known-limits-to-state}

Khi trình bày kết quả, giải thích rằng tỷ lệ 1:3 đang dựa trên CPU limit 24:72 vCPU, không phải số node cố định ở mọi thời điểm. Eureka, database và mỗi thành phần Mimir/Loki hiện chỉ có một replica. Các công cụ quản trị dùng port-forward hoặc Ingress được giới hạn truy cập; credentials mẫu chỉ dùng cho lab.
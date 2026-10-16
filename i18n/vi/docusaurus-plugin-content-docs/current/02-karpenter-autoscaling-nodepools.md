---
title: "Karpenter — Ba nhóm node trong đề bài"
---

# Từ yêu cầu tài nguyên Pod đến node EC2 {#from-pod-resource-requirements-to-ec2-nodes}

Karpenter cấp capacity EC2 khi không có node phù hợp để chạy Pod, sau đó thu hồi capacity dư theo policy. Bạn khai báo **ràng buộc placement của workload**, thay vì danh sách máy cố định.

| Nhóm trong đề bài | Đối tượng Kubernetes | Workload |
|---|---|---|
| 1. Spot | `batch-spot` | Bài thử Spot/batch |
| 2. Kết hợp On-Demand và Spot | `ms-od` + `ms-spot` | Backend ShopNow và bài thử EFS/availability |
| 3. ARM64 | `arm64` | Bài thử image ARM64 |

Managed Node Group `infra` tách khỏi ba nhóm Karpenter, giữ controller hoạt động khi các pool động trống.

## Thứ tự thực hành {#lab-sequence}

1. [Hiểu tài nguyên AWS và controller](02-karpenter/01-karpenter-two-halves-architecture.md).
2. [Apply EC2NodeClass và NodePool](02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md).
3. [Đo tỷ lệ 1:3 và giới hạn của cách triển khai hiện tại](02-karpenter/03-on-demand-spot-ratio-and-limits.md).
4. [Kiểm tra disruption và xử lý Spot interruption](02-karpenter/04-disruption-and-spot-interruption.md).
5. [Chạy container ARM64](02-karpenter/05-arm64-validation.md).

Chỉ tạo CRD chưa đủ để nghiệm thu. Chạy thành công ít nhất một Pod trên mỗi nhóm với đúng capacity type/architecture. Với mixed pool, báo cáo cả tỷ lệ node lẫn vCPU vì hai tỷ lệ có thể khác nhau.

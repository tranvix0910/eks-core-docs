---
title: "Mở rộng: chọn cơ chế autoscaling phù hợp"
---

# Tách tăng replica khỏi cấp node {#separate-replica-scaling-from-node-provisioning}

Karpenter cấp capacity EC2. HPA, CPA và KEDA điều khiển số replica. Tăng replica không cần node mới nếu node hiện tại đủ tài nguyên.

| Cơ chế | Đầu vào | Target | Khi phù hợp |
|---|---|---|---|
| HPA | CPU, memory hoặc metric qua adapter | Deployment hoặc Rollout có scale subresource | Service có tải biến động |
| CPA | Số node hoặc core | Deployment nền tảng | CoreDNS khi cluster tăng quy mô |
| KEDA | Cron, queue, Prometheus và scaler khác | HPA do KEDA quản lý; hỗ trợ scale từ/về 0 | Workload theo sự kiện hoặc lịch hoạt động |
| Karpenter | Ràng buộc Pod và resource request | EC2 NodeClaim | Cấp capacity cho Pod Pending |

## Triển khai hiện tại {#current-implementation}

- Metrics Server do Terraform cài tại lớp 20 và được gán vào node infra.
- Có template HPA backend, mặc định tắt. Sửa tên target trước khi bật.
- Có manifest CPA và KEDA ScaledObject. Tệp tồn tại không chứng minh đã triển khai.
- KEDA hiện kết hợp cron với query CPU usage Prometheus, không query HTTP RPS từ Mimir như một số hướng dẫn cũ.

## Chọn cơ chế cho workshop {#choose-a-mechanism-for-the-workshop}

Hoàn tất bài cốt lõi với số replica ổn định trước. Sau đó thử CPU HPA trên một service, quan sát cả replica và node. Với lịch hoạt động hoặc nguồn sự kiện độc lập đánh thức service từ 0, dùng KEDA với event source phù hợp. Cân nhắc CPA khi capacity DNS cần theo quy mô cluster, bảo đảm không xung đột autoscaling hiện có.

Không gắn HPA thông thường và KEDA vào cùng target. Cấu hình ArgoCD để không liên tục reconcile `/spec/replicas` khi scaler quản lý trường đó. Giữ ít nhất hai replica Ready cho service đang thử availability.

Theo [runbook autoscaling](06-operations/04-workload-autoscaling-implementation-and-testing.md). Ghi số đo trước và trong khi có tải, thay vì chỉ dựa ảnh ScaledObject.

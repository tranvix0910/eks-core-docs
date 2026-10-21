---
title: "Mở rộng · workload autoscaling"
---

# HPA, CPA, KEDA và Karpenter {#separate-replica-scaling-from-node-provisioning}

Có hai việc khác nhau khi scale ứng dụng: tăng replica và thêm node để chạy các replica đó. HPA, CPA, KEDA điều chỉnh replica theo tín hiệu đã cấu hình; Karpenter cấp node khi Pod cần thêm capacity.

| Cơ chế | Đầu vào | Target | Khi phù hợp |
|---|---|---|---|
| HPA | CPU, memory hoặc metric qua adapter | Deployment hoặc Rollout có scale subresource | Service có tải biến động |
| CPA | Số node hoặc core | Deployment nền tảng | CoreDNS khi cluster tăng quy mô |
| KEDA | Cron, queue, Prometheus và scaler khác | HPA do KEDA quản lý; hỗ trợ scale từ/về 0 | Workload theo sự kiện hoặc lịch hoạt động |
| Karpenter | Ràng buộc Pod và resource request | EC2 NodeClaim | Cấp capacity cho Pod Pending |

## Cấu hình hiện tại {#current-implementation}

Metrics Server đã được Terraform cài ở layer 20 và chạy trên node `infra`. Các backend chart có template HPA nhưng mặc định tắt; cần sửa đúng tên target trước khi bật.

Repo cũng có manifest CPA và KEDA ScaledObject để làm bài mở rộng. Kiểm tra operator và các resource đã được cài trên cluster trước khi apply. ScaledObject hiện dùng cron cùng CPU usage từ Prometheus.

## Thực hiện Autoscaling Lab {#choose-a-mechanism-for-the-workshop}

Hoàn tất workshop với số replica ổn định, sau đó test CPU HPA trên một service và theo dõi replica cùng node. Dùng KEDA khi cần scale theo lịch hoặc Event Source có thể đánh thức service từ 0. Dùng CPA cho CoreDNS khi cần scale theo số node/core và chưa có autoscaler khác quản lý target đó.

Không gắn HPA thông thường và KEDA vào cùng target. Cấu hình ArgoCD để không liên tục reconcile `/spec/replicas` khi scaler quản lý trường đó. Giữ ít nhất hai replica Ready cho service đang thử availability.

Theo [runbook autoscaling](06-operations/04-workload-autoscaling-implementation-and-testing.md). Ghi số đo trước và trong khi có tải, thay vì chỉ dựa ảnh ScaledObject.

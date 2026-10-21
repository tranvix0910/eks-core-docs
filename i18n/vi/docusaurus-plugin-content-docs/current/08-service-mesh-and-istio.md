---
title: "Mở rộng · service mesh và Istio"
---

# Đánh giá service mesh {#evaluate-istio-after-completing-the-workshop}

Istio là phần mở rộng của workshop. Trước khi cài, hãy kiểm tra ShopNow đang hoạt động với Eureka, Spring Cloud Gateway và luồng metrics, logs hiện tại. Sau đó chọn một mục tiêu cụ thể để thử service mesh, chẳng hạn mTLS giữa hai service.

## Mục tiêu của service mesh {#define-the-benefit-before-installation}

- mTLS và service identity cho yêu cầu bảo mật east-west.
- Policy truy cập service-to-service ngoài logic gateway.
- Chia traffic và phân tích canary khi blue-green chưa đủ.
- Telemetry mạng nhất quán khi instrumentation ứng dụng chưa đồng đều.

Chọn một mục tiêu để thử trước, vì service mesh bổ sung control plane, proxy, certificate và policy cần quản lý. Ví dụ, bắt đầu bằng việc bật mTLS cho hai service rồi kiểm tra request và health check.

## Sidecar và Ambient {#compare-two-models}

| Mô hình | Data plane | Ảnh hưởng cần thử |
|---|---|---|
| Sidecar | Một proxy mỗi Pod | Tài nguyên theo Pod, lifecycle và restart, thứ tự khởi động |
| Ambient | Một ztunnel mỗi node, thêm waypoint cho L7 khi cần | Node lifecycle, CNI, waypoint policy, failure domain |

Chọn phiên bản Istio, kiểm tra support matrix và benchmark workload để so sánh latency, CPU, memory và tính năng cần dùng.

## Tích hợp với EKS Workshop {#interactions-with-the-existing-platform}

Eureka có thể trả về Pod IP thay vì Service DNS, nên cần kiểm tra routing và policy của mesh trên đúng đường request. Ban đầu giữ routing nghiệp vụ và JWT trong gateway để dễ đối chiếu. Khi bật mTLS bắt buộc, thử lại ALB health check và Prometheus scrape. Nếu dùng ambient, kiểm tra CNI và ztunnel trên cả node Karpenter mới tạo. Theo dõi thêm lượng metrics, logs để biết Mimir/Loki có cần tăng capacity không.

Tiếp tục gửi metrics và logs qua các endpoint nội bộ đã có. Chỉ triển khai multicluster mesh khi có yêu cầu kết nối service giữa các cluster cần thử riêng.

## Các bước thử và rollback {#trial-with-a-tested-rollback}

1. Chọn phiên bản và môi trường local hoặc namespace thử riêng; bắt đầu ngoài `shopnow`.
2. Tạo hai service thử, đo latency, CPU và memory trước khi cài.
3. Cài theo tài liệu chính thức của phiên bản đã chọn; kiểm tra tương thích VPC CNI.
4. Bật mTLS trong phạm vi thử, xác minh identity và traffic qua telemetry; thử client ngoài mesh và health check.
5. Thử thay node Karpenter, restart Pod và mất control plane.
6. Chỉ thêm L7 policy, waypoint hoặc canary routing cho use case rõ ràng sau khi kiểm tra trước đã đạt.
7. Ghi quy trình rollback enrollment, policy và controller; đo lại kết nối sau rollback.

## Điều kiện bổ sung vào workshop {#criteria-for-inclusion-in-the-core-workshop}

Chỉ bổ sung vào luồng chính khi có mục tiêu đo được, manifest và phiên bản cố định, rollback đã test và toàn bộ checklist workshop vẫn đạt.

Tham khảo: [Istio ambient getting started](https://istio.io/latest/docs/ambient/getting-started/). Với sidecar, dùng tài liệu cùng phiên bản, thử riêng health và startup. Kiểm tra riêng hành vi của sidecar thay vì dùng nguyên cấu hình ambient.

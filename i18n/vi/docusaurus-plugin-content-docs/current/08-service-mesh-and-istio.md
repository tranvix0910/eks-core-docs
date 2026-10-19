---
title: "Mở rộng · Service Mesh và Istio"
---

# Đánh giá Service Mesh {#evaluate-istio-after-completing-the-workshop}

Service Mesh là phần mở rộng. Hoàn tất Eureka, Spring Cloud Gateway, Karpenter, EFS, PDB và Telemetry trước khi test Istio.

## Mục tiêu của Service Mesh {#define-the-benefit-before-installation}

- mTLS và service identity cho yêu cầu bảo mật east-west.
- Policy truy cập service-to-service ngoài logic gateway.
- Chia traffic và phân tích canary khi blue-green chưa đủ.
- Telemetry mạng nhất quán khi instrumentation ứng dụng chưa đồng đều.

Chọn mục tiêu cần test trước khi cài, vì Mesh bổ sung Control Plane, Proxy, Certificate và Policy cần vận hành.

## Sidecar và Ambient {#compare-two-models}

| Mô hình | Data plane | Ảnh hưởng cần thử |
|---|---|---|
| Sidecar | Một proxy mỗi Pod | Tài nguyên theo Pod, lifecycle và restart, thứ tự khởi động |
| Ambient | Một ztunnel mỗi node, thêm waypoint cho L7 khi cần | Node lifecycle, CNI, waypoint policy, failure domain |

Chọn phiên bản Istio, kiểm tra Support Matrix và Benchmark workload để so sánh latency, CPU, memory và tính năng cần dùng.

## Tích hợp với EKS Workshop {#interactions-with-the-existing-platform}

Eureka có thể đưa ứng dụng tới Pod IP thay Service DNS; kiểm tra policy định tuyến mesh hoạt động đúng mong muốn. Ban đầu giữ business routing và JWT trong gateway. ALB health check và Prometheus scrape có thể cần ngoại lệ policy khi áp dụng mTLS bắt buộc. Karpenter liên tục tạo node thay thế, nên CNI và ztunnel phải sẵn sàng đúng thứ tự. Metric/log cardinality tăng có thể đòi thêm capacity Mimir/Loki.

Giữ endpoint remote_write và log push nội bộ hiện có cho telemetry xuyên cluster. Multicluster mesh cần use case riêng.

## Các bước Test và Rollback {#trial-with-a-tested-rollback}

1. Chọn phiên bản và môi trường local hoặc namespace thử riêng; bắt đầu ngoài `shopnow`.
2. Tạo hai service thử, đo latency, CPU và memory trước khi cài.
3. Cài theo tài liệu chính thức của phiên bản đã chọn; kiểm tra tương thích VPC CNI.
4. Bật mTLS trong phạm vi thử, xác minh identity và traffic qua telemetry; thử client ngoài mesh và health check.
5. Thử thay node Karpenter, restart Pod và mất control plane.
6. Chỉ thêm L7 policy, waypoint hoặc canary routing cho use case rõ ràng sau khi kiểm tra trước đã đạt.
7. Ghi quy trình rollback enrollment, policy và controller; đo lại kết nối sau rollback.

## Điều kiện bổ sung vào Workshop {#criteria-for-inclusion-in-the-core-workshop}

Chỉ bổ sung vào luồng chính khi có mục tiêu đo được, manifest và phiên bản cố định, Rollback đã test và toàn bộ checklist workshop vẫn đạt.

Tham khảo: [Istio ambient getting started](https://istio.io/latest/docs/ambient/getting-started/). Với sidecar, dùng tài liệu cùng phiên bản, thử riêng health và startup. Giả định ambient không tự áp dụng cho sidecar.

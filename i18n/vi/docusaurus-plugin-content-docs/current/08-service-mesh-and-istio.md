---
title: "Mở rộng: khi nào nên thêm service mesh"
---

# Đánh giá Istio sau khi hoàn tất workshop {#evaluate-istio-after-completing-the-workshop}

Yêu cầu cốt lõi không có service mesh. Kiểm chứng Eureka, Spring Cloud Gateway, Karpenter, EFS, PDB và telemetry trước khi thêm lớp network khác.

## Xác định lợi ích trước khi cài {#define-the-benefit-before-installation}

- mTLS và service identity cho yêu cầu bảo mật east-west.
- Policy truy cập service-to-service ngoài logic gateway.
- Chia traffic và phân tích canary khi blue-green chưa đủ.
- Telemetry mạng nhất quán khi instrumentation ứng dụng chưa đồng đều.

Mesh thêm control plane, proxy, vận hành chứng chỉ và policy. Chỉ áp dụng khi các khả năng này giải quyết yêu cầu cụ thể.

## So sánh hai mô hình {#compare-two-models}

| Mô hình | Data plane | Ảnh hưởng cần thử |
|---|---|---|
| Sidecar | Một proxy mỗi Pod | Tài nguyên theo Pod, lifecycle và restart, thứ tự khởi động |
| Ambient | Một ztunnel mỗi node, thêm waypoint cho L7 khi cần | Node lifecycle, CNI, waypoint policy, failure domain |

Hướng dẫn không mặc định độ trễ, bộ nhớ hoặc độ trưởng thành tính năng theo một năm cụ thể. Chọn phiên bản, đọc support matrix và benchmark workload trước khi quyết định.

## Tương tác với nền tảng hiện tại {#interactions-with-the-existing-platform}

Eureka có thể đưa ứng dụng tới Pod IP thay Service DNS; kiểm chứng policy định tuyến mesh hoạt động đúng mong muốn. Ban đầu giữ business routing và JWT trong gateway. ALB health check và Prometheus scrape có thể cần ngoại lệ policy khi áp dụng mTLS bắt buộc. Karpenter liên tục tạo node thay thế, nên CNI và ztunnel phải sẵn sàng đúng thứ tự. Metric/log cardinality tăng có thể đòi thêm capacity Mimir/Loki.

Giữ endpoint remote_write và log push nội bộ hiện có cho telemetry xuyên cluster. Multicluster mesh cần use case riêng.

## Thử nghiệm có rollback đã kiểm chứng {#trial-with-a-tested-rollback}

1. Chọn phiên bản và môi trường local hoặc namespace thử riêng; bắt đầu ngoài `shopnow`.
2. Tạo hai service thử, đo latency, CPU và memory trước khi cài.
3. Cài theo tài liệu chính thức của phiên bản đã chọn; kiểm chứng tương thích VPC CNI.
4. Bật mTLS trong phạm vi thử, xác minh identity và traffic qua telemetry; thử client ngoài mesh và health check.
5. Thử thay node Karpenter, restart Pod và mất control plane.
6. Chỉ thêm L7 policy, waypoint hoặc canary routing cho use case rõ ràng sau khi kiểm tra trước đã đạt.
7. Ghi quy trình rollback enrollment, policy và controller; đo lại kết nối sau rollback.

## Điều kiện đưa vào workshop chính {#criteria-for-inclusion-in-the-core-workshop}

Cần mục tiêu đo được, manifest và phiên bản có thể tái tạo, rollback đã thử và các bài cốt lõi vẫn đạt. Trước đó, giữ ở phần mở rộng để người mới theo được lộ trình chính.

Tham khảo: [Istio ambient getting started](https://istio.io/latest/docs/ambient/getting-started/). Với sidecar, dùng tài liệu cùng phiên bản, thử riêng health và startup. Giả định ambient không tự áp dụng cho sidecar.

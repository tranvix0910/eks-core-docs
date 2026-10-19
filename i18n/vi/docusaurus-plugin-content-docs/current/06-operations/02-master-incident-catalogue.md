---
title: "Troubleshooting"
---

# Các lỗi thường gặp {#diagnose-using-components-and-evidence}

Dùng bảng dưới để chọn thành phần cần kiểm tra theo triệu chứng. Đối chiếu Events, log và cấu hình thực tế trước khi áp dụng cách xử lý.

| # | Triệu chứng | Cần kiểm tra | Cách xử lý |
|---|---|---|---|
| 1 | EKS/EFS AccessDenied dù có IAM admin | Explicit deny/SCP và region hiện tại | Dùng region/bộ quyền được cho phép |
| 2 | Không destroy được Flow Log | SCP `DeleteFlowLogs` và chủ tài nguyên | Thống nhất lưu giữ/cleanup; không âm thầm xóa state |
| 3 | Layer 20 không đọc được state 21 | Bucket/key và state tồn tại hay chưa | Bootstrap AWS Foundation hai giai đoạn |
| 4 | Provider không kết nối được lần triển khai đầu | Cluster endpoint tồn tại và exec credentials | Tạo hạ tầng AWS trước tài nguyên Helm |
| 5 | LBC `Evaluated 0 subnets` | Region/VPC thực tế và subnet tag | Sửa cấu hình qua đúng công cụ quản lý |
| 6 | Target ALB nội bộ unhealthy | Cổng đích container, chặng SG thứ hai, gateway readiness | Cho phép cổng gateway hiện tại 8080 |
| 7 | Rancher lặp đăng nhập | HTTPS trên trình duyệt và Secure cookie | Port-forward HTTPS hoặc endpoint TLS đúng |
| 8 | Rancher agent không khớp CA | TLS termination làm đổi chứng chỉ được trình | Sửa passthrough/trust |
| 9 | Mimir có Kafka/MinIO ngoài dự kiến | Chart render và cờ ingest-storage | Đồng bộ phiên bản/cấu hình theo mô hình đã chọn |
| 10 | Mimir trùng storage prefix | Bucket/prefix blocks/ruler/alertmanager | Tách prefix trong cấu hình |
| 11 | Mimir push lỗi gRPC | Đường ingest-storage và cờ push | Bật direct push khi tắt Kafka |
| 12 | Mimir/Loki lỗi quorum | Replica và replication factor | Khớp factor với topology lab |
| 13 | S3 redirect hoặc AccessDenied | Region/endpoint/bucket và Pod Identity | Sửa môi trường/IAM cho bucket đích |
| 14 | PVC receiver Pending | gp3 mặc định, log CSI, IAM/AZ | Tạo StorageClass do Terraform quản lý và sửa CSI |
| 15 | Alloy lỗi parsing | Cú pháp River và ConfigMap render | Kiểm tra cú pháp Alloy trước rollout |
| 16 | Thiếu log mixed pool | Toleration DaemonSet và selector NODE_NAME | Dùng workshop override; kiểm tra phủ đủ node |
| 17 | Log trùng | Nhiều agent Alloy cùng đọc một Pod | Discovery theo node hoặc clustering có chủ đích |
| 18 | x509 khi push telemetry | SAN, CA Secret, chứng chỉ ALB | Sửa trust/import ACM; giữ xác minh chứng chỉ |
| 19 | NodeClass NotReady | AMI alias, role, selector subnet/SG | Sửa pin/role/discovery theo output |
| 20 | Không nhận diện kind NodePool | Cài CRD/controller | Hoàn tất controller trước manifest |
| 21 | Có EC2 nhưng không join EKS | Node access entry, bootstrap, egress | Sửa xác thực/network; xem condition NodeClaim |
| 22 | Pod không vào mixed pool | Selector, toleration, requirement, request | Describe Pod rồi cập nhật chart/values qua Git |
| 23 | Không có tỷ lệ 1:3 mong đợi | Cách đo node/vCPU, tải, capacity hiện tại | Báo cáo đúng capacity quan sát; dùng fixture riêng |
| 24 | ARM64 `exec format error` | Platform image | Build/push image ARM64 hoặc đa kiến trúc |
| 25 | EFS mount timeout | SG 2049, mount target, DNS/AZ | Sửa network với đúng worker SG |
| 26 | Ghi EFS bị Permission denied | UID/GID, quyền Access Point, path | Đồng bộ POSIX identity 10001 |
| 27 | Frontend nhận HTML thay JSON | API build argument và URL trình duyệt | Build lại với API URL đúng |
| 28 | Gateway 404/503 | Prefix và Eureka service ID | Sửa chặng lỗi |
| 29 | ArgoCD resource forbidden | Quyền group/destination của AppProject | Thêm đúng quyền cần thiết với phạm vi hẹp |
| 30 | Thiếu target HPA | Helper fullname khác tên Deployment | Trỏ tới `<appName>-deployment` trong namespace đúng |
| 31 | Replica dao động giữa các giá trị | ArgoCD/self-heal, HPA, KEDA cùng điều khiển | Một scaler mỗi target; xác định bên quản lý replica |
| 32 | Grafana No data hoặc RPS sai | Datasource UID, tenant, label, đơn vị metric | Sửa query/UID; không dùng CPU thay traffic |

## Quy trình Troubleshooting {#using-this-during-the-lab}

Lưu output `describe`, Events và log kèm timestamp. Xác định nguyên nhân, sửa qua Terraform hoặc GitOps, rồi chạy lại bước đang lỗi. Mỗi lần thay một phần để dễ đối chiếu kết quả.

Lệnh thu thập: [kiểm tra và chẩn đoán](03-system-verification-and-diagnostics.md).

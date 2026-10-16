---
title: "Triển khai lại hoặc chuyển môi trường"
---

# Dùng lại workshop ở tài khoản hoặc region khác {#reuse-the-workshop-in-another-account-or-region}

Runbook này mô tả triển khai song song và chuyển đổi có kiểm chứng, thay vì đổi `region` rồi apply trên state cũ. Lộ trình chính vẫn ở [trang bắt đầu workshop](../00-platform-overview-and-deployment.md).

## 1. Kiểm kê cấu hình riêng của môi trường {#1-inventory-environment-specific-settings}

| Cấu hình | Vị trí |
|---|---|
| Tài khoản, profile, region, phiên bản, tag | tfvars của cả ba lớp |
| Bucket, state key, backend region | Cấu hình backend và remote state |
| CIDR và AZ | tfvars lớp 10 |
| Bucket Mimir/Loki và S3 endpoint | Receiver values |
| Node IAM role, AMI pin, discovery label | EC2NodeClass và output Terraform |
| Certificate ARN, SG, tên ALB nội bộ | Render TLS và tfvars lớp 21 |
| Repo, revision, registry, image tag | Biến render Application |
| Frontend API URL | Docker build argument |
| Hostname nội bộ và CA | Chứng chỉ, sender values, DNS |

Không sao chép `.terraform/`, `.tfstate` hoặc key chứng chỉ tài khoản khác vào repo mới. Provider lock file giúp giữ phiên bản có thể tái tạo; xem ràng buộc module khi init.

## 2. Tạo môi trường đích độc lập {#2-create-an-independent-destination}

Dùng checkout/branch và state key riêng. Dùng lại key trong cùng bucket trỏ về cùng state, không tạo môi trường độc lập. Kiểm chứng identity và backend trước mỗi plan.

Theo thứ tự: network → workload foundation → observability foundation → full workload → monitoring prerequisites → full observability → NodePool → ứng dụng → TLS/telemetry → nghiệm thu.

## 3. Chuyển dữ liệu có kế hoạch {#3-move-data-deliberately}

Dữ liệu ứng dụng nằm trong PostgreSQL, MySQL/Keycloak và có thể cả tệp EFS. Backup/restore từng loại theo quy trình đã thử. Sao chép image không sao chép database. EFS Access Point ID/PV volumeHandle cũ không thể dùng nguyên trạng với filesystem mới.

Với lịch sử Mimir/Loki trên S3, chọn giữ môi trường cũ hoặc di chuyển theo quy trình sản phẩm. Không cho writer độc lập dùng chung bucket/prefix nếu thiết kế chưa hỗ trợ.

## 4. Chuyển đổi {#4-cut-over}

Kiểm chứng API, đăng nhập, EFS, placement, PDB và metrics/logs tại môi trường đích. Đổi endpoint/DNS và frontend API URL theo thiết kế truy cập. Theo dõi lỗi, giữ môi trường cũ để rollback cho tới khi dữ liệu mới được chấp nhận.

## 5. Hoàn tất {#5-finish}

Ghi ánh xạ môi trường cũ/mới, thời điểm chuyển đổi, người phụ trách và bằng chứng. Chỉ xóa tài nguyên cũ khi backup/rollback không cần nữa. Flow Logs bị SCP bảo vệ hoặc bucket có versioning là trở ngại cleanup cụ thể; xóa khỏi state không chứng minh đã dọn xong.

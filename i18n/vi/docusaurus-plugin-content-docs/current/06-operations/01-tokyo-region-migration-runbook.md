---
title: "Deploy sang AWS Account hoặc Region khác"
---

# Setup môi trường mới {#reuse-the-workshop-in-another-account-or-region}

Dùng runbook này để tạo môi trường mới, kiểm tra rồi Cutover. Mỗi môi trường cần state riêng; không đổi `region` rồi Apply vào state cũ. Các bước workshop chính nằm ở [trang bắt đầu workshop](../00-platform-overview-and-deployment.md).

## 1. Kiểm tra Environment Configuration {#1-inventory-environment-specific-settings}

| Cấu hình | Vị trí |
|---|---|
| Tài khoản, profile, region, phiên bản, tag | tfvars của cả 3 Layer |
| Bucket, state key, backend region | Cấu hình backend và remote state |
| CIDR và AZ | tfvars Layer 10 |
| Bucket Mimir/Loki và S3 endpoint | Receiver values |
| Node IAM role, AMI pin, discovery label | EC2NodeClass và output Terraform |
| Certificate ARN, SG, tên ALB nội bộ | Render TLS và tfvars Layer 21 |
| Repo, revision, registry, image tag | Biến render Application |
| Frontend API URL | Docker build argument |
| Hostname nội bộ và CA | Chứng chỉ, sender values, DNS |

Không sao chép `.terraform/`, `.tfstate` hoặc key chứng chỉ tài khoản khác vào repo mới. Provider lock file giúp giữ phiên bản có thể tái tạo; xem ràng buộc module khi init.

## 2. Deploy môi trường mới {#2-create-an-independent-destination}

Chuẩn bị checkout/branch và state key riêng cho môi trường mới. Cùng bucket và state key sẽ trỏ vào cùng state. Kiểm tra AWS Identity và Backend trước mỗi lần Plan.

Theo thứ tự: network → workload foundation → observability foundation → full workload → monitoring prerequisites → full observability → NodePool → ứng dụng → TLS/telemetry → kiểm tra.

## 3. Backup và Restore dữ liệu {#3-move-data-deliberately}

Backup và Restore riêng PostgreSQL, MySQL/Keycloak và file EFS cần giữ. Push image sang ECR mới không chuyển dữ liệu Database. Với EFS mới, tạo Access Point/PV mới và kiểm tra `volumeHandle` tương ứng.

Với lịch sử Mimir/Loki trên S3, chọn giữ môi trường cũ hoặc di chuyển theo quy trình sản phẩm. Không cho writer độc lập dùng chung bucket/prefix nếu thiết kế chưa hỗ trợ.

## 4. Cutover {#4-cut-over}

Kiểm tra kết quả API, đăng nhập, EFS, placement, PDB và metrics/logs tại môi trường đích. Đổi endpoint/DNS và frontend API URL theo thiết kế truy cập. Theo dõi lỗi, giữ môi trường cũ để rollback cho tới khi dữ liệu mới được chấp nhận.

## 5. Hoàn tất Migration {#5-finish}

Ghi ánh xạ môi trường cũ/mới, thời điểm chuyển đổi, người phụ trách và bằng chứng. Chỉ xóa tài nguyên cũ khi backup/rollback không cần nữa. Flow Logs bị SCP bảo vệ hoặc bucket có versioning là trở ngại cleanup cụ thể; xóa khỏi state không chứng minh đã dọn xong.

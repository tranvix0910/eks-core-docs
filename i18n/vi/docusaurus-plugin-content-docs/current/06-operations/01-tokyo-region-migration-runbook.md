---
title: "Deploy sang tài khoản AWS hoặc Region khác"
---

# Cấu hình môi trường mới {#reuse-the-workshop-in-another-account-or-region}

Khi muốn làm lại workshop ở tài khoản hoặc region khác, chúng ta sẽ tạo môi trường mới với state riêng, kiểm tra rồi mới chuyển ứng dụng. Lộ trình triển khai vẫn theo [trang bắt đầu workshop](../00-platform-overview-and-deployment.md).

## 1. Kiểm tra cấu hình môi trường {#1-inventory-environment-specific-settings}

| Cấu hình | Vị trí |
|---|---|
| Tài khoản, profile, region, phiên bản, tag | tfvars của cả 3 layer |
| Bucket, state key, backend region | Cấu hình backend và remote state |
| CIDR và AZ | tfvars layer 10 |
| Bucket Mimir/Loki và S3 endpoint | Receiver values |
| Node IAM role, AMI pin, discovery label | EC2NodeClass và output Terraform |
| certificate ARN, SG, tên ALB nội bộ | Render TLS và tfvars layer 21 |
| Repo, revision, registry, image tag | Biến render Application |
| frontend API URL | Docker build argument |
| Hostname nội bộ và CA | Chứng chỉ, sender values, DNS |

Không sao chép `.terraform/`, `.tfstate` hoặc key chứng chỉ tài khoản khác vào repo mới. Provider lock file giúp giữ phiên bản có thể tái tạo; xem ràng buộc module khi init.

## 2. Deploy môi trường mới {#2-create-an-independent-destination}

Chuẩn bị checkout hoặc branch cho cấu hình môi trường mới và chọn state key riêng. Nếu dùng lại cả bucket lẫn key, Terraform vẫn đọc state cũ. Kiểm tra AWS identity và backend trước khi plan để tránh cập nhật nhầm môi trường.

Theo thứ tự: network → workload foundation → observability foundation → full workload → monitoring prerequisites → full observability → NodePool → ứng dụng → TLS/telemetry → kiểm tra.

## 3. Backup và restore dữ liệu {#3-move-data-deliberately}

Backup và restore riêng PostgreSQL, MySQL/Keycloak và file EFS cần giữ. Push image sang ECR mới không chuyển dữ liệu database. Với EFS mới, tạo Access Point/PV mới và kiểm tra `volumeHandle` tương ứng.

Với lịch sử Mimir/Loki trên S3, chọn giữ môi trường cũ hoặc di chuyển theo quy trình sản phẩm. Không cho writer độc lập dùng chung bucket/prefix nếu thiết kế chưa hỗ trợ.

## 4. Cutover {#4-cut-over}

Kiểm tra API, đăng nhập, EFS, placement, PDB và metrics/logs tại môi trường đích. Đổi endpoint/DNS và frontend API URL theo thiết kế truy cập. Theo dõi lỗi, giữ môi trường cũ để rollback cho tới khi dữ liệu mới được chấp nhận.

## 5. Hoàn tất Migration {#5-finish}

Ghi lại tên resource và endpoint của môi trường cũ/mới cùng thời điểm cutover. Giữ môi trường cũ trong thời gian còn cần rollback. Sau khi quyết định cleanup, kiểm tra resource đã được xóa trên AWS; việc bỏ resource khỏi state không tự xóa resource thật. Chú ý bucket có versioning và Flow Logs đang chịu SCP của tổ chức.
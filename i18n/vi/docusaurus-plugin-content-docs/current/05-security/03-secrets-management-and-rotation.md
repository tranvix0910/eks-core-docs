---
title: "Quản lý secrets và xoay vòng credentials"
---

# Không dùng tài liệu để lưu credentials {#keep-documentation-out-of-the-credential-storage-path}

Repo có giá trị mẫu trong ConfigMap, manifest database và realm export. Chỉ dùng chúng trong môi trường dữ liệu giả lập. Tài liệu này không lặp lại mật khẩu Grafana hay token thực tế.

## 1. Kiểm kê trước khi chia sẻ workshop {#1-inventory-before-sharing-the-workshop}

Kiểm tra credentials database, Keycloak admin/client secret, Grafana, ArgoCD, CI token, private key chứng chỉ, Terraform plan/state. Xoay vòng credential bị lộ tại nguồn; xóa một dòng trong Git hiện tại không thu hồi giá trị đã được chia sẻ.

## 2. Thay giá trị hardcode bằng Secret {#2-replace-hardcoded-values-with-secrets}

Dùng `valueFrom.secretKeyRef` hoặc tệp mount trong Deployment. Nếu chart thiếu hỗ trợ `secretKeyRef`/envFrom, bổ sung template. Tạo Secret nhưng vẫn giữ `spring.datasource.password` trong ConfigMap chưa giải quyết vấn đề.

Spring Boot hỗ trợ biến môi trường như `SPRING_DATASOURCE_PASSWORD`, nhưng cần kiểm tra thứ tự ưu tiên với cấu hình thực tế và thử kết nối database sau rollout. Dùng cơ chế quản lý secret của nhóm thay vì đặt mật khẩu thật trong dòng lệnh/history.

## 3. External Secrets Operator là phần mở rộng {#3-external-secrets-operator-is-an-extension}

`platform/addons/external-secrets` hiện chỉ là thư mục giữ chỗ. Quy trình cốt lõi chưa có đầy đủ operator release, SecretStore hoặc ExternalSecret, nên không khẳng định tự động rotation. Triển khai ESO cần:

1. Operator/chart tương thích được ghim phiên bản, chạy trên infra node.
2. Pod Identity và IAM chỉ cho phép Secret ARN cần thiết.
3. SecretStore/ClusterSecretStore đúng region.
4. ExternalSecret có refresh interval, Secret đích và key rõ ràng.
5. Workload đọc Secret đích, đã thử rollout/reload.
6. Xoay vòng credentials tại nguồn, đo thời gian truyền thay đổi và xác nhận truy cập database.

Cập nhật Secret không restart container đọc qua biến môi trường. Dùng rollout/reloader hoặc cơ chế reload ứng dụng đã kiểm thử.

## 4. Mã hóa và Terraform state {#4-encryption-and-terraform-state}

Xem `encryptionConfig` EKS và KMS key của module, thay vì khẳng định tuân thủ chỉ vì tài liệu nhắc KMS. Bảo vệ EFS/S3/EBS và backup theo dữ liệu thực tế.

```bash
aws eks describe-cluster --name eks-workload --query 'cluster.encryptionConfig'
aws eks describe-cluster --name eks-observability --query 'cluster.encryptionConfig'
```

State chứa mật khẩu được tạo và một số dữ liệu secret. S3 backend cần mã hóa, versioning, quyền tối thiểu và kiểm soát người đọc. Chỉ chạy `terraform output -raw` cho secret trong terminal có quyền, không chuyển giá trị vào bằng chứng nghiệm thu.

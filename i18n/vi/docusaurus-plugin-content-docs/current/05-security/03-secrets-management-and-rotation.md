---
title: "Secrets Management và Credential Rotation"
---

# Quản lý Secrets trong Workshop {#keep-documentation-out-of-the-credential-storage-path}

Repo có credentials mẫu trong ConfigMap, Database Manifest và Realm Export để chạy lab với dữ liệu demo. Trước khi chia sẻ hoặc dùng môi trường lâu dài, thay các giá trị này bằng Secret được quản lý riêng.

## 1. Kiểm tra Credentials đang sử dụng {#1-inventory-before-sharing-the-workshop}

Kiểm tra credentials database, Keycloak admin/client secret, Grafana, ArgoCD, CI token, private key chứng chỉ, Terraform plan/state. Xoay vòng credential bị lộ tại nguồn; xóa một dòng trong Git hiện tại không thu hồi giá trị đã được chia sẻ.

## 2. Dùng Kubernetes Secret {#2-replace-hardcoded-values-with-secrets}

Cấu hình Deployment đọc Secret qua `valueFrom.secretKeyRef`, `envFrom` hoặc file mount. Nếu chart chưa hỗ trợ, bổ sung template và bỏ `spring.datasource.password` khỏi ConfigMap.

Spring Boot hỗ trợ biến môi trường như `SPRING_DATASOURCE_PASSWORD`, nhưng cần kiểm tra thứ tự ưu tiên với cấu hình thực tế và thử kết nối database sau rollout. Dùng cơ chế quản lý secret của nhóm thay vì đặt mật khẩu thật trong dòng lệnh/history.

## 3. Mở rộng · External Secrets Operator {#3-external-secrets-operator-is-an-extension}

`platform/addons/external-secrets` hiện là thư mục chuẩn bị, chưa có đầy đủ Operator, SecretStore và ExternalSecret. Để triển khai ESO, bổ sung các thành phần sau:

1. Operator/chart tương thích được ghim phiên bản, chạy trên infra node.
2. Pod Identity và IAM chỉ cho phép Secret ARN cần thiết.
3. SecretStore/ClusterSecretStore đúng region.
4. ExternalSecret có refresh interval, Secret đích và key rõ ràng.
5. Workload đọc Secret đích, đã thử rollout/reload.
6. Xoay vòng credentials tại nguồn, đo thời gian truyền thay đổi và xác nhận truy cập database.

Cập nhật Secret không restart container đọc qua biến môi trường. Dùng rollout/reloader hoặc cơ chế reload ứng dụng đã kiểm thử.

## 4. Encryption và Terraform State {#4-encryption-and-terraform-state}

Xem `encryptionConfig` EKS và KMS key của module, thay vì khẳng định tuân thủ chỉ vì tài liệu nhắc KMS. Bảo vệ EFS/S3/EBS và backup theo dữ liệu thực tế.

```bash
aws eks describe-cluster --name eks-workload --query 'cluster.encryptionConfig'
aws eks describe-cluster --name eks-observability --query 'cluster.encryptionConfig'
```

Terraform State có thể chứa mật khẩu và Secret. Bật Encryption, Versioning và giới hạn quyền đọc S3 Backend. Khi cần `terraform output -raw` cho Secret, chỉ xem trong terminal cá nhân; không đưa giá trị vào báo cáo.

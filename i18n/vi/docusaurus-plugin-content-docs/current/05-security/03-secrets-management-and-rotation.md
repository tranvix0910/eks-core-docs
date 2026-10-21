---
title: "Quản lý Secret và credential rotation"
---

# Quản lý Secrets trong workshop {#keep-documentation-out-of-the-credential-storage-path}

Repo có credentials mẫu trong ConfigMap, database manifest và realm export để chạy với dữ liệu demo. Trước khi chia sẻ hoặc giữ môi trường để dùng tiếp, chúng ta cần kiểm tra các giá trị này và chuyển sang cách quản lý Secret phù hợp.

## 1. Kiểm tra credentials đang sử dụng {#1-inventory-before-sharing-the-workshop}

Kiểm tra mật khẩu database, Keycloak admin/client secret, Grafana, ArgoCD, CI token, certificate private key và các file Terraform plan/state. Nếu credential đã bị lộ, đổi credential tại nguồn. Xóa dòng đó ở commit mới không thu hồi giá trị trong lịch sử Git.

## 2. Dùng Kubernetes Secret {#2-replace-hardcoded-values-with-secrets}

Cấu hình Deployment đọc Secret qua `valueFrom.secretKeyRef`, `envFrom` hoặc file mount. Nếu chart chưa hỗ trợ, bổ sung template và bỏ `spring.datasource.password` khỏi ConfigMap.

Spring Boot hỗ trợ biến môi trường như `SPRING_DATASOURCE_PASSWORD`, nhưng cần kiểm tra thứ tự ưu tiên với cấu hình thực tế và thử kết nối database sau rollout. Dùng cơ chế quản lý secret của nhóm thay vì đặt mật khẩu thật trong dòng lệnh/history.

## 3. Mở rộng · External Secrets Operator {#3-external-secrets-operator-is-an-extension}

Thư mục `platform/addons/external-secrets` mới chuẩn bị cho phần mở rộng; workshop chưa cài đủ operator, SecretStore và ExternalSecret. Nếu muốn dùng ESO để đồng bộ Secret, cần bổ sung:

1. Operator/chart tương thích được ghim phiên bản, chạy trên infra node.
2. Pod Identity và IAM chỉ cho phép Secret ARN cần thiết.
3. SecretStore/ClusterSecretStore đúng region.
4. ExternalSecret có refresh interval, Secret đích và key rõ ràng.
5. Workload đọc Secret đích, đã thử rollout/reload.
6. Xoay vòng credentials tại nguồn, đo thời gian truyền thay đổi và xác nhận truy cập database.

Cập nhật Secret không restart container đọc qua biến môi trường. Dùng rollout/reloader hoặc cơ chế reload ứng dụng đã kiểm thử.

## 4. Mã hóa và Terraform state {#4-encryption-and-terraform-state}

Kiểm tra `encryptionConfig` của EKS và KMS key trong module để biết cấu hình mã hóa đang sử dụng. Với EFS, S3, EBS và backup, kiểm tra riêng encryption và quyền truy cập của từng resource.

```bash
aws eks describe-cluster --name eks-workload --query 'cluster.encryptionConfig'
aws eks describe-cluster --name eks-observability --query 'cluster.encryptionConfig'
```

Terraform state có thể chứa mật khẩu và Secret. Bật Mã hóa, Versioning và giới hạn quyền đọc S3 backend. Khi cần `terraform output -raw` cho Secret, chỉ xem trong terminal cá nhân; không đưa giá trị vào báo cáo.

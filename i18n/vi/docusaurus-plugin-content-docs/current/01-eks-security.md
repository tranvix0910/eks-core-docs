---
title: "Access, Secrets và TLS"
---

# Security trong Workshop {#manage-access-by-operational-flow}

Quản lý quyền theo từng luồng: người vận hành truy cập EKS, Pod gọi AWS API, ứng dụng đọc Secret và Telemetry giữa 2 cluster.

| Luồng | Cơ chế | Hướng dẫn |
|---|---|---|
| Người vận hành → AWS/EKS | AWS identity, EKS access entry, Kubernetes RBAC | [Truy cập cluster](05-security/02-sts-tokens-and-access-entries.md) |
| Pod → AWS API | EKS Pod Identity và IAM policy | [Pod Identity](05-security/01-eks-pod-identity.md) |
| Ứng dụng → database/Keycloak | Kubernetes Secret và cơ chế đồng bộ tùy chọn | [Secrets](05-security/03-secrets-management-and-rotation.md) |
| Cluster 1 → receiver cluster 2 | Private DNS/SG, HTTPS, CA tin cậy | [TLS](01-platform-addons/03-cert-manager-and-internal-tls.md) |
| Gia hạn chứng chỉ | cert-manager, import lại ACM, cập nhật CA trên client khi cần | [Vòng đời chứng chỉ](05-security/04-tls-certificate-lifecycle.md) |
| Trình duyệt → UI quản trị | Port-forward hoặc endpoint có HTTPS/xác thực | [Truy cập công cụ](01-platform-addons/05-admin-ingress-and-hardening.md) |

## Các điểm cần kiểm tra {#important-distinctions}

- `sensitive=true` ẩn giá trị trong một số output Terraform; state vẫn cần bảo vệ.
- Base64 của Kubernetes Secret không phải mã hóa bảo mật.
- Tenant header Mimir không phải thông tin đăng nhập.
- PDB và topology spread kiểm soát availability, không phải phân quyền.
- Tài liệu External Secrets không chứng minh operator/SecretStore đã được cài.

Cấu hình mẫu dùng credentials demo và có một số Ingress Rule mở. Cập nhật theo các hướng dẫn trên trước khi chia sẻ môi trường. Khi lưu kết quả workshop, loại bỏ mật khẩu, Private Key và Registration Token.

---
title: "Truy cập, Secret và TLS"
---

# Quyền truy cập và bảo mật {#manage-access-by-operational-flow}

Phần này tập hợp cách truy cập AWS và EKS, cách Pod lấy quyền gọi AWS API, quản lý Secret và cấu hình TLS giữa hai cluster. Bạn có thể đọc phần giải thích bên dưới trước, sau đó theo các bài thực hành trong bảng.

## IAM, Kubernetes RBAC và TLS {#aws-and-kubernetes-access}

### Người dùng truy cập cluster

AWS profile cung cấp identity cho AWS CLI. Khi gọi EKS, kubeconfig dùng identity đó để lấy token truy cập Kubernetes API. Sau bước authentication, access policy và Kubernetes RBAC quyết định bạn được thao tác resource nào.

Vì vậy, chạy được `aws sts get-caller-identity` chưa đủ để kết luận có quyền đọc Pod. Lỗi AWS `AccessDenied`, Kubernetes `Unauthorized`, `Forbidden` và endpoint timeout cần được kiểm tra ở các thành phần khác nhau.

### Pod lấy quyền AWS bằng cách nào?

Mimir cần ghi S3, EFS CSI cần tạo Access Point và Load Balancer Controller cần gọi ELB/EC2 API. workshop dùng EKS Pod Identity để liên kết IAM role với ServiceAccount trong đúng namespace và cluster. SDK trong Pod lấy credentials qua cơ chế này thay vì gắn access key vào image hoặc values.

Kubernetes RBAC và IAM phục vụ hai phía khác nhau. ServiceAccount có quyền đọc Pod trong Kubernetes không có nghĩa nó tự được quyền ghi S3. Ngược lại, IAM role có quyền S3 không tự cấp quyền sửa Deployment.

### Secret và Terraform state

Kubernetes Secret là resource để cung cấp dữ liệu nhạy cảm cho ứng dụng. Giá trị base64 trong manifest không phải là cách mã hóa để có thể đưa mật khẩu thật vào Git. Cần kiểm soát quyền đọc Secret và cách lưu giá trị nguồn.

Tương tự, `sensitive=true` không loại giá trị khỏi Terraform state. Backend, plan file và những người có quyền đọc chúng cũng thuộc phạm vi quản lý credentials của workshop.

### Private DNS, TLS và giới hạn truy cập

Private DNS cung cấp tên truy cập bên trong VPC. Security group giới hạn đường kết nối được phép. TLS mã hóa đường truyền và cho client xác minh certificate của endpoint. Ba phần này cần được cấu hình cùng nhau; có private hostname chưa có nghĩa certificate tự được client tin cậy.

Trong luồng telemetry, cert-manager tạo certificate, ACM giữ bản được gắn với ALB và Prometheus/Alloy giữ CA certificate để xác minh. Nếu cert-manager gia hạn Secret, chúng ta vẫn cần cập nhật certificate đã import vào ACM. Các bài bên dưới đi vào từng phần cấu hình và cách kiểm tra.

Đọc thêm: [EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).

| Luồng | Cơ chế | Hướng dẫn |
|---|---|---|
| Người vận hành → AWS/EKS | AWS identity, EKS access entry, Kubernetes RBAC | [Truy cập cluster](05-security/02-sts-tokens-and-access-entries.md) |
| Pod → AWS API | EKS Pod Identity và IAM policy | [Pod Identity](05-security/01-eks-pod-identity.md) |
| Ứng dụng → database/Keycloak | Kubernetes Secret và cơ chế đồng bộ tùy chọn | [Secrets](05-security/03-secrets-management-and-rotation.md) |
| Cluster 1 → receiver cluster 2 | private DNS/SG, HTTPS, CA tin cậy | [TLS](01-platform-addons/03-cert-manager-and-internal-tls.md) |
| Gia hạn chứng chỉ | cert-manager, import lại ACM, cập nhật CA trên client khi cần | [Vòng đời chứng chỉ](05-security/04-tls-certificate-lifecycle.md) |
| Trình duyệt → UI quản trị | port-forward hoặc endpoint có HTTPS/xác thực | [Truy cập công cụ](01-platform-addons/05-admin-ingress-and-hardening.md) |

## Các điểm cần kiểm tra {#important-distinctions}

- Giới hạn người đọc Terraform state và plan, kể cả khi output đã có `sensitive=true`.
- Giữ giá trị Secret ngoài Git; base64 trong manifest chỉ là encoding.
- Cấu hình authentication cho endpoint Mimir riêng với tenant header nếu mở rộng mô hình truy cập.
- Nếu dùng External Secrets, kiểm tra operator và SecretStore đã được cài trước khi apply ExternalSecret.

Cấu hình mẫu dùng credentials demo và có một số Ingress Rule mở. Cập nhật theo các hướng dẫn trên trước khi chia sẻ môi trường. Khi lưu kết quả workshop, loại bỏ mật khẩu, private key và Registration Token.

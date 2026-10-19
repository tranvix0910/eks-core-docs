---
title: "TLS Certificate Lifecycle"
---

# Quản lý Certificate cho Telemetry {#keep-three-certificate-locations-synchronized}

Certificate được lưu ở 3 nơi: cert-manager Secret, ACM Certificate của ALB và CA Trust của Prometheus/Alloy. Khi cert-manager gia hạn Secret, cần kiểm tra và cập nhật các thành phần còn lại.

## 1. Kiểm tra Certificate Expiry {#1-inspect-expiration}

```bash
kubectl --context eks-workload -n cert-manager get certificates
kubectl --context eks-workload -n cert-manager describe certificate observability-alb-tls
aws acm describe-certificate --certificate-arn "$WORKSHOP_CERT_ARN" \
  --query 'Certificate.{NotAfter:NotAfter,Status:Status,Type:Type,InUseBy:InUseBy}'
```

Manifest leaf hiện yêu cầu thời hạn một năm, gia hạn trước khi hết hạn 30 ngày; CA có thời hạn dài hơn. Vận hành dựa trên `NotAfter` thực tế, không dựa ngày tạo file cục bộ.

## 2. Renew và Import lại Certificate {#2-renew-and-re-import-the-leaf}

Sau khi cert-manager cấp Certificate mới, export file vào thư mục tạm theo bài TLS. Import lại vào **cùng ACM ARN**:

```bash
aws acm import-certificate --region "$AWS_REGION" \
  --certificate-arn "$WORKSHOP_CERT_ARN" \
  --certificate "fileb://$WORKSHOP_CERT_DIR/cert.pem" \
  --private-key "fileb://$WORKSHOP_CERT_DIR/key.pem" \
  --certificate-chain "fileb://$WORKSHOP_CERT_DIR/chain.pem"
```

Lệnh dùng file mới xuất; không tự lấy dữ liệu vừa gia hạn từ Kubernetes. Kiểm tra ngày/SAN trước import. Không mặc định chứng chỉ import có cơ chế tự gia hạn như chứng chỉ do ACM quản lý.

## 3. Cập nhật CA Trust {#3-if-the-ca-changes-too}

Khi đổi CA, cho client tin cậy cả CA cũ và mới trong giai đoạn chuyển tiếp. Cập nhật Trust trước khi đổi Certificate trên ALB, sau đó Reload hoặc Rollout Prometheus/Alloy. Xóa CA cũ khi tất cả endpoint và client đã dùng CA mới.

## 4. Kiểm tra sau Rotation {#4-verify-after-changes}

Query Mimir phải có sample mới, Loki phải có marker mới. Bên gửi không có lỗi x509 hoặc retry kéo dài; ALB phải dùng ARN mong muốn. Ghi ngày hết hạn mới và người phụ trách gia hạn, không ghi private key.

Xóa file key tạm sau khi xác nhận việc lưu giữ được quản lý theo policy của nhóm. Không dùng `insecure_skip_verify` để bỏ qua rotation lỗi.

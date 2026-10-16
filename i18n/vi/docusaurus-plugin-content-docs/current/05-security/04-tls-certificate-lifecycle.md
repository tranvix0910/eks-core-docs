---
title: "Gia hạn chứng chỉ không làm gián đoạn telemetry"
---

# Đồng bộ ba nơi lưu chứng chỉ {#keep-three-certificate-locations-synchronized}

cert-manager quản lý leaf Secret, ACM giữ chứng chỉ ALB đã import, Prometheus/Alloy giữ CA tin cậy. Gia hạn Secret không tự cập nhật hai nơi còn lại.

## 1. Kiểm tra ngày hết hạn {#1-inspect-expiration}

```bash
kubectl --context eks-workload -n cert-manager get certificates
kubectl --context eks-workload -n cert-manager describe certificate observability-alb-tls
aws acm describe-certificate --certificate-arn "$WORKSHOP_CERT_ARN" \
  --query 'Certificate.{NotAfter:NotAfter,Status:Status,Type:Type,InUseBy:InUseBy}'
```

Manifest leaf hiện yêu cầu thời hạn một năm, gia hạn trước khi hết hạn 30 ngày; CA có thời hạn dài hơn. Vận hành dựa trên `NotAfter` thực tế, không dựa ngày tạo tệp cục bộ.

## 2. Gia hạn và import lại leaf {#2-renew-and-re-import-the-leaf}

Sau khi cert-manager cấp chứng chỉ mới, xuất vào thư mục tạm được bảo vệ theo bài TLS. Import lại vào **cùng ARN**:

```bash
aws acm import-certificate --region "$AWS_REGION" \
  --certificate-arn "$WORKSHOP_CERT_ARN" \
  --certificate "fileb://$WORKSHOP_CERT_DIR/cert.pem" \
  --private-key "fileb://$WORKSHOP_CERT_DIR/key.pem" \
  --certificate-chain "fileb://$WORKSHOP_CERT_DIR/chain.pem"
```

Lệnh dùng tệp mới xuất; không tự lấy dữ liệu vừa gia hạn từ Kubernetes. Kiểm tra ngày/SAN trước import. Không mặc định chứng chỉ import có cơ chế tự gia hạn như chứng chỉ do ACM quản lý.

## 3. Nếu CA cũng thay đổi {#3-if-the-ca-changes-too}

Dùng giai đoạn chuyển tiếp khi client tin cậy cả CA cũ và mới. Triển khai trust trước khi đổi chứng chỉ ALB. Cập nhật Secret monitoring và kiểm chứng client reload hoặc rollout có kiểm soát. Chỉ xóa CA cũ khi mọi client/endpoint đã chuyển đổi.

## 4. Kiểm chứng sau thay đổi {#4-verify-after-changes}

Query Mimir phải có sample mới, Loki phải có marker mới. Bên gửi không có lỗi x509 hoặc retry kéo dài; ALB phải dùng ARN mong muốn. Ghi ngày hết hạn mới và người phụ trách gia hạn, không ghi private key.

Xóa tệp key tạm sau khi xác nhận việc lưu giữ được quản lý theo policy của nhóm. Không dùng `insecure_skip_verify` để bỏ qua rotation lỗi.

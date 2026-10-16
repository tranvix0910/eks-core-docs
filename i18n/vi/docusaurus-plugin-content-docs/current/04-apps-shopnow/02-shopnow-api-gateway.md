---
title: "Kiểm chứng API gateway và đường request"
---

# Kiểm tra API theo từng chặng {#check-the-api-one-hop-at-a-time}

## 1. Gọi gateway {#1-call-the-gateway}

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-api-gateway-service 5860:5860
```

```bash
curl -i http://localhost:5860/actuator/health
curl -i http://localhost:5860/product
```

SecurityConfig cho phép GET ẩn danh tới `/product`. Thao tác ghi và giỏ hàng cần JWT theo cấu hình demo. `[]` không phải lỗi; nhận HTML thay JSON thường do request bị gửi nhầm tới frontend/Nginx.

## 2. Hiểu tên route {#2-understand-route-names}

| Request vào gateway | Đích Eureka | Request tới controller |
|---|---|---|
| `/product/1` | `PRODUCT-SERVICE` | `/api/product/1` |
| `/shopping-cart/1` | `CART-SERVICE` qua production override | `/api/shopping-cart/1` |
| `/user/signin` | `USER-SERVICE` | `/api/user/signin` |

`PrefixPath=/api` thêm tiền tố sau khi khớp path đầu vào. Vì vậy gọi `/api/product` trên gateway khác gọi trực tiếp controller. Postman collection cũ vẫn dùng path `/api/` tại gateway; cập nhật request trước khi dùng để nghiệm thu.

## 3. Khoanh vùng lỗi {#3-isolate-failures}

- Trình duyệt gọi sai URL: kiểm tra `REACT_APP_BASE_API_URL` lúc build và tab Network.
- Gateway 404: xem predicate và prefix đầu vào; backend trực tiếp trả lời tại `/api/product`.
- Gateway 503: kiểm tra đăng ký Eureka, endpoint Ready và service ID.
- 401: kiểm tra JWT issuer/DNS, hạn token và public path trong SecurityConfig.
- CORS/preflight: xem OPTIONS và header/origin được cho phép; phân biệt với lỗi thiếu route backend.

```bash
kubectl --context eks-workload -n shopnow logs deployment/shopnow-api-gateway-deployment --tail=100
kubectl --context eks-workload -n shopnow logs deployment/shopnow-product-service-deployment --tail=100
kubectl --context eks-workload -n shopnow get endpointslices
```

Cấu hình local và ConfigMap production khác nhau. Giá trị thực tế kết hợp mặc định trong image với `/app/config-override/application.properties`.

## 4. Giới hạn xác thực demo {#4-demo-authentication-limits}

User service xác minh người dùng trong database rồi xin token bằng `client_credentials`. Đây chưa phải mô hình token hoàn chỉnh theo từng người dùng cuối. Đăng nhập demo thành công không chứng minh phân quyền người dùng với giỏ hàng. Các bài security phân biệt danh tính nền tảng và xác thực ứng dụng.

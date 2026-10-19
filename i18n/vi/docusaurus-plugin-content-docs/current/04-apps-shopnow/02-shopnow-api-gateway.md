---
title: "ShopNow API Gateway"
---

# Kiểm tra Request Flow {#check-the-api-one-hop-at-a-time}

## 1. Gọi API qua Gateway {#1-call-the-gateway}

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-api-gateway-service 5860:5860
```

```bash
curl -i http://localhost:5860/actuator/health
curl -i http://localhost:5860/product
```

SecurityConfig cho phép GET `/product` không cần đăng nhập. Các thao tác ghi và Cart API cần JWT theo cấu hình demo. Database mới có thể trả danh sách rỗng `[]`. Nếu nhận HTML thay JSON, kiểm tra request có bị gửi tới Frontend/Nginx không.

## 2. Gateway Routes {#2-understand-route-names}

| Request vào gateway | Đích Eureka | Request tới controller |
|---|---|---|
| `/product/1` | `PRODUCT-SERVICE` | `/api/product/1` |
| `/shopping-cart/1` | `CART-SERVICE` qua production override | `/api/shopping-cart/1` |
| `/user/signin` | `USER-SERVICE` | `/api/user/signin` |

`PrefixPath=/api` thêm prefix trước khi gửi request tới Controller. Gọi Gateway bằng `/product`; gọi trực tiếp Backend bằng `/api/product`. Nếu dùng Postman Collection cũ có `/api/` trên Gateway URL, sửa lại path trước khi test.

## 3. Troubleshooting {#3-isolate-failures}

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

Kiểm tra cả cấu hình trong image và file override `/app/config-override/application.properties`. Local config và ConfigMap production có thể dùng giá trị khác nhau.

## 4. Authentication trong Demo {#4-demo-authentication-limits}

User Service kiểm tra user trong database, sau đó lấy token bằng `client_credentials`. Token này chưa đại diện đầy đủ cho từng người dùng cuối. Khi demo Login, kiểm tra riêng quyền truy cập Cart và phân biệt Application Authentication với quyền AWS/EKS.

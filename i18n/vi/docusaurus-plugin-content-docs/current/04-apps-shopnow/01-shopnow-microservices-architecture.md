---
title: "ShopNow · microservices architecture"
---

# Tổng quan ShopNow {#the-application-used-to-validate-the-platform}

ShopNow là ứng dụng được dùng xuyên suốt workshop. Frontend viết bằng React, các backend sử dụng Spring Boot và giao tiếp qua API gateway cùng Eureka. Chúng ta sẽ dùng ứng dụng này để thử cách deploy bằng ArgoCD, mount EFS, phân bổ Pod và thu thập metrics, logs.

| Thành phần | Mã nguồn | Service/cổng trong cluster | Mục đích |
|---|---|---|---|
| frontend | `shopnow-frontend` | `shopnow-frontend-service:80` | React SPA, Redux, Nginx |
| API gateway | `shopnow-backend/api-gateway` | `shopnow-api-gateway-service:5860` | Định tuyến, JWT |
| Product | `shopnow-product-service` | `shopnow-product-service-service:5861` | CRUD sản phẩm, PostgreSQL |
| Cart | `shopnow-shopping-cart-service` | `shopnow-shopping-cart-service-service:5863` | Giỏ hàng, PostgreSQL, gọi product API |
| User | `shopnow-user-service` | `shopnow-user-service-service:5865` | Hồ sơ, đăng ký/đăng nhập |
| Config server | `shopnow-config-server` | `shopnow-config-server-service:5859` | Spring Config Server |
| Discovery | `shopnow-discovery-server` | `shopnow-discovery-server-service:8761` | Eureka |
| PostgreSQL | Manifest database | `postgres:5432` | Dữ liệu ứng dụng |
| MySQL | Manifest database | `shopnow-keycloak-mysql-service:3306` | Dữ liệu Keycloak |
| Keycloak | Manifest database | `shopnow-keycloak-realms-service:8080` | Cấp JWT cho cấu hình demo |

Các giá trị cần đối chiếu: Config Server port `5859`; Cart dùng PostgreSQL; Keycloak dùng MySQL và realm `java-microservice-realm`.

## Request Flow {#request-flow}

frontend gọi Gateway qua `/product`, `/shopping-cart` và `/user`. Gateway tìm service qua Eureka, thêm prefix `/api`, rồi chuyển request tới Spring controller. Khi API lỗi, kiểm tra lần lượt Browser, Gateway và backend để xác định chặng lỗi.

## Storage {#workshop-storage}

Mỗi backend mount một PVC EFS tại `/data`. Các replica của cùng service dùng chung PVC, còn các service khác nhau có Access Point riêng. Phần này dùng để thử đọc, ghi file dùng chung và giữ file sau khi thay Pod. Dữ liệu sản phẩm và người dùng của ứng dụng vẫn nằm trong PostgreSQL.

## Availability của workshop {#availability-boundaries}

Eureka và database hiện chạy một replica cho mỗi thành phần. PDB trên backend không tạo thêm replica hoặc HA cho các dependency này. Khi test availability, ghi lại service đã thử và ảnh hưởng của các dependency đang có một replica.
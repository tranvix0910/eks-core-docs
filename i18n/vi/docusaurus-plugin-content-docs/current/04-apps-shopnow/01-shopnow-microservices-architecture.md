---
title: "ShopNow · Microservices Architecture"
---

# Tổng quan ShopNow {#the-application-used-to-validate-the-platform}

ShopNow là dự án Microservices dùng trong workshop để thực hành Deploy với ArgoCD, mount EFS, Pod Placement, PDB và Observability. Cấu hình hiện tại phục vụ lab; phần Authentication và HA còn các giới hạn nêu bên dưới.

| Thành phần | Mã nguồn | Service/cổng trong cluster | Mục đích |
|---|---|---|---|
| Frontend | `shopnow-frontend` | `shopnow-frontend-service:80` | React SPA, Redux, Nginx |
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

Frontend gọi Gateway qua `/product`, `/shopping-cart` và `/user`. Gateway tìm service qua Eureka, thêm prefix `/api`, rồi chuyển request tới Spring Controller. Khi API lỗi, kiểm tra lần lượt Browser, Gateway và Backend để xác định chặng lỗi.

## Storage {#workshop-storage}

Mỗi backend có PVC EFS riêng, mount tại `/data`. Các replica của cùng service dùng chung PVC; mỗi service dùng Access Point riêng. Dữ liệu sản phẩm và người dùng vẫn lưu trong PostgreSQL. Mount EFS dùng để thực hành Shared Filesystem và kiểm tra dữ liệu sau khi thay Pod.

## Availability trong Workshop {#availability-boundaries}

Eureka và Database hiện có 1 replica. PDB của backend không tạo HA cho các thành phần này. Khi báo cáo kết quả, ghi service đã test PDB và các dependency vẫn chạy một replica.

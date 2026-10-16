---
title: "ShopNow — Service, cổng và phụ thuộc"
---

# Ứng dụng dùng để kiểm chứng nền tảng {#the-application-used-to-validate-the-platform}

ShopNow là ứng dụng tham chiếu cho bài kiểm thử triển khai, lưu trữ, scheduling và telemetry. Đây chưa phải hệ thống thương mại hoàn chỉnh với phân quyền hoặc bảo đảm availability cho production.

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

Config server hiện dùng cổng 5859, không phải 8888. Cart dùng PostgreSQL; MySQL phục vụ Keycloak. Realm thực tế là `java-microservice-realm`, không phải `shopnow`.

## Luồng request {#request-flow}

Trình duyệt gọi gateway qua `/product`, `/shopping-cart` và `/user`. Gateway tìm service qua Eureka, thêm `/api` và chuyển tiếp tới Spring controller. Khi xử lý sự cố, xác định lỗi ở trình duyệt, gateway hay backend trước khi sửa ALB.

## Lưu trữ trong workshop {#workshop-storage}

Cả sáu backend mount PVC EFS riêng cho service tại `/data` thông qua workshop override. Replica cùng service dùng chung PVC; các service khác nhau không tự dùng chung Access Point. Mount EFS chứng minh khả năng hỗ trợ filesystem chia sẻ, nhưng không có nghĩa mã hiện tại lưu sản phẩm/người dùng trên đó; dữ liệu này vẫn ở PostgreSQL.

## Ranh giới availability {#availability-boundaries}

Registry và database vẫn chỉ có một replica. PDB backend không cung cấp HA cho database/Eureka hoặc bảo đảm giao dịch xuyên service thành công. Khi báo cáo PDB, chỉ rõ service được thử và các phụ thuộc singleton còn lại.

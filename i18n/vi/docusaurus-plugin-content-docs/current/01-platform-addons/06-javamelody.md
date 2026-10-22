---
title: "JavaMelody · JVM Monitoring"
---

# Cấu hình JavaMelody Collector {#turn-an-empty-collector-into-jvm-visibility}

JavaMelody giúp xem thống kê JVM và JDBC của các Spring service. Collector chạy trên node `infra`, còn dữ liệu được xem ở UI JavaMelody. Phần metrics và logs tập trung vẫn dùng Prometheus/Mimir và Alloy/Loki.

## 1. Kiểm tra JavaMelody Dependency {#1-confirm-the-agent-is-in-the-image}

POM của config/discovery/product/cart/user có `javamelody-spring-boot-starter`. API gateway hiện thiếu dependency này và dùng reactive stack; không mặc định cho rằng có endpoint `/monitoring`.

Sau khi thêm dependency, build và push image mới rồi deploy lại service.

## 2. Cấu hình Collector {#2-connect-the-collector}

Sau khi các Pod của ứng dụng Ready, cập nhật `-Djavamelody.urls` trong manifest Collector bằng endpoint nội bộ của service. Ví dụ:

```text
-Djavamelody.urls=http://shopnow-product-service-service.shopnow.svc:5861/monitoring
```

Khi theo dõi nhiều service, cấu hình `javamelody.urls` theo cú pháp mà phiên bản collector hỗ trợ. Commit manifest, apply vào workload cluster rồi chờ StatefulSet rollout. Nếu endpoint cần đăng nhập, lưu credentials trong Kubernetes Secret và dùng cơ chế xác thực của JavaMelody.

## 3. Kiểm tra {#3-verify}

```bash
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
kubectl --context eks-workload -n javamelody get pods -o wide
kubectl --context eks-workload -n javamelody logs statefulset/javamelody-collector --tail=80
kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080
```

Gọi Product API, mở JavaMelody UI và kiểm tra timestamp mới. Nếu UI chỉ hiện trang chào mừng, kiểm tra endpoint `/monitoring`, DNS, port và Collector log từ trong cluster. Collector lưu dữ liệu trên PVC `gp3`; microservices vẫn mount EFS theo yêu cầu workshop.

**Kết quả kiểm tra:** node collector có `role=infra`, ít nhất một backend hiển thị dữ liệu JVM/JDBC. Không chụp ảnh chứa truy vấn thực hoặc thông tin người dùng.

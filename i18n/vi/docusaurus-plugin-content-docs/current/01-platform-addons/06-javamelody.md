---
title: "JavaMelody · JVM Monitoring"
---

# Setup JavaMelody Collector {#turn-an-empty-collector-into-jvm-visibility}

JavaMelody thu thập JVM/JDBC metrics từ Spring Services. Collector chạy trên node `infra`; dữ liệu được xem tại UI JavaMelody. Metrics và logs tập trung ở Cluster Observability vẫn dùng Prometheus/Mimir và Alloy/Loki.

## 1. Kiểm tra JavaMelody Dependency {#1-confirm-the-agent-is-in-the-image}

POM của config/discovery/product/cart/user có `javamelody-spring-boot-starter`. API gateway hiện thiếu dependency này và dùng reactive stack; không mặc định cho rằng có endpoint `/monitoring`.

Sau khi thêm dependency, Build và Push image mới rồi Deploy lại service.

## 2. Cấu hình Collector {#2-connect-the-collector}

Sau khi ShopNow Ready, cập nhật `-Djavamelody.urls` trong manifest Collector bằng endpoint nội bộ của service. Ví dụ:

```text
-Djavamelody.urls=http://shopnow-product-service-service.shopnow.svc:5861/monitoring
```

Với nhiều URL, dùng cú pháp nhiều ứng dụng được tài liệu của phiên bản collector hỗ trợ; không tự nối chuỗi tùy ý. Commit manifest, apply vào cluster 1 và chờ StatefulSet rollout. Nếu endpoint yêu cầu xác thực, dùng cơ chế credentials được JavaMelody hỗ trợ và Kubernetes Secret.

## 3. Kiểm tra kết quả {#3-verify}

```bash
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
kubectl --context eks-workload -n javamelody get pods -o wide
kubectl --context eks-workload -n javamelody logs statefulset/javamelody-collector --tail=80
kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080
```

Gọi Product API, mở JavaMelody UI và kiểm tra timestamp mới. Nếu UI chỉ hiện trang chào mừng, kiểm tra endpoint `/monitoring`, DNS, port và Collector log từ trong cluster. Collector lưu dữ liệu trên PVC `gp3`; Microservices vẫn mount EFS theo yêu cầu workshop.

**Bằng chứng:** node collector có `role=infra`, ít nhất một backend hiển thị dữ liệu JVM/JDBC. Không chụp ảnh chứa truy vấn thực hoặc thông tin người dùng.

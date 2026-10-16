---
title: "JavaMelody — Giám sát JVM microservice"
---

# Kết nối collector để quan sát JVM {#turn-an-empty-collector-into-jvm-visibility}

JavaMelody bổ sung quan sát JVM/JDBC cho Spring service. Công cụ này không thay Prometheus/Mimir và không tự chuyển mọi dữ liệu sang cluster 2. Đề bài yêu cầu collector chạy trên infra node; tích hợp ứng dụng là phép kiểm tra riêng.

## 1. Xác nhận image có agent {#1-confirm-the-agent-is-in-the-image}

POM của config/discovery/product/cart/user có `javamelody-spring-boot-starter`. API gateway hiện thiếu dependency này và dùng reactive stack; không mặc định cho rằng có endpoint `/monitoring`.

Build lại image sau khi thêm dependency. Sửa manifest không thể thêm thư viện Java vào image đã có.

## 2. Kết nối collector {#2-connect-the-collector}

Sau khi ShopNow Ready, cập nhật `-Djavamelody.urls` trong manifest collector thành endpoint ứng dụng nội bộ, ví dụ:

```text
-Djavamelody.urls=http://shopnow-product-service-service.shopnow.svc:5861/monitoring
```

Với nhiều URL, dùng cú pháp nhiều ứng dụng được tài liệu của phiên bản collector hỗ trợ; không tự nối chuỗi tùy ý. Commit manifest, apply vào cluster 1 và chờ StatefulSet rollout. Nếu endpoint yêu cầu xác thực, dùng cơ chế credentials được JavaMelody hỗ trợ và Kubernetes Secret.

## 3. Kiểm chứng {#3-verify}

```bash
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
kubectl --context eks-workload -n javamelody get pods -o wide
kubectl --context eks-workload -n javamelody logs statefulset/javamelody-collector --tail=80
kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080
```

Gửi request tới product API, mở UI và xác nhận timestamp mới. Nếu chỉ có trang chào mừng, kiểm tra `/monitoring` của backend từ bên trong cluster, DNS/port và log collector. Dữ liệu riêng của collector dùng PVC gp3, không mâu thuẫn yêu cầu EFS cho microservices.

**Bằng chứng:** node collector có `role=infra`, ít nhất một backend hiển thị dữ liệu JVM/JDBC. Không chụp ảnh chứa truy vấn thực hoặc thông tin người dùng.

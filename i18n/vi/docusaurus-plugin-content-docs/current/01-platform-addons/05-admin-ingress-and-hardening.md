---
title: "Truy cập Platform Tools"
---

# Truy cập UI trong Workshop {#open-workshop-tools}

Dùng Port-forward để truy cập ArgoCD, Prometheus, JavaMelody và Grafana từ máy local. Khi cần truy cập qua ALB, cấu hình IP được phép và bảo vệ endpoint theo phần bên dưới.

## Port-forward {#access-terminals}

Chạy mỗi lệnh trong terminal riêng:

```bash
kubectl --context eks-workload -n argocd port-forward svc/argocd-server 8080:80
```

```bash
kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
```

```bash
kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080
```

```bash
kubectl --context eks-observability -n monitoring port-forward svc/grafana 3000:80
```

Release ArgoCD hiện dùng `--insecure`; truy cập tại `http://localhost:8080`. Grafana tập trung ở `http://localhost:3000`. Nếu tên Service khác, xem `kubectl get svc` thay vì đoán.

## Login Credentials {#login-credentials}

```bash
kubectl --context eks-workload -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 --decode
kubectl --context eks-observability -n monitoring get secret grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode
```

Đọc credentials trong terminal cá nhân và không chụp vào báo cáo. Grafana trên Cluster Workload và Grafana tập trung dùng Secret riêng. Nếu ArgoCD Initial Admin Secret đã bị xóa sau khi đổi mật khẩu, dùng tài khoản đăng nhập hiện tại.

## Truy cập qua Public ALB {#if-a-public-alb-is-required}

`admin-ingress.yaml` dùng chung group `eks-workload` trên cổng 80/9090/9093/8081. Trước khi apply:

1. Giới hạn `inbound-cidrs` theo dải VPN/IP được cho phép.
2. Với endpoint ổn định, dùng domain bạn quản lý và chứng chỉ ACM phù hợp.
3. Bảo vệ Prometheus/Alertmanager/JavaMelody bằng xác thực ở lớp truy cập; URL khó đoán không phải biện pháp bảo vệ.
4. Kiểm tra cả ingress Grafana do Terraform tạo trong cluster 1 và ingress cluster 2, thay vì chỉ sửa một manifest.

JavaMelody có thể hiển thị SQL, thread và system property. Dùng dữ liệu giả lập trong workshop. Dừng port-forward bằng Ctrl+C sau khi dùng; xóa public ingress không còn cần qua đúng công cụ quản lý để giải phóng load balancer.

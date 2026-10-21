---
title: "Mở rộng · HPA, CPA và KEDA"
---

# Thực hành workload autoscaling {#enable-scaling-after-availability-tests-pass}

Làm phần autoscaling sau khi đã test EFS và PDB. Bài PDB cần các replica Ready ổn định, nên khi thử scale-to-zero hãy dùng workload riêng hoặc tạm dừng bài test availability.

## 1. Kiểm tra Metrics Server {#1-metrics-server-belongs-to-terraform}

```bash
kubectl --context eks-workload -n kube-system get deployment metrics-server
kubectl --context eks-workload top pods -n shopnow
```

Metrics Server đã do Terraform cài. Nếu HPA hiện `<unknown>`, kiểm tra APIService và Metrics Server log trước.

## 2. Cấu hình HPA target {#2-repair-the-hpa-target-before-enabling-it}

`templates/hpa.yaml` hiện dùng helper fullname, trong khi Deployment có tên `<global.appName>-deployment`. Cập nhật cả sáu backend chart trước khi bật HPA:

```yaml
scaleTargetRef:
  apiVersion: apps/v1
  kind: Deployment
  name: {{ .Values.global.appName }}-deployment
```

Đặt namespace từ `global.namespace`. Thêm `behavior.scaleDown.stabilizationWindowSeconds: 300` dưới `spec` khi phù hợp để tránh scale-down quá nhanh. Render và xác nhận `scaleTargetRef.name` khớp Deployment, không chỉ kiểm tra cú pháp YAML.

Deployment chỉ nên render `replicas` khi chart quản lý trường đó. Với scaler bên ngoài, đặt `ignoreDifferences` của Application cho `/spec/replicas` và `RespectIgnoreDifferences=true`; nếu không, ArgoCD có thể liên tục khôi phục số replica từ values.

## 3. Thử CPU HPA {#3-enable-cpu-hpa-for-one-service}

Trong values của service, bật Autoscaling với min 2, max 6 replica và CPU Target 70%. Cấu hình CPU Requests, Commit/push rồi ArgoCD sync:

```bash
kubectl --context eks-workload -n shopnow get hpa
kubectl --context eks-workload -n shopnow describe hpa
```

Gửi request vào API và theo dõi CPU target, số replica mong muốn, số replica đang chạy cùng NodeClaim. HPA có thể tăng replica trên các node hiện tại nếu còn tài nguyên. Khi dừng tạo tải, ghi lại thời điểm replica và node giảm để xem cả hai cơ chế hoạt động ra sao.

## 4. Cấu hình KEDA {#4-keda-one-owner-per-target}

Cài chart KEDA ghim phiên bản; kiểm tra CRD/operator/metrics adapter. Đã có values và ScaledObject nhưng Terraform hiện chưa cài release KEDA. Trước khi apply:

1. Tắt HPA thông thường trên Deployment đó.
2. Cấu hình ArgoCD ngừng quản lý `/spec/replicas` của target hiện tại.
3. Xác nhận ScaledObject dùng đúng tên Deployment.
4. Apply `platform/addons/keda/shopnow-scaledobjects.yaml` qua công cụ quản lý đã chọn.

ScaledObject hiện kết hợp cron ngày thường 09:00–19:00 giờ Việt Nam với **CPU usage** Prometheus, không phải HTTP RPS. `minReplicaCount=0` có thể dừng service ngoài khung giờ. CPU của Pod đã dừng không phải tín hiệu request độc lập để đánh thức chúng; cron là nguồn kích hoạt còn lại trong cấu hình này.

Để thử ngay, tạo Deployment/ScaledObject riêng với cửa sổ cron ngắn. Không đổi lịch hoạt động của ứng dụng đang được dùng chỉ để demo.

## 5. Cấu hình CPA cho CoreDNS {#5-cpa-for-coredns}

Manifest là `platform/addons/cluster-proportional-autoscaler/coredns-autoscaler.yaml`. Kiểm tra target deployment/coredns và autoscaling EKS add-on trước khi apply; không để hai controller tranh quyền replica. Chỉ thử khi autoscaler khác không quản lý scaling CoreDNS.

Sau apply, xem log CPA và replica CoreDNS theo số node/core. Khôi phục cấu hình trước sau khi thử; xóa CPA không tự đặt lại replica CoreDNS.

## 6. Cleanup Autoscaling {#6-restore}

Xóa ScaledObject trước khi uninstall KEDA và trả quyền quản lý replica về Git. Tắt HPA qua values rồi sync. Xóa bộ tạo tải. Kiểm tra lại PDB/replica trước khi trở về workshop chính.

Tham khảo: [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/), [khái niệm KEDA](https://keda.sh/docs/latest/concepts/).

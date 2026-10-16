---
title: "Mở rộng — Triển khai và kiểm thử HPA, CPA, KEDA"
---

# Bật scaling sau khi kiểm thử availability thành công {#enable-scaling-after-availability-tests-pass}

Scale-to-zero mâu thuẫn với bài thử yêu cầu luôn có hai replica Ready. Tắt thử nghiệm scaling hoặc dùng target riêng trong nghiệm thu PDB/EFS.

## 1. Metrics Server do Terraform quản lý {#1-metrics-server-belongs-to-terraform}

```bash
kubectl --context eks-workload -n kube-system get deployment metrics-server
kubectl --context eks-workload top pods -n shopnow
```

Không cài release thứ hai. Với metrics `<unknown>`, kiểm tra APIService và log metrics-server trước.

## 2. Sửa target HPA trước khi bật {#2-repair-the-hpa-target-before-enabling-it}

`templates/hpa.yaml` hiện dùng helper fullname, trong khi Deployment có tên `<global.appName>-deployment`. Cập nhật cả sáu backend chart trước khi bật HPA:

```yaml
scaleTargetRef:
  apiVersion: apps/v1
  kind: Deployment
  name: {{ .Values.global.appName }}-deployment
```

Đặt namespace từ `global.namespace`. Thêm `behavior.scaleDown.stabilizationWindowSeconds: 300` dưới `spec` khi phù hợp để tránh scale-down quá nhanh. Render và xác nhận `scaleTargetRef.name` khớp Deployment, không chỉ kiểm tra cú pháp YAML.

Deployment chỉ nên render `replicas` khi chart quản lý trường đó. Với scaler bên ngoài, đặt `ignoreDifferences` của Application cho `/spec/replicas` và `RespectIgnoreDifferences=true`; nếu không, ArgoCD có thể liên tục khôi phục số replica từ values.

## 3. Bật CPU HPA cho một service {#3-enable-cpu-hpa-for-one-service}

Trong values Application đọc, bật autoscaling với tối thiểu 2, tối đa 6, CPU target 70. Phải có CPU requests. Commit/push, sync rồi kiểm tra:

```bash
kubectl --context eks-workload -n shopnow get hpa
kubectl --context eks-workload -n shopnow describe hpa
```

Tạo tải API thực tế và quan sát phần trăm target, replica mong muốn/hiện tại và NodeClaim. Vượt CPU target không nhất thiết tạo node nếu worker hiện tại còn capacity. Dừng tải và đo scale-down, không hứa thời gian cố định.

## 4. KEDA: một bên quản lý mỗi target {#4-keda-one-owner-per-target}

Cài chart KEDA ghim phiên bản; kiểm chứng CRD/operator/metrics adapter. Đã có values và ScaledObject nhưng Terraform hiện chưa cài release KEDA. Trước khi apply:

1. Tắt HPA thông thường trên Deployment đó.
2. Cấu hình ArgoCD ngừng quản lý `/spec/replicas` của target hiện tại.
3. Xác nhận ScaledObject dùng đúng tên Deployment.
4. Apply `platform/addons/keda/shopnow-scaledobjects.yaml` qua công cụ quản lý đã chọn.

ScaledObject hiện kết hợp cron ngày thường 09:00–19:00 giờ Việt Nam với **CPU usage** Prometheus, không phải HTTP RPS. `minReplicaCount=0` có thể dừng service ngoài khung giờ. CPU của Pod đã dừng không phải tín hiệu request độc lập để đánh thức chúng; cron là nguồn kích hoạt còn lại trong cấu hình này.

Để thử ngay, tạo Deployment/ScaledObject riêng với cửa sổ cron ngắn. Không đổi lịch hoạt động của ứng dụng đang được dùng chỉ để demo.

## 5. CPA cho CoreDNS {#5-cpa-for-coredns}

Manifest là `platform/addons/cluster-proportional-autoscaler/coredns-autoscaler.yaml`. Kiểm chứng target deployment/coredns và autoscaling EKS add-on trước khi apply; không để hai controller tranh quyền replica. Chỉ thử khi autoscaler khác không quản lý scaling CoreDNS.

Sau apply, xem log CPA và replica CoreDNS theo số node/core. Khôi phục cấu hình trước sau khi thử; xóa CPA không tự đặt lại replica CoreDNS.

## 6. Khôi phục {#6-restore}

Xóa ScaledObject trước khi uninstall KEDA và trả quyền quản lý replica về Git. Tắt HPA qua values rồi sync. Xóa bộ tạo tải. Kiểm tra lại PDB/replica trước khi trở về bài cốt lõi.

Tham khảo: [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/), [khái niệm KEDA](https://keda.sh/docs/latest/concepts/).

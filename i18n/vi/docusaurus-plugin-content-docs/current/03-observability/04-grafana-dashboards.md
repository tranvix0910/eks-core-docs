---
title: "Bước 4.4 — Query metrics và logs trên Grafana"
sidebar_label: "4.4 Grafana"
---

# Bước 4.4 — Query metrics và logs trên Grafana {#step-44--observe-cluster-1-from-grafana}

Mimir và Loki đã nhận dữ liệu từ workload cluster. Bây giờ chúng ta sẽ mở Grafana trên observability cluster, kiểm tra datasource và xem metrics, logs của ứng dụng.

**Thời gian:** khoảng 10 phút.

## 1. Truy cập Grafana {#1-open-grafana}

```bash
kubectl --context eks-observability -n monitoring port-forward svc/grafana 3000:80
kubectl --context eks-observability -n monitoring get secret grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode; echo
```

Mở http://localhost:3000 và đăng nhập bằng `admin`.

## 2. Datasource {#2-datasources}

Terraform tạo datasource từ `platform/observability/grafana/values.yaml`:

| Datasource | URL trong cluster 2 | Ghi chú |
|---|---|---|
| Mimir | `http://mimir-gateway.monitoring.svc.cluster.local/prometheus` | Header `X-Scope-OrgID: eks-workload` |
| Loki | `http://loki-gateway.monitoring.svc.cluster.local` | — |

Để cập nhật Datasource, sửa values rồi plan và apply lại layer 21. Cấu hình chỉ sửa trên UI có thể bị ghi đè khi deploy lại.

## 3. Query metrics và logs {#3-queries-that-prove-the-requirement}

Trong **Explore**, chọn **Mimir**:

```promql
# CPU per application Pod (cores)
sum by (pod) (rate(container_cpu_usage_seconds_total{cluster="eks-workload", namespace="shopnow", container!=""}[5m]))
```

```promql
# Memory per application Pod
sum by (pod) (container_memory_working_set_bytes{cluster="eks-workload", namespace="shopnow", container!=""})
```

```promql
# Cluster 1 nodes (infra + every Karpenter pool)
count(kube_node_info{cluster="eks-workload"})
```

Chọn **Loki**:

```logql
{cluster="eks-workload", namespace="shopnow"} |= "workshop-proof"
```

**Kết quả:** cả bốn query có dữ liệu trong 15 phút gần nhất. Lưu ảnh từng query kèm khoảng thời gian làm kết quả kiểm tra.

## 4. Dashboard {#4-dashboard}

dashboard **Enterprise Workload 360** được thêm ở bước 1.3 để xem Pod, node, CPU, memory và restart của workload cluster. Các panel dùng datasource UID `Mimir`. Nếu thấy *datasource not found*, sửa `uid: Mimir` trong values rồi apply lại layer 21.

## Mở rộng dashboard và Alert {#ideas-for-more}

- Tốc độ request và độ trễ HTTP cần service mở `/actuator/prometheus` cùng ServiceMonitor; năm Spring MVC service đã có Micrometer.
- Có thể thêm alert rule vào Mimir ruler và định tuyến qua Alertmanager.

**Tiếp theo:** [5.1 Kiểm tra](../operations/workshop-acceptance)

---
title: "Bước 4.4 — Quan sát cluster 1 từ Grafana"
sidebar_label: "4.4 Grafana"
---

# Bước 4.4 — Quan sát cluster 1 từ Grafana {#step-44--observe-cluster-1-from-grafana}

:::info Tóm tắt bước thực hành
**Mục tiêu:** query metrics và logs cluster 1 từ Grafana tập trung tại cluster 2.
**Yêu cầu:** 8, 9. **Thời gian:** khoảng 10 phút.
:::

## 1. Mở Grafana {#1-open-grafana}

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

Để thêm hoặc sửa datasource, sửa tệp values rồi apply lại lớp 21; thay đổi chỉ trên UI bị mất khi triển khai lại.

## 3. Query chứng minh yêu cầu {#3-queries-that-prove-the-requirement}

Trong **Explore**, chọn **Mimir**:

```promql
# CPU per ShopNow Pod (cores)
sum by (pod) (rate(container_cpu_usage_seconds_total{cluster="eks-workload", namespace="shopnow", container!=""}[5m]))
```

```promql
# Memory per ShopNow Pod
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

**Kết quả mong đợi:** cả bốn query có dữ liệu trong 15 phút gần nhất. Lưu ảnh từng query kèm khoảng thời gian làm bằng chứng.

## 4. Dashboard {#4-dashboard}

Dashboard **Enterprise Workload 360**, nạp tại bước 1.3, hiển thị Pod, node, CPU, memory và restart của cluster 1. Panel cần datasource UID `Mimir`; nếu báo *datasource not found*, đặt `uid: Mimir` cho datasource Mimir trong values rồi apply lại lớp 21.

## Hướng mở rộng {#ideas-for-more}

- Tốc độ request và độ trễ HTTP cần service mở `/actuator/prometheus` cùng ServiceMonitor; năm Spring MVC service đã có Micrometer.
- Có thể thêm alert rule vào Mimir ruler và định tuyến qua Alertmanager.

**Tiếp theo:** [5.1 Nghiệm thu](../operations/workshop-acceptance)

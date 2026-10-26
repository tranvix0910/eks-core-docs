---
title: "Bước 4.2 — Gửi metrics với Prometheus và Mimir"
sidebar_label: "4.2 Metrics → Mimir"
---

# Bước 4.2 — Gửi metrics với Prometheus và Mimir {#step-42--ship-metrics-to-mimir}

Sau khi cấu hình TLS và private DNS, chúng ta sẽ kiểm tra Prometheus có gửi được metrics sang Mimir hay chưa. Bắt đầu từ dữ liệu trên Prometheus, sau đó kiểm tra remote_write và query Mimir.

**Thời gian:** khoảng 10 phút. **Chạy từ:** thư mục bất kỳ.

## Cấu hình Prometheus remote_write {#how-it-is-configured}

Prometheus cluster 1 được Terraform cài với `platform/addons/prometheus/values.yaml`. Phần cấu hình liên quan:

```yaml
prometheus:
  prometheusSpec:
    externalLabels:
      cluster: eks-workload           # added to every series
    remoteWrite:
      - url: https://mimir.observability.internal:9009/api/v1/push
        headers:
          X-Scope-OrgID: eks-workload # Mimir tenant
        tlsConfig:
          caFile: /etc/prometheus/secrets/observability-alb-tls/ca.crt
```

Prometheus scrape các target trong workload cluster, lưu dữ liệu cục bộ rồi gửi samples sang Mimir bằng remote_write. Vì vậy, cần kiểm tra Prometheus đã scrape được dữ liệu trước khi tìm lỗi ở Mimir.

## 1. Prometheus scrape cluster 1 {#1-prometheus-scrapes-cluster-1}

```bash
kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090   # terminal 1
curl -fsSG http://localhost:9090/api/v1/query --data-urlencode 'query=count(up==1)' | jq '.data.result[0].value[1]'
```

**Kết quả:** số lớn hơn 0. Nếu Prometheus cục bộ không có dữ liệu, sửa scraping trước; remote_write không thể gửi dữ liệu chưa được scrape.

## 2. Kiểm tra remote_write {#2-remote_write-is-healthy}

```bash
curl -fsSG http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(prometheus_remote_storage_samples_total[5m])' | jq '.data.result[].value[1]'
curl -fsSG http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate(prometheus_remote_storage_samples_failed_total[5m])' | jq '.data.result[].value[1]'
```

**Kết quả:** số sample gửi mỗi giây lớn hơn 0, số lỗi gần 0. Log Prometheus thường hiển thị `x509` khi lỗi CA, `401/403` khi lỗi tenant hoặc `429` khi vượt giới hạn Mimir.

## Query metrics trực tiếp từ Mimir {#verify--query-mimir-directly}

```bash
kubectl --context eks-observability -n monitoring port-forward svc/mimir-gateway 19009:80   # terminal 2

curl -fsSG http://localhost:19009/prometheus/api/v1/query -H 'X-Scope-OrgID: eks-workload' \
  --data-urlencode 'query=count by (namespace) (kube_pod_info{cluster="eks-workload"})' \
  | jq -r '.data.result[] | "\(.metric.namespace) \(.value[1])"'
```

**Kết quả:** mỗi namespace cluster 1 có một dòng, bao gồm `shopnow`, được đếm từ dữ liệu đi qua remote_write.

## 3. Kiểm tra S3 storage {#3-data-reaches-s3}

```bash
aws s3 ls "s3://$(terraform -chdir="$TF_DIR/21-cluster-observability" output -raw mimir_bucket_name)/" --recursive | head
```

Mimir upload block lên S3 theo chu kỳ, thường khoảng hai giờ. Bucket có thể chưa có block ngay sau khi deploy. Nếu ingester hoặc compactor báo `AccessDenied`, kiểm tra Pod Identity association và quyền truy cập bucket.

**Tiếp theo:** [4.3 Logs → Loki](loki-logging-pipeline)

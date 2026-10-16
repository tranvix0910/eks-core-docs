---
title: "Bước 4.3 — Chuyển logs sang Loki bằng Alloy"
sidebar_label: "4.3 Logs → Loki"
---

# Bước 4.3 — Chuyển logs sang Loki bằng Alloy {#step-43--ship-logs-to-loki-with-alloy}

:::info Tóm tắt bước thực hành
**Mục tiêu:** query được log Pod từ mọi node cluster 1 tại Loki trên cluster 2.
**Yêu cầu:** 9. **Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Cách cấu hình {#how-it-is-configured}

Grafana **Alloy** chạy dưới dạng DaemonSet, mỗi node một agent, bao gồm node Karpenter. `examples/workshop/alloy-values.yaml` cấu hình:

- **Tolerate mọi taint**, nên chạy cả trên pool Spot, mixed và ARM64.
- Đọc tên node qua Downward API, chỉ thu thập **Pod trên chính node đó**, tránh trùng lặp.
- Đọc logs qua Kubernetes API (`loki.source.kubernetes`), không mount host path.
- Thêm label `cluster="eks-workload"`, `namespace`, `pod` và `container`.
- Push tới `https://loki.observability.internal:3100/loki/api/v1/push`, xác minh CA từ bước 4.1.

## 1. Cài Alloy {#1-install-alloy}

```bash
helm repo add grafana https://grafana.github.io/helm-charts && helm repo update grafana
helm --kube-context eks-workload upgrade --install alloy grafana/alloy --version 1.11.1 \
  --namespace monitoring -f "$GITOPS_DIR/examples/workshop/alloy-values.yaml" --wait --timeout 10m
```

## 2. Mỗi node một agent {#2-one-agent-on-every-node}

```bash
kubectl --context eks-workload -n monitoring get daemonset alloy
kubectl --context eks-workload get nodes --no-headers | wc -l
```

**Kết quả mong đợi:** `READY` của DaemonSet bằng số node.

## 3. Tạo dòng log để tìm kiếm {#3-generate-a-log-line-to-look-for}

`workshop-proof`, đã triển khai ở bước 3.3, in `workshop-proof <pod> <timestamp>` mỗi 15 giây:

```bash
kubectl --context eks-workload -n shopnow logs deployment/workshop-proof --tail=3
```

## Kiểm chứng — query trực tiếp Loki {#verify--query-loki-directly}

```bash
kubectl --context eks-observability -n monitoring port-forward svc/loki-gateway 13100:80   # terminal 1

START=$(( $(date +%s) - 900 ))000000000
curl -fsSG http://localhost:13100/loki/api/v1/query_range \
  --data-urlencode 'query={cluster="eks-workload", namespace="shopnow"} |= "workshop-proof"' \
  --data-urlencode "start=$START" --data-urlencode 'limit=5' \
  | jq -r '.data.result[].values[][1]' | tee "$EVIDENCE_DIR/loki-query.txt"
```

**Kết quả mong đợi:** dòng `workshop-proof …` gần đây với timestamp trong vài phút vừa qua.

| Triệu chứng | Kiểm tra |
|---|---|
| Số Pod Ready của DaemonSet ít hơn số node | `kubectl -n monitoring describe ds alloy` — toleration, tài nguyên |
| Log Alloy có `x509` | CA Secret `observability-alb-tls` trong `monitoring` (bước 4.1, phần 5) |
| Log Alloy có `no such host` | Private DNS record (bước 4.1, phần 4) |
| Query rỗng, Alloy không báo lỗi | Chờ một phút; kiểm tra giá trị label `cluster` trong query |

Loki dùng `auth_enabled: false` trong workshop, nên chỉ có mạng riêng và security group bảo vệ nó. Không công khai Loki gateway.

**Tiếp theo:** [4.4 Grafana](grafana-dashboards)

---
title: "Bước 4.3 — Collect Logs với Alloy và Loki"
sidebar_label: "4.3 Logs → Loki"
---

# Bước 4.3 — Collect Logs với Alloy và Loki {#step-43--ship-logs-to-loki-with-alloy}

:::info Nội dung thực hiện
**Mục tiêu:** cài Alloy trên các node Cluster Workload và query logs tại Loki của Cluster Observability.
**Yêu cầu:** 9. **Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Cấu hình Alloy {#how-it-is-configured}

Grafana **Alloy** dùng DaemonSet, mỗi node có 1 agent, bao gồm node Karpenter. File `examples/workshop/alloy-values.yaml` cấu hình:

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

## 2. Kiểm tra Alloy DaemonSet {#2-one-agent-on-every-node}

```bash
kubectl --context eks-workload -n monitoring get daemonset alloy
kubectl --context eks-workload get nodes --no-headers | wc -l
```

**Kết quả cần có:** `READY` của DaemonSet bằng số node.

## 3. Tạo Log để kiểm tra {#3-generate-a-log-line-to-look-for}

`workshop-proof`, đã triển khai ở bước 3.3, in `workshop-proof <pod> <timestamp>` mỗi 15 giây:

```bash
kubectl --context eks-workload -n shopnow logs deployment/workshop-proof --tail=3
```

## Query Logs trực tiếp từ Loki {#verify--query-loki-directly}

```bash
kubectl --context eks-observability -n monitoring port-forward svc/loki-gateway 13100:80   # terminal 1

START=$(( $(date +%s) - 900 ))000000000
curl -fsSG http://localhost:13100/loki/api/v1/query_range \
  --data-urlencode 'query={cluster="eks-workload", namespace="shopnow"} |= "workshop-proof"' \
  --data-urlencode "start=$START" --data-urlencode 'limit=5' \
  | jq -r '.data.result[].values[][1]' | tee "$EVIDENCE_DIR/loki-query.txt"
```

**Kết quả cần có:** dòng `workshop-proof …` gần đây với timestamp trong vài phút vừa qua.

| Triệu chứng | Kiểm tra |
|---|---|
| Số Pod Ready của DaemonSet ít hơn số node | `kubectl -n monitoring describe ds alloy` — toleration, tài nguyên |
| Log Alloy có `x509` | CA Secret `observability-alb-tls` trong `monitoring` (bước 4.1, phần 5) |
| Log Alloy có `no such host` | Private DNS record (bước 4.1, phần 4) |
| Query rỗng, Alloy không báo lỗi | Chờ một phút; kiểm tra giá trị label `cluster` trong query |

Workshop đặt Loki `auth_enabled: false`. Giữ Loki Gateway trong mạng riêng và giới hạn Security Group; không mở Public Endpoint cho gateway này.

**Tiếp theo:** [4.4 Grafana](grafana-dashboards)

---
title: "Bước 3.5 — PodDisruptionBudget và tính sẵn sàng"
sidebar_label: "3.5 PodDisruptionBudget"
---

# Bước 3.5 — PodDisruptionBudget và tính sẵn sàng {#step-35--poddisruptionbudget-and-availability}

:::info Tóm tắt bước thực hành
**Mục tiêu:** chứng minh PodDisruptionBudget chặn eviction làm giảm availability, cho phép eviction trong budget và API tiếp tục trả lời khi eviction tương tự thao tác bảo trì node.
**Yêu cầu:** 6. **Thời gian:** khoảng 20 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## PDB làm gì {#what-a-pdb-does}

PodDisruptionBudget giới hạn **eviction tự nguyện** như `kubectl drain`, nâng cấp node, Karpenter consolidation. Trước khi evict Pod, Kubernetes kiểm tra budget; nếu còn quá ít Pod healthy sau eviction, request bị từ chối với HTTP 429.

| Workload | PDB | Khi có 2 replica Ready |
|---|---|---|
| Từng backend, trừ Eureka | `maxUnavailable: 1` | Mỗi lần được evict một Pod |
| `workshop-proof` (3 replica) | `minAvailable: 2` | Cho phép một eviction; không cho phép nếu đã có Pod unready |

PDB **không** ngăn `kubectl delete pod` trực tiếp, node crash hoặc Spot bị thu hồi. Tính sẵn sàng trước các sự kiện đó đến từ nhiều replica phân bổ qua node và zone ([bước 3.4](pod-placement)).

```bash
kubectl --context eks-workload -n shopnow get pdb
```

**Kết quả mong đợi:** mỗi backend trừ Eureka có một PDB với `ALLOWED DISRUPTIONS 1`; `workshop-proof` có `MIN AVAILABLE 2`.

## 1. Eviction bị từ chối khi budget bằng 0 {#1-an-eviction-is-refused-when-the-budget-is-0}

Làm một Pod `workshop-proof` unready; readiness probe kiểm tra tệp trên EFS. Chỉ còn hai trong ba Pod healthy và budget giảm về 0:

```bash
P=(kubectl --context eks-workload -n shopnow)
HOLD=$("${P[@]}" get pods -l app=workshop-proof -o jsonpath='{.items[0].metadata.name}')
"${P[@]}" exec "$HOLD" -- sh -c 'mv "/data/$HOSTNAME" "/data/$HOSTNAME.hold"'
"${P[@]}" wait "pod/$HOLD" --for=condition=Ready=false --timeout=2m
"${P[@]}" get pdb workshop-proof          # ALLOWED DISRUPTIONS 0
```

Yêu cầu API evict một Pod healthy **khác**, đúng như `kubectl drain` thực hiện:

```bash
VICTIM=$("${P[@]}" get pods -l app=workshop-proof -o json | jq -r --arg h "$HOLD" '.items[] | select(.metadata.name!=$h) | .metadata.name' | head -1)
evict() { kubectl --context eks-workload create --raw "/api/v1/namespaces/shopnow/pods/$1/eviction" -f - <<JSON
{"apiVersion":"policy/v1","kind":"Eviction","metadata":{"name":"$1","namespace":"shopnow"}}
JSON
}
evict "$VICTIM" 2>&1 | tee "$EVIDENCE_DIR/pdb-refused.txt"
```

**Kết quả mong đợi:** `Cannot evict pod as it would violate the pod's disruption budget` (HTTP 429); Pod vẫn đang chạy.

## 2. Eviction được phép khi budget bằng 1 {#2-an-eviction-is-allowed-when-the-budget-is-1}

Khôi phục Pod unready, chờ budget trở lại 1 rồi lặp lại:

```bash
"${P[@]}" exec "$HOLD" -- sh -c 'mv "/data/$HOSTNAME.hold" "/data/$HOSTNAME"'
"${P[@]}" wait "pod/$HOLD" --for=condition=Ready --timeout=2m
"${P[@]}" get pdb workshop-proof          # ALLOWED DISRUPTIONS 1

evict "$VICTIM" | tee "$EVIDENCE_DIR/pdb-allowed.txt"
"${P[@]}" rollout status deployment/workshop-proof --timeout=10m
"${P[@]}" get pods -l app=workshop-proof -o wide
```

**Kết quả mong đợi:** eviction thành công, Deployment tạo Pod thay thế và cả ba Pod trở lại Ready.

## 3. API tiếp tục hoạt động trong eviction {#3-the-api-stays-up-during-an-eviction}

Giữ port-forward gateway (`svc/shopnow-api-gateway-service 5860:5860`). Trong một terminal, gọi API liên tục:

```bash
for i in $(seq 1 90); do
  printf '%s %s\n' "$(date -u +%T)" "$(curl -s -o /dev/null -m 3 -w '%{http_code}' http://localhost:5860/product)"
  sleep 1
done | tee "$EVIDENCE_DIR/availability.txt"
```

Trong terminal khác, evict một product Pod thông qua budget:

```bash
evict "$("${P[@]}" get pods -l app=shopnow-product-service -o jsonpath='{.items[0].metadata.name}')"
```

**Kết quả mong đợi:** eviction được chấp nhận vì budget bằng 1; các request đều trả `200`, hoặc chỉ gián đoạn ngắn khi gateway cập nhật Eureka. Đếm và báo cáo số dòng khác 200.

## 4. Drain thực tế (tùy chọn) {#4-a-real-drain-optional}

`kubectl drain` evict mọi Pod trên node qua cùng các budget. Thử trên node pool 2 không chứa database:

```bash
kubectl --context eks-workload get pods -n shopnow -o wide | grep <node-name>
kubectl --context eks-workload drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl --context eks-workload uncordon <node-name>
```

Drain chờ khi eviction vi phạm budget và tiếp tục khi Pod thay thế Ready.

**Tiếp theo:** [4.1 TLS và DNS nội bộ](../platform-addons/cert-manager-and-internal-tls)

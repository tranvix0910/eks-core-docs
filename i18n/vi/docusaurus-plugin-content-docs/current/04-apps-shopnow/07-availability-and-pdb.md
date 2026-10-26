---
title: "Bước 3.5 — PodDisruptionBudget"
sidebar_label: "3.5 PodDisruptionBudget"
---

# Bước 3.5 — PodDisruptionBudget {#step-35--poddisruptionbudget-and-availability}

Trong phần này, chúng ta sẽ tìm hiểu PDB kiểm soát eviction như thế nào, rồi thử hai trường hợp: eviction bị chặn và eviction được phép. Sau đó, gọi API trong lúc thay Pod để quan sát ảnh hưởng thực tế.

**Thời gian:** khoảng 20 phút. **Chạy từ:** `$GITOPS_DIR`.

## Scheduling, replica và PDB {#availability-basics}

### Nhiều replica đã đủ chưa?

Nếu hai replica cùng chạy trên một node, mất node đó vẫn làm cả hai Pod ngừng phục vụ. Chúng ta cần xem cả số replica lẫn nơi các Pod đang chạy. Service và readiness probe giúp điều phối request tới Pod sẵn sàng, còn scheduling quyết định các Pod nằm trên node nào.

Node selector chọn các node có label phù hợp. Taint hạn chế Pod vào node; toleration cho phép Pod chấp nhận taint đó. Các điều kiện này đưa backend của ứng dụng vào mixed pool, nhưng bản thân chúng chưa phân bổ replica đều.

### Topology spread và Pod anti-affinity

Topology spread constraints đếm Pod theo các domain như hostname hoặc AZ và giới hạn độ lệch qua `maxSkew`. Ví dụ, ba replica trên hai node có thể phân bố 2 + 1. Với `DoNotSchedule`, Pod chưa có vị trí thỏa điều kiện sẽ tiếp tục Pending.

Pod anti-affinity mô tả các Pod không nên hoặc không được ở cùng domain. Quy tắc required mỗi node một replica cần thêm node khi tăng replica. Trong workshop, topology spread được dùng để giữ phân bố tương đối đều khi số replica thay đổi.

Các phép đếm chỉ có ý nghĩa khi biết label selector và các node đủ điều kiện. Cần tính cả domain chưa có Pod, không chỉ đếm các node đang xuất hiện trong danh sách Pod.

### PDB kiểm soát việc nào?

PDB đặt mức availability cần giữ khi có request eviction tự nguyện. Ví dụ, `workshop-proof` có ba replica và `minAvailable: 2`. Khi cả ba Ready, budget cho phép evict một Pod. Nếu một Pod đã Unready, eviction thêm một Pod healthy có thể bị từ chối.

PDB không tạo thêm replica. Nó cũng không chặn node crash, AWS thu hồi Spot hoặc lệnh xóa Pod trực tiếp. Trong rolling update, Deployment controller dùng các tham số rollout của Deployment để quyết định số Pod được thay. Vì vậy không thể xem PDB là bảo đảm HA cho toàn ứng dụng.

### Chúng ta sẽ quan sát gì trong lab?

Đầu tiên làm một Pod `workshop-proof` Unready để budget về 0 và gửi request eviction. Tiếp theo khôi phục Pod, chờ budget về 1 rồi thử lại. Cuối cùng, gọi API trong lúc evict một Product Pod để ghi lại kết quả thực tế, kể cả request lỗi nếu có.

Đọc thêm: [Pod disruptions và PDB](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/), [topology spread constraints](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/).

## Cách PDB hoạt động {#what-a-pdb-does}

PDB được kiểm tra khi có yêu cầu eviction, chẳng hạn trong `kubectl drain` hoặc Karpenter consolidation. Kubernetes từ chối request bằng HTTP `429` nếu việc evict Pod làm vi phạm budget. Vì vậy, chúng ta cần thử bằng eviction API để quan sát đúng hành vi của PDB.

| Workload | PDB | Khi có 2 replica Ready |
|---|---|---|
| Từng backend, trừ Eureka | `maxUnavailable: 1` | Mỗi lần được evict một Pod |

`discovery-server` (Eureka) và frontend chỉ chạy một replica nên chart không tạo PDB cho chúng: budget trên một replica hoặc chặn mọi lần drain, hoặc không bảo vệ được gì. Khi drain node đang chạy chúng, service sẽ gián đoạn trong lúc Pod khởi động lại; hãy tăng lên hai replica nếu cần tránh điều này.
| `workshop-proof` (3 replica) | `minAvailable: 2` | Cho phép một eviction; không cho phép nếu đã có Pod unready |

PDB không chặn lệnh xóa Pod trực tiếp và không ngăn node bị crash hoặc Spot instance bị thu hồi. Các trường hợp này vẫn cần replica được phân bổ qua nhiều node và AZ như [bước 3.4](pod-placement).

```bash
kubectl --context eks-workload -n shopnow get pdb
```

**Kết quả:** mỗi backend trừ Eureka có một PDB với `ALLOWED DISRUPTIONS 1`; `workshop-proof` có `MIN AVAILABLE 2`.

## 1. Eviction với budget 0 {#1-an-eviction-is-refused-when-the-budget-is-0}

Làm một Pod `workshop-proof` Unready qua file mà Readiness Probe kiểm tra trên EFS. Khi còn 2/3 Pod Healthy, budget giảm về 0:

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

**Kết quả:** `Cannot evict pod as it would violate the pod's disruption budget` (HTTP 429); Pod vẫn đang chạy.

## 2. Eviction với budget 1 {#2-an-eviction-is-allowed-when-the-budget-is-1}

Khôi phục Pod unready, chờ budget trở lại 1 rồi lặp lại:

```bash
"${P[@]}" exec "$HOLD" -- sh -c 'mv "/data/$HOSTNAME.hold" "/data/$HOSTNAME"'
"${P[@]}" wait "pod/$HOLD" --for=condition=Ready --timeout=2m
"${P[@]}" get pdb workshop-proof          # ALLOWED DISRUPTIONS 1

evict "$VICTIM" | tee "$EVIDENCE_DIR/pdb-allowed.txt"
"${P[@]}" rollout status deployment/workshop-proof --timeout=10m
"${P[@]}" get pods -l app=workshop-proof -o wide
```

**Kết quả:** eviction thành công, Deployment tạo Pod thay thế và cả ba Pod trở lại Ready.

## 3. Kiểm tra API khi Evict Pod {#3-the-api-stays-up-during-an-eviction}

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

**Kết quả:** eviction được chấp nhận khi budget bằng 1. Theo dõi HTTP status trong lúc Product Pod được thay, đếm số request khác `200` và ghi thời gian lỗi nếu có. Gateway cập nhật thông tin từ Eureka có thể ảnh hưởng kết quả trong khoảng chuyển tiếp.

## 4. Thử drain node (tùy chọn) {#4-a-real-drain-optional}

`kubectl drain` evict mọi Pod trên node qua cùng các budget. Thử trên node pool 2 không chứa database:

```bash
kubectl --context eks-workload get pods -n shopnow -o wide | grep <node-name>
kubectl --context eks-workload drain <node-name> --ignore-daemonsets --delete-emptydir-data
kubectl --context eks-workload uncordon <node-name>
```

Theo dõi Drain: thao tác chờ nếu eviction vi phạm budget và tiếp tục khi Pod thay thế Ready.

**Tiếp theo:** [4.1 TLS và DNS nội bộ](../platform-addons/cert-manager-and-internal-tls)

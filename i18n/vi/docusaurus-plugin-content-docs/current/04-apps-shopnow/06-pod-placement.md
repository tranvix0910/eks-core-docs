---
title: "Bước 3.4 — Phân bổ Pod"
sidebar_label: "3.4 Phân bổ Pod"
---

# Bước 3.4 — Phân bổ Pod {#step-34--spread-replicas-evenly-across-nodes-and-zones}

Khi một service có nhiều replica, chúng ta cần tránh để tất cả Pod chạy trên cùng một node. Phần này kiểm tra cách ứng dụng sử dụng topology spread constraints để phân bổ replica giữa các node và availability Zone.

**Thời gian:** khoảng 10 phút. **Chạy từ:** `$GITOPS_DIR`.

## Cấu hình Topology Spread Constraints {#how-spreading-is-enforced}

Mỗi backend chart (`apps/shopnow-backend-config/*-chart/templates/deployment.yaml`) đặt hai **topology spread constraint** khi `replicaCount > 1`:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    minDomains: 2
    topologyKey: topology.kubernetes.io/zone   # spread across AZs
    whenUnsatisfiable: DoNotSchedule
    nodeAffinityPolicy: Honor
    nodeTaintsPolicy: Honor
    labelSelector:
      matchLabels: { app: <service> }
    matchLabelKeys: [pod-template-hash]
  - maxSkew: 1
    minDomains: 2
    topologyKey: kubernetes.io/hostname        # spread across nodes
    whenUnsatisfiable: DoNotSchedule
    nodeAffinityPolicy: Honor
    nodeTaintsPolicy: Honor
    labelSelector:
      matchLabels: { app: <service> }
    matchLabelKeys: [pod-template-hash]
```

| Trường | Tác dụng |
|---|---|
| `maxSkew: 1` | Số replica của một service chênh tối đa 1 giữa hai node hoặc zone |
| `whenUnsatisfiable: DoNotSchedule` | Ràng buộc bắt buộc: replica vi phạm phân bổ giữ `Pending` thay vì dồn vào cùng chỗ |
| `minDomains: 2` | Cần ít nhất hai node / zone; nếu chỉ có một, Karpenter được yêu cầu cấp node thứ hai |
| `nodeAffinityPolicy` / `nodeTaintsPolicy: Honor` | Chỉ tính node pool 2; bỏ qua node infra, Spot và ARM64 |
| `matchLabelKeys: [pod-template-hash]` | Khi rolling update, đếm riêng Pod phiên bản cũ và mới |

Topology spread constraints cho phép phân bổ ba replica trên hai node theo cách 2 + 1, miễn là độ lệch không vượt `maxSkew: 1`. Nếu dùng required Pod anti-affinity theo hostname, mỗi replica phải có node riêng. Với workshop này, topology spread giúp tăng replica mà vẫn giữ phân bố đều.

Karpenter đọc các yêu cầu scheduling để tìm capacity phù hợp, kể cả AZ cần thêm node. Nếu Pod vẫn Pending, kiểm tra cả CPU limit của NodePool, subnet và EC2 capacity.

## 1. Kiểm tra Placement từng Service {#1-placement-of-every-service}

```bash
kubectl --context eks-workload get nodes -l workload=microservices -o json \
  | jq -r '.items[] | [.metadata.name, .metadata.labels["topology.kubernetes.io/zone"]] | @tsv' > /tmp/node-zone.tsv

kubectl --context eks-workload -n shopnow get pods -o json | jq -r '.items[]
  | select(.status.phase=="Running") | [.metadata.labels.app, .spec.nodeName] | @tsv' \
| awk -F'\t' 'NR==FNR {zone[$1]=$2; next} {print $1"\t"$2"\t"zone[$2]}' /tmp/node-zone.tsv - \
| sort | column -t | tee /tmp/placement.txt
```

**Kết quả:** với service có hai replica, hai Pod ở **node khác nhau** và **zone khác nhau**. Service một replica như Eureka và database xuất hiện một lần.

## 2. Kiểm tra Skew {#2-skew-per-service}

```bash
awk '{n[$1]++; host[$1" "$2]++} END {for (k in host) {split(k,a," "); c[a[1]]++; if (host[k]>m[a[1]]) m[a[1]]=host[k]}
     for (s in n) printf "%-36s replicas=%d nodes=%d max-per-node=%d\n", s, n[s], c[s], m[s]}' \
  /tmp/placement.txt | sort
```

**Kết quả:** `max-per-node=1` cho mọi service có hai replica.

## 3. Kiểm tra 3 replica của workload thực hành {#3-three-replicas-on-the-proof-workload}

`workshop-proof` có ba replica và cùng quy tắc hostname bắt buộc, cho thấy cách phân bổ khi replica nhiều hơn node:

```bash
kubectl --context eks-workload get nodes -l workload=microservices --no-headers | wc -l
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof -o wide
```

Nếu mixed pool có hai node đủ điều kiện, ba replica sẽ được phân bố 2 + 1. Nếu có từ ba node đủ điều kiện trở lên, mỗi node có thể nhận một replica. Cần đếm cả node chưa có Pod của service đó khi tính độ lệch.

## Xử lý Pod Pending {#if-a-replica-stays-pending}

```bash
kubectl --context eks-workload -n shopnow describe pod <pending-pod> | grep -A3 Events
```

Nếu gặp `didn't match pod topology spread constraints`, kiểm tra khả năng cấp node mixed pool ở zone khác: CPU limit, Spot capacity và subnet. Giữ `DoNotSchedule` để bài test vẫn kiểm tra phân bố bắt buộc.

**Tiếp theo:** [3.5 PodDisruptionBudget](availability-and-pdb)

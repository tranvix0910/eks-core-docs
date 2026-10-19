---
title: "Bước 3.4 — Pod Placement"
sidebar_label: "3.4 Pod Placement"
---

# Bước 3.4 — Pod Placement {#step-34--spread-replicas-evenly-across-nodes-and-zones}

:::info Nội dung thực hiện
**Mục tiêu:** kiểm tra replica của từng service được phân bổ đều trên worker node và Availability Zone.
**Yêu cầu:** 5. **Thời gian:** khoảng 10 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

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

**Topology Spread Constraints** cho phép chia 3 replica trên 2 node theo phân bố 2 + 1 và giữ `maxSkew: 1`. Required Pod Anti-Affinity theo hostname chỉ cho phép một replica mỗi node, nên cần thêm node khi tăng replica. Workshop dùng Topology Spread để giữ phân bố đều khi thay đổi số replica.

Karpenter dùng Scheduling Constraints để cấp node phù hợp, bao gồm zone cần thêm capacity. Việc cấp node còn phụ thuộc NodePool Limit và EC2 Capacity.

## 1. Kiểm tra Placement từng Service {#1-placement-of-every-service}

```bash
kubectl --context eks-workload get nodes -l workload=microservices -o json \
  | jq -r '.items[] | [.metadata.name, .metadata.labels["topology.kubernetes.io/zone"]] | @tsv' > /tmp/node-zone.tsv

kubectl --context eks-workload -n shopnow get pods -o json | jq -r '.items[]
  | select(.status.phase=="Running") | [.metadata.labels.app, .spec.nodeName] | @tsv' \
| awk -F'\t' 'NR==FNR {zone[$1]=$2; next} {print $1"\t"$2"\t"zone[$2]}' /tmp/node-zone.tsv - \
| sort | column -t | tee "$EVIDENCE_DIR/placement.txt"
```

**Kết quả cần có:** với service có hai replica, hai Pod ở **node khác nhau** và **zone khác nhau**. Service một replica như Eureka và database xuất hiện một lần.

## 2. Kiểm tra Skew {#2-skew-per-service}

```bash
awk '{n[$1]++; host[$1" "$2]++} END {for (k in host) {split(k,a," "); c[a[1]]++; if (host[k]>m[a[1]]) m[a[1]]=host[k]}
     for (s in n) printf "%-36s replicas=%d nodes=%d max-per-node=%d\n", s, n[s], c[s], m[s]}' \
  "$EVIDENCE_DIR/placement.txt" | sort
```

**Kết quả cần có:** `max-per-node=1` cho mọi service có hai replica.

## 3. Kiểm tra 3 Replica của Workload Test {#3-three-replicas-on-the-proof-workload}

`workshop-proof` có ba replica và cùng quy tắc hostname bắt buộc, cho thấy cách phân bổ khi replica nhiều hơn node:

```bash
kubectl --context eks-workload get nodes -l workload=microservices --no-headers | wc -l
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof -o wide
```

Với hai node pool 2, kết quả là 2 + 1; với từ ba node trở lên, mỗi node một replica. Không node nào chứa nhiều hơn node khác hai replica.

## Xử lý Pod Pending {#if-a-replica-stays-pending}

```bash
kubectl --context eks-workload -n shopnow describe pod <pending-pod> | grep -A3 Events
```

Nếu gặp `didn't match pod topology spread constraints`, kiểm tra khả năng cấp node Mixed Pool ở zone khác: CPU Limit, Spot Capacity và Subnet. Giữ `DoNotSchedule` để bài test vẫn kiểm tra phân bố bắt buộc.

**Tiếp theo:** [3.5 PodDisruptionBudget](availability-and-pdb)

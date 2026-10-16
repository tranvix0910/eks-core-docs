---
title: "Bước 3.4 — Phân bổ replica đều giữa node và zone"
sidebar_label: "3.4 Phân bổ đều"
---

# Bước 3.4 — Phân bổ replica đều giữa node và zone {#step-34--spread-replicas-evenly-across-nodes-and-zones}

:::info Tóm tắt bước thực hành
**Mục tiêu:** chứng minh replica của từng service nằm trên các worker node và Availability Zone khác nhau.
**Yêu cầu:** 5. **Thời gian:** khoảng 10 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Cách bắt buộc phân bổ đều {#how-spreading-is-enforced}

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

**Vì sao dùng topology spread thay Pod anti-affinity?** Required anti-affinity với quy tắc mỗi node một replica cần một node cho mỗi replica và ngừng mở rộng khi hết node. Topology spread cho phép 3 replica trên 2 node theo tỷ lệ 2 + 1 và tiếp tục mở rộng mà vẫn phân bổ đều. Cách này cũng giảm chi phí xử lý của scheduler.

Karpenter đọc các ràng buộc này: khi không thể đặt replica thứ hai, nó tạo node ở zone khác thay vì để Pod Pending lâu.

## 1. Placement của từng service {#1-placement-of-every-service}

```bash
kubectl --context eks-workload get nodes -l workload=microservices -o json \
  | jq -r '.items[] | [.metadata.name, .metadata.labels["topology.kubernetes.io/zone"]] | @tsv' > /tmp/node-zone.tsv

kubectl --context eks-workload -n shopnow get pods -o json | jq -r '.items[]
  | select(.status.phase=="Running") | [.metadata.labels.app, .spec.nodeName] | @tsv' \
| awk -F'\t' 'NR==FNR {zone[$1]=$2; next} {print $1"\t"$2"\t"zone[$2]}' /tmp/node-zone.tsv - \
| sort | column -t | tee "$EVIDENCE_DIR/placement.txt"
```

**Kết quả mong đợi:** với service có hai replica, hai Pod ở **node khác nhau** và **zone khác nhau**. Service một replica như Eureka và database xuất hiện một lần.

## 2. Độ lệch theo service {#2-skew-per-service}

```bash
awk '{n[$1]++; host[$1" "$2]++} END {for (k in host) {split(k,a," "); c[a[1]]++; if (host[k]>m[a[1]]) m[a[1]]=host[k]}
     for (s in n) printf "%-36s replicas=%d nodes=%d max-per-node=%d\n", s, n[s], c[s], m[s]}' \
  "$EVIDENCE_DIR/placement.txt" | sort
```

**Kết quả mong đợi:** `max-per-node=1` cho mọi service có hai replica.

## 3. Ba replica của workload kiểm chứng {#3-three-replicas-on-the-proof-workload}

`workshop-proof` có ba replica và cùng quy tắc hostname bắt buộc, cho thấy cách phân bổ khi replica nhiều hơn node:

```bash
kubectl --context eks-workload get nodes -l workload=microservices --no-headers | wc -l
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof -o wide
```

Với hai node pool 2, kết quả là 2 + 1; với từ ba node trở lên, mỗi node một replica. Không node nào chứa nhiều hơn node khác hai replica.

## Nếu replica vẫn Pending {#if-a-replica-stays-pending}

```bash
kubectl --context eks-workload -n shopnow describe pod <pending-pod> | grep -A3 Events
```

`didn't match pod topology spread constraints` nghĩa là scheduler đang bảo vệ ràng buộc phân bổ. Kiểm tra Karpenter có thể tạo node pool 2 ở zone khác không: giới hạn CPU, capacity Spot, subnet. Không nới thành `ScheduleAnyway`, vì sẽ bỏ bảo đảm mà đề bài yêu cầu.

**Tiếp theo:** [3.5 PodDisruptionBudget](availability-and-pdb)

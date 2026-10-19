---
title: "Bước 2.2 — Setup Karpenter NodePools"
sidebar_label: "2.2 NodePools"
---

# Bước 2.2 — Setup Karpenter NodePools {#step-22--create-the-three-karpenter-node-pools}

:::info Nội dung thực hiện
**Mục tiêu:** tạo 3 nhóm Karpenter: Spot, Mixed On-Demand/Spot và ARM64; chạy Pod thử trên Spot Pool.
**Yêu cầu:** 2. **Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Karpenter trong Workshop {#how-karpenter-works-here}

Khi Pod `Pending` do thiếu node phù hợp, Karpenter chọn **NodePool** theo label, taint, architecture và capacity type để cấp EC2. Khi workload giảm, Karpenter có thể gộp hoặc xóa node theo Disruption Policy. Bạn khai báo yêu cầu của Pod và NodePool; Karpenter quản lý capacity.

| Đối tượng | File | Nội dung khai báo |
|---|---|---|
| `EC2NodeClass default` | `platform/nodepools/ec2nodeclass.yaml` | Node IAM role, subnet và security group tìm theo tag `karpenter.sh/discovery=eks-workload`, AMI `al2023`, IMDSv2, root disk gp3 mã hóa 30 GiB |
| `NodePool batch-spot` | `nodepool-1-spot.yaml` | **Pool 1** |
| `NodePool ms-od` + `NodePool ms-spot` | `nodepool-2-ondemand.yaml`, `nodepool-2-spot.yaml` | **Pool 2** |
| `NodePool arm64` | `nodepool-3-arm64.yaml` | **Pool 3** |

## 3 nhóm NodePool {#the-three-pools}

| | Pool 1 `batch-spot` | Pool 2 `ms-od` | Pool 2 `ms-spot` | Pool 3 `arm64` |
|---|---|---|---|---|
| Capacity type | Spot | On-Demand | Spot | On-Demand hoặc Spot |
| Architecture | amd64, arm64 | amd64 | amd64 | arm64 |
| Node label | `workload=batch` | `workload=microservices` | `workload=microservices` | `arch=arm64` |
| Taint | `workload=batch:NoSchedule` | `workload=microservices:NoSchedule` | Như `ms-od` | `arch=arm64:NoSchedule` |
| Giới hạn CPU | 48 | **24** | **72** | 48 |
| Weight | 50 | **100** | **10** | 50 |

Các NodePool cho phép instance family `m`, `c`, `r` từ thế hệ 6, loại trừ size `nano`, `micro`, `small`. Consolidation xử lý node trống hoặc ít sử dụng; `expireAfter: 720h` đặt thời hạn node 30 ngày.

**Mixed Pool gồm 2 NodePool:** `ms-od` và `ms-spot` dùng chung label, taint cho Microservices. `ms-od` có weight cao hơn và CPU limit **24 vCPU**; `ms-spot` có limit **72 vCPU**. Cấu hình tạo capacity budget **1:3** khi dùng hết limit, không ép tỷ lệ node tại mọi thời điểm. [Bước 2.3](on-demand-spot-ratio-and-limits) hướng dẫn đo.

**Selector và Toleration:** cấu hình cả Node Selector và Toleration tương ứng để workload được schedule vào đúng nhóm. Toleration chỉ cho phép Pod vào node có taint; selector mới giới hạn nhóm node được chọn.

## 1. Kiểm tra node role và AMI {#1-check-the-node-role-and-ami}

```bash
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name; echo
grep -E 'role:|alias:' "$GITOPS_DIR/platform/nodepools/ec2nodeclass.yaml"
```

`role` trong `ec2nodeclass.yaml` phải bằng output Terraform (`Karpenter-eks-workload`).

## 2. Apply EC2NodeClass và NodePool {#2-apply-the-ec2nodeclass-and-nodepools}

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/nodepools/ec2nodeclass.yaml"
kubectl --context eks-workload wait ec2nodeclass/default --for=condition=Ready --timeout=5m

for f in nodepool-1-spot nodepool-2-ondemand nodepool-2-spot nodepool-3-arm64; do
  kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/nodepools/$f.yaml"
done
kubectl --context eks-workload get ec2nodeclass,nodepools
```

**Kết quả cần có:** `default` có `Ready=True`; tồn tại bốn NodePool. Chưa có node mới; pool chỉ tạo node khi có Pod cần.

Nếu EC2NodeClass chưa Ready, chạy `kubectl --context eks-workload describe ec2nodeclass default`. Nguyên nhân thường gặp là AMI alias không tồn tại trong region hoặc subnet/security group thiếu discovery tag.

## 3. Chạy Workload trên Spot Pool {#3-test-pool-1-with-a-spot-workload}

`examples/workshop/spot-proof.yaml` là Deployment nhỏ chọn `workload=batch`, tolerate taint tương ứng và yêu cầu `amd64`.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w          # Ctrl+C once a NodeClaim is Ready
kubectl --context eks-workload rollout status deployment/workshop-spot --timeout=10m
```

## Kiểm tra kết quả {#verify}

```bash
kubectl --context eks-workload get pods -l app=workshop-spot -o wide
kubectl --context eks-workload get nodes -l karpenter.sh/nodepool=batch-spot \
  -L karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch,node.kubernetes.io/instance-type \
  | tee "$EVIDENCE_DIR/pool1-spot.txt"
```

**Kết quả cần có:** Pod `Running` trên node có `nodepool=batch-spot`, `capacity-type=spot`, `arch=amd64`.

Xóa workload thử, rồi theo dõi Karpenter dọn node trống theo `consolidateAfter` khoảng 30 giây:

```bash
kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w
```

| Triệu chứng | Kiểm tra |
|---|---|
| Pod `Pending`, không có NodeClaim | `kubectl describe pod` — selector/toleration không khớp; log Karpenter: `kubectl -n kube-system logs deploy/karpenter` |
| Có NodeClaim nhưng node không join | Node IAM role và EKS access entry; route subnet |
| `InsufficientInstanceCapacity` với Spot | Capacity Spot trong AZ; mở rộng họ instance, không đổi pool sang On-Demand |

Pool 2 được thử khi triển khai ShopNow ([bước 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide)) và đo tại [bước 2.3](on-demand-spot-ratio-and-limits). Pool 3 được thử tại [bước 2.4](arm64-validation).

**Tiếp theo:** [2.3 Mixed pool 1:3](on-demand-spot-ratio-and-limits)

---
title: "Bước 2.2 — Tạo ba nhóm node Karpenter"
sidebar_label: "2.2 Ba nhóm node"
---

# Bước 2.2 — Tạo ba nhóm node Karpenter {#step-22--create-the-three-karpenter-node-pools}

:::info Tóm tắt bước thực hành
**Mục tiêu:** pool 1 (Spot), pool 2 (mixed On-Demand/Spot), pool 3 (ARM64) và bài thử Spot chứng minh pool 1 hoạt động.
**Yêu cầu:** 2. **Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Cách Karpenter hoạt động trong workshop {#how-karpenter-works-here}

Karpenter theo dõi Pod không thể được schedule. Nó chọn **NodePool** có quy tắc khớp Pod (label, taint, architecture, capacity type), khởi chạy EC2 phù hợp rẻ nhất và xóa node khi trống hoặc ít được sử dụng. Bạn tạo Pod cần node; không tạo node thủ công.

| Đối tượng | Tệp | Nội dung khai báo |
|---|---|---|
| `EC2NodeClass default` | `platform/nodepools/ec2nodeclass.yaml` | Node IAM role, subnet và security group tìm theo tag `karpenter.sh/discovery=eks-workload`, AMI `al2023`, IMDSv2, root disk gp3 mã hóa 30 GiB |
| `NodePool batch-spot` | `nodepool-1-spot.yaml` | **Pool 1** |
| `NodePool ms-od` + `NodePool ms-spot` | `nodepool-2-ondemand.yaml`, `nodepool-2-spot.yaml` | **Pool 2** |
| `NodePool arm64` | `nodepool-3-arm64.yaml` | **Pool 3** |

## Ba nhóm pool {#the-three-pools}

| | Pool 1 `batch-spot` | Pool 2 `ms-od` | Pool 2 `ms-spot` | Pool 3 `arm64` |
|---|---|---|---|---|
| Capacity type | Spot | On-Demand | Spot | On-Demand hoặc Spot |
| Architecture | amd64, arm64 | amd64 | amd64 | arm64 |
| Node label | `workload=batch` | `workload=microservices` | `workload=microservices` | `arch=arm64` |
| Taint | `workload=batch:NoSchedule` | `workload=microservices:NoSchedule` | Như `ms-od` | `arch=arm64:NoSchedule` |
| Giới hạn CPU | 48 | **24** | **72** | 48 |
| Weight | 50 | **100** | **10** | 50 |

Mọi pool dùng họ `m`, `c`, `r`, thế hệ 6 trở lên, loại trừ kích thước `nano`, `micro`, `small`. Mỗi pool hợp nhất node trống hoặc ít sử dụng và thay node sau 30 ngày (`expireAfter: 720h`).

**Vì sao pool 2 có hai NodePool:** Karpenter không có tỷ lệ On-Demand/Spot bên trong một pool. `ms-od` và `ms-spot` dùng chung label và taint nên Pod microservice phù hợp cả hai. Karpenter ưu tiên `ms-od` có weight cao; khi đạt **24 vCPU**, capacity mới lấy từ `ms-spot`, tối đa **72 vCPU**. 24 : 72 = **1 : 3**. [Bước 2.3](on-demand-spot-ratio-and-limits) hướng dẫn đo.

**Taint giữ workload đúng pool:** Pod chỉ vào pool khi vừa **chọn** label vừa **tolerate** taint. Workload không vô tình chạy trên node Spot hoặc ARM64.

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

**Kết quả mong đợi:** `default` có `Ready=True`; tồn tại bốn NodePool. Chưa có node mới; pool chỉ tạo node khi có Pod cần.

Nếu EC2NodeClass chưa Ready, chạy `kubectl --context eks-workload describe ec2nodeclass default`. Nguyên nhân thường gặp là AMI alias không tồn tại trong region hoặc subnet/security group thiếu discovery tag.

## 3. Kiểm thử pool 1 bằng workload Spot {#3-test-pool-1-with-a-spot-workload}

`examples/workshop/spot-proof.yaml` là Deployment nhỏ chọn `workload=batch`, tolerate taint tương ứng và yêu cầu `amd64`.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w          # Ctrl+C once a NodeClaim is Ready
kubectl --context eks-workload rollout status deployment/workshop-spot --timeout=10m
```

## Kiểm chứng {#verify}

```bash
kubectl --context eks-workload get pods -l app=workshop-spot -o wide
kubectl --context eks-workload get nodes -l karpenter.sh/nodepool=batch-spot \
  -L karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch,node.kubernetes.io/instance-type \
  | tee "$EVIDENCE_DIR/pool1-spot.txt"
```

**Kết quả mong đợi:** Pod `Running` trên node có `nodepool=batch-spot`, `capacity-type=spot`, `arch=amd64`.

Xóa bài thử; Karpenter xóa node trống sau khoảng 30 giây:

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

---
title: "Bước 2.2 — Cấu hình Karpenter NodePools"
sidebar_label: "2.2 Karpenter NodePools"
---

# Bước 2.2 — Cấu hình Karpenter NodePools {#step-22--create-the-three-karpenter-node-pools}

Trong phần này, chúng ta sẽ cấu hình EC2NodeClass và các NodePool cho ba nhóm workload: Spot, mixed On-Demand/Spot và ARM64. Sau đó, chạy một workload nhỏ để xem Karpenter tạo node Spot.

**Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR`.

## Karpenter và các loại node {#karpenter-basics}

### Từ Pod Pending đến EC2 node

Scheduler chọn node cho Pod dựa trên tài nguyên còn trống và các điều kiện trong Pod spec. Nếu không có node phù hợp, Pod có thể ở trạng thái Pending. Karpenter dùng các yêu cầu đó để tìm cấu hình EC2 có thể bổ sung capacity.

Karpenter tạo node để chạy workload đã được yêu cầu; nó không tự tăng replica của ứng dụng theo CPU. Việc tăng replica thuộc HPA hoặc các cơ chế autoscaling khác. Một service có thể tăng replica mà chưa cần thêm node nếu các worker hiện tại còn đủ tài nguyên.

### EC2NodeClass, NodePool và NodeClaim

| Resource | Khai báo hoặc thể hiện điều gì? |
|---|---|
| EC2NodeClass | Cấu hình AWS để tạo node: AMI, IAM role, subnet, security group và ổ đĩa |
| NodePool | Các điều kiện cho nhóm node: architecture, capacity type, label, taint và limit |
| NodeClaim | Yêu cầu một node cụ thể do Karpenter quản lý trong quá trình cấp và thu hồi capacity |

Bạn sẽ khai báo EC2NodeClass và NodePool. Controller tạo NodeClaim khi cần node. Các object NodePool có thể đã tồn tại nhưng chưa có EC2 nào nếu không có Pod cần capacity.

### Spot, On-Demand và ARM64

On-Demand phù hợp với phần capacity cần duy trì mà không phụ thuộc cơ chế thu hồi Spot. Spot sử dụng capacity sẵn có của EC2 và có thể bị AWS thu hồi, vì vậy ứng dụng cần xử lý việc thay Pod hoặc node. ARM64 là kiến trúc CPU, không phải một loại hình mua instance: node ARM64 vẫn có thể dùng On-Demand hoặc Spot.

workshop có ba nhóm workload nhưng dùng bốn NodePool. Spot dùng `batch-spot`; mixed pool dùng `ms-od` và `ms-spot`; ARM64 dùng `arm64`. Hai NodePool của mixed pool có cùng label và taint để nhận microservices.

### Tỷ lệ 1:3 được hiểu như thế nào?

Repo đặt CPU limit 24 vCPU cho `ms-od` và 72 vCPU cho `ms-spot`, với weight ưu tiên On-Demand. Đây là tỷ lệ giữa các limit. Nó không giữ số node hoặc Pod luôn ở tỷ lệ 1:3. Kết quả thực tế còn phụ thuộc workload, instance size và capacity có sẵn.

Ở bài lab sau, chúng ta tạm giảm limit và cố định instance size để dễ quan sát 1 node On-Demand cùng 3 node Spot. Các bước dưới đây bắt đầu bằng việc tạo NodePool và thử Spot pool.

Đọc thêm: [Karpenter NodePools](https://karpenter.sh/docs/concepts/nodepools/).

## Karpenter trong workshop {#how-karpenter-works-here}

Khi Pod không tìm được node phù hợp, Karpenter có thể tạo thêm EC2 dựa trên yêu cầu của Pod và NodePool. Các điều kiện gồm label, taint, architecture và capacity type. Sau khi workload giảm, controller xem xét consolidation theo policy đã khai báo.

| Đối tượng | File | Nội dung khai báo |
|---|---|---|
| `EC2NodeClass default` | `platform/nodepools/ec2nodeclass.yaml` | Node IAM role, subnet và security group tìm theo tag `karpenter.sh/discovery=eks-workload`, AMI `al2023`, IMDSv2, root disk gp3 mã hóa 30 GiB |
| `NodePool batch-spot` | `nodepool-1-spot.yaml` | **Pool 1** |
| `NodePool ms-od` + `NodePool ms-spot` | `nodepool-2-ondemand.yaml`, `nodepool-2-spot.yaml` | **Pool 2** |
| `NodePool arm64` | `nodepool-3-arm64.yaml` | **Pool 3** |

## Ba nhóm NodePool {#the-three-pools}

| | Pool 1 `batch-spot` | Pool 2 `ms-od` | Pool 2 `ms-spot` | Pool 3 `arm64` |
|---|---|---|---|---|
| capacity type | Spot | On-Demand | Spot | On-Demand hoặc Spot |
| architecture | amd64, arm64 | amd64 | amd64 | arm64 |
| Node label | `workload=batch` | `workload=microservices` | `workload=microservices` | `arch=arm64` |
| Taint | `workload=batch:NoSchedule` | `workload=microservices:NoSchedule` | Như `ms-od` | `arch=arm64:NoSchedule` |
| Giới hạn CPU | 48 | **24** | **72** | 48 |
| Weight | 50 | **100** | **10** | 50 |

Các NodePool cho phép instance family `m`, `c`, `r` từ thế hệ 6, loại trừ size `nano`, `micro`, `small`. Consolidation xử lý node trống hoặc ít sử dụng; `expireAfter: 720h` đặt thời hạn node 30 ngày.

Mixed pool gồm `ms-od` và `ms-spot`, cùng nhận Pod có label `workload=microservices` và toleration tương ứng. `ms-od` có weight cao hơn và CPU limit 24 vCPU; `ms-spot` có limit 72 vCPU. Tỷ lệ limit là 1:3, còn số node thực tế phụ thuộc instance size và nhu cầu workload. [Bước 2.3](on-demand-spot-ratio-and-limits) hướng dẫn kiểm tra tỷ lệ này.

Node selector chọn nhóm node được phép chạy workload. Toleration cho phép Pod chạy trên node có taint tương ứng. Chúng ta cần cấu hình cả hai: toleration riêng lẻ không bắt Pod phải chạy ở một pool cụ thể.

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

**Kết quả:** `default` có `Ready=True`; tồn tại bốn NodePool. Chưa có node mới; pool chỉ tạo node khi có Pod cần.

Nếu EC2NodeClass chưa Ready, chạy `kubectl --context eks-workload describe ec2nodeclass default`. Nguyên nhân thường gặp là AMI alias không tồn tại trong region hoặc subnet/security group thiếu discovery tag.

## 3. Chạy workload trên Spot pool {#3-test-pool-1-with-a-spot-workload}

`examples/workshop/spot-proof.yaml` là Deployment nhỏ chọn `workload=batch`, tolerate taint tương ứng và yêu cầu `amd64`.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w          # Ctrl+C once a NodeClaim is Ready
kubectl --context eks-workload rollout status deployment/workshop-spot --timeout=10m
```

## Kiểm tra {#verify}

```bash
kubectl --context eks-workload get pods -l app=workshop-spot -o wide
kubectl --context eks-workload get nodes -l karpenter.sh/nodepool=batch-spot \
  -L karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch,node.kubernetes.io/instance-type \
  | tee "$EVIDENCE_DIR/pool1-spot.txt"
```

**Kết quả:** Pod `Running` trên node có `nodepool=batch-spot`, `capacity-type=spot`, `arch=amd64`.

Xóa workload thử, rồi theo dõi Karpenter dọn node trống theo `consolidateAfter` khoảng 30 giây:

```bash
kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w
```

| Triệu chứng | Kiểm tra |
|---|---|
| Pod `Pending`, không có NodeClaim | `kubectl describe pod` — selector/toleration không khớp; log Karpenter: `kubectl -n kube-system logs deploy/karpenter` |
| Có NodeClaim nhưng node không join | Node IAM role và EKS access entry; route subnet |
| `InsufficientInstanceCapacity` với Spot | capacity Spot trong AZ; mở rộng họ instance, không đổi pool sang On-Demand |

Pool 2 được thử khi triển khai ShopNow ([bước 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide)) và đo tại [bước 2.3](on-demand-spot-ratio-and-limits). Pool 3 được thử tại [bước 2.4](arm64-validation).

**Tiếp theo:** [2.3 mixed pool 1:3](on-demand-spot-ratio-and-limits)

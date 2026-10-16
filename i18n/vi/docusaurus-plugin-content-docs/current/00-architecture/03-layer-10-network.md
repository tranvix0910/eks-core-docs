---
title: "Bước 1.1 — Tạo network"
sidebar_label: "1.1 Network"
---

# Bước 1.1 — Tạo network {#step-11--create-the-network}

:::info Tóm tắt bước thực hành
**Mục tiêu:** một VPC với các subnet riêng cho từng cluster.
**Thời gian:** khoảng 5 phút. **Chạy từ:** `$TF_DIR/10-network`.
:::

## Tài nguyên lớp này tạo ra {#what-this-layer-creates}

| Tài nguyên | Giá trị từ `terraform.tfvars` |
|---|---|
| VPC | `10.20.0.0/16` tại `ap-northeast-1a`, `1c`, `1d` |
| Public subnet | 3 × `/24` — load balancer, NAT |
| Workload subnet | 3 × `/20` — node và Pod của cluster 1 |
| Observability subnet | 3 × `/20` — node và Pod của cluster 2 |
| NAT gateway | Một gateway (`single_nat_gateway = true`) để giảm chi phí lab |
| S3 gateway endpoint | Lưu lượng S3 của state, Mimir và Loki đi trong VPC |
| VPC Flow Logs | Được bật |
| Discovery tags | `karpenter.sh/discovery=eks-workload` trên workload subnet, ELB role tag trên public/private subnet |

Subnet `/20` có kích thước lớn có chủ đích: khi dùng VPC CNI, mỗi Pod lấy một địa chỉ IP của VPC.

## 1. Kiểm tra đầu vào {#1-review-the-inputs}

```bash
cat "$TF_DIR/10-network/terraform.tfvars"
```

Chỉ thay `region`, `azs` và CIDR nếu triển khai ở nơi khác. Giữ ba nhóm subnet không chồng lấn.

## 2. Lập plan {#2-plan}

```bash
L=10-network
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
```

Đọc phần tổng kết plan. Với tài khoản chưa có hạ tầng, chỉ nên có hành động `create`, không có `destroy`.

## 3. Apply {#3-apply}

```bash
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" output
```

## Kiểm chứng {#verify}

```bash
export VPC_ID=$(terraform -chdir="$TF_DIR/10-network" output -raw vpc_id)

aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[].{AZ:AvailabilityZone,CIDR:CidrBlock,Karpenter:Tags[?Key==`karpenter.sh/discovery`]|[0].Value}' \
  --output table
```

**Kết quả mong đợi:**

- 9 subnet: ba `/24`, ba `10.20.16–48.0/20` gắn tag `eks-workload`, ba `10.20.64–96.0/20` gắn tag `eks-observability`.
- `terraform output` có `vpc_id`, `workload_node_subnet_ids` và `observability_node_subnet_ids`; hai lớp tiếp theo đọc các output này.

## Quản lý lớp này về sau {#managing-this-layer-later}

Sửa `terraform.tfvars` → plan → kiểm tra → apply. Không đổi tên output vì lớp 20 và 21 đang đọc chúng. Thay đổi **thay thế** subnet cũng thay thế node group và EFS mount target bên trong; hãy lập kế hoạch riêng cho thay đổi đó.

**Tiếp theo:** [1.2 Cluster 1 — Workload](04-layer-20-cluster-workload.md)

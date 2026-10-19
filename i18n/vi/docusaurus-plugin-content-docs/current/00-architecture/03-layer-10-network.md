---
title: "Bước 1.1 — Setup Network"
sidebar_label: "1.1 Network"
---

# Bước 1.1 — Setup Network {#step-11--create-the-network}

:::info Nội dung thực hiện
**Mục tiêu:** tạo VPC, Subnet và Network Layer cho 2 EKS Cluster.
**Thời gian:** khoảng 5 phút. **Chạy từ:** `$TF_DIR/10-network`.
:::

## Resource của Layer {#what-this-layer-creates}

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

Workload và Observability dùng Subnet `/20` để đủ IP cho node và Pod. VPC CNI cấp cho mỗi Pod một IP trong VPC.

## 1. Kiểm tra Terraform Variables {#1-review-the-inputs}

```bash
cat "$TF_DIR/10-network/terraform.tfvars"
```

Kiểm tra `region`, `azs` và CIDR trước khi Plan. Nếu dùng cấu hình khác, cập nhật tại đây và bảo đảm các Subnet không chồng lấn.

[![Terraform Variables của Network Layer: VPC CIDR, AZ, Public Subnet, Workload Subnet và Observability Subnet](/img/workshop/terraform/network-variables.png)](/img/workshop/terraform/network-variables.png)

*Kiểm tra VPC CIDR, AZ và 3 nhóm Subnet trước khi Plan. Profile và tag trong ảnh là giá trị của lần capture; dùng cấu hình AWS Account của bạn. Bấm vào ảnh để xem đầy đủ.*

## 2. Terraform Init và Plan {#2-plan}

```bash
L=10-network
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
```

Kiểm tra phần tổng kết plan. Lần tạo mới chỉ có resource cần thêm (`create`); nếu có `destroy` hoặc `replace`, kiểm tra lại state và cấu hình trước khi Apply.

[![Terraform Init Network Layer kết nối S3 Backend và cài Provider thành công](/img/workshop/terraform/network-init.png)](/img/workshop/terraform/network-init.png)

*Terraform Init kết nối S3 Backend và cài Provider thành công. Tên bucket trong ảnh thuộc môi trường đã triển khai. Bấm vào ảnh để xem đầy đủ.*

[![Terraform Network Plan hiển thị resource cần thêm, thay đổi, xóa và các output](/img/workshop/terraform/network-plan-review.png)](/img/workshop/terraform/network-plan-review.png)

*Ảnh plan từ một lần chạy trên state có sẵn, có cả `change` và `destroy`, đồng thời chưa lưu bằng `-out`. Đây là ví dụ để đọc plan, không phải kết quả cần có khi tạo mới. Thực hiện theo lệnh phía trên: lưu plan và kiểm tra từng thay đổi trước khi Apply. Bấm vào ảnh để xem đầy đủ.*

## 3. Apply {#3-apply}

```bash
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" output
```

[![Terraform Apply Network thành công và trả VPC ID, Subnet ID, NAT Gateway ID, S3 Endpoint ID](/img/workshop/terraform/network-apply-outputs.png)](/img/workshop/terraform/network-apply-outputs.png)

*Network Apply hoàn tất và có output cho 2 EKS Layer. Resource ID và số lượng thay đổi phụ thuộc state của từng lần chạy. Bấm vào ảnh để xem đầy đủ.*

## Kiểm tra kết quả {#verify}

```bash
export VPC_ID=$(terraform -chdir="$TF_DIR/10-network" output -raw vpc_id)

aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[].{AZ:AvailabilityZone,CIDR:CidrBlock,Karpenter:Tags[?Key==`karpenter.sh/discovery`]|[0].Value}' \
  --output table
```

**Kết quả cần có:**

- 9 subnet: ba `/24`, ba `10.20.16–48.0/20` gắn tag `eks-workload`, ba `10.20.64–96.0/20` gắn tag `eks-observability`.
- `terraform output` có `vpc_id`, `workload_node_subnet_ids` và `observability_node_subnet_ids`; hai Layer tiếp theo đọc các output này.

## Quản lý Network Layer {#managing-this-layer-later}

Để cập nhật Network, sửa `terraform.tfvars`, Plan rồi Apply file plan đã kiểm tra. Giữ tên output mà Layer 20 và 21 đang sử dụng. Nếu plan thay thế Subnet, kiểm tra ảnh hưởng tới Node Group và EFS Mount Target trước khi thực hiện.

**Tiếp theo:** [1.2 Cluster 1 — Workload](04-layer-20-cluster-workload.md)

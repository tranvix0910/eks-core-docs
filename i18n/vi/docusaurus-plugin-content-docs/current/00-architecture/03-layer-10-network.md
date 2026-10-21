---
title: "Bước 1.1 — Tạo network"
sidebar_label: "1.1 Network"
---

# Bước 1.1 — Tạo network {#step-11--create-the-network}

Chúng ta sẽ tạo VPC và các subnet dùng cho hai EKS cluster. Network được triển khai trước vì cả workload cluster và observability cluster đều sử dụng output của layer này.

**Thời gian:** khoảng 5 phút. **Chạy từ:** `$TF_DIR/10-network`.

## VPC, subnet và Ingress {#network-basics}

### VPC và subnet

VPC là mạng riêng của các resource AWS trong dự án. Chúng ta chọn một CIDR cho VPC rồi chia thành các subnet. Mỗi subnet thuộc một Availability Zone, vì vậy muốn trải node qua nhiều AZ thì cần subnet ở từng AZ.

Public subnet có route tới Internet Gateway. Private subnet không có route trực tiếp đó; trong workshop, node dùng NAT Gateway khi cần kết nối ra Internet. Việc nằm trong public subnet cũng không tự mở một resource ra Internet: còn phụ thuộc IP, security group và route.

VPC của workshop có ba nhóm subnet. Public subnet dành cho internet-facing ALB và NAT Gateway. Workload subnet dành cho cluster 1, còn observability subnet dành cho cluster 2. Với VPC CNI, các Pod cũng cần IP trong VPC, nên phải tính cả lượng Pod khi chọn kích thước subnet.

### Request đi vào ứng dụng qua đâu?

Kubernetes Service giúp các Pod trong cluster truy cập nhau. Để nhận HTTP/HTTPS từ bên ngoài, chúng ta có thể khai báo Ingress: hostname hoặc path nào sẽ chuyển tới Service nào.

Ingress chỉ mô tả routing. AWS Load Balancer Controller đọc cấu hình này và tạo ALB, listener, target group trên AWS. Với `target-type: ip`, ALB gửi request tới IP của Pod. Vì vậy khi truy cập lỗi, cần kiểm tra cả Ingress, endpoint của Service và target health trên ALB.

Domain riêng giúp truy cập bằng tên dễ nhớ và cấu hình TLS theo domain đó. Trong bài Kite, bạn cũng có thể dùng trực tiếp hostname ALB trên port 8088. Đây là cách truy cập HTTP trong lab; CIDR rule chỉ giới hạn mạng được phép, không mã hóa kết nối.

### Network giữa hai cluster

Hai cluster dùng chung VPC nên có thể kết nối bằng địa chỉ riêng khi route và security group cho phép. Mimir và Loki được đặt sau internal ALB, với hostname trong private hosted zone `observability.internal`.

NAT Gateway phục vụ đường kết nối ra ngoài, không phải đường bắt buộc để metrics và logs đi từ cluster 1 sang cluster 2 trong cùng VPC. workshop dùng một NAT Gateway để giảm số resource; đây là lựa chọn cho lab, không cung cấp dự phòng NAT theo AZ.

Đọc thêm: [VPC và subnet](https://docs.aws.amazon.com/vpc/latest/userguide/how-it-works.html).

## Resource được tạo {#what-this-layer-creates}

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

VPC CNI cấp IP trong VPC cho Pod. Vì vậy, các private subnet dùng `/20` để có chỗ cho cả node lẫn Pod khi workload tăng lên.

## 1. Kiểm tra biến Terraform {#1-review-the-inputs}

```bash
cat "$TF_DIR/10-network/terraform.tfvars"
```

Kiểm tra `region`, `azs` và CIDR trước khi plan. Nếu dùng cấu hình khác, cập nhật tại đây và bảo đảm các subnet không chồng lấn.

[![biến Terraform của network layer: VPC CIDR, AZ, public subnet, Workload subnet và Observability subnet](/img/workshop/terraform/network-variables.png)](/img/workshop/terraform/network-variables.png)

*Kiểm tra VPC CIDR, AZ và 3 nhóm subnet trước khi plan. Profile và tag trong ảnh là giá trị của lần capture; dùng cấu hình tài khoản AWS của bạn. Bấm vào ảnh để xem đầy đủ.*

## 2. Terraform Init và plan {#2-plan}

```bash
L=10-network
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
```

Sau khi chạy, đọc phần tổng kết plan. Với môi trường mới, các resource cần được tạo thêm. Nếu có `destroy` hoặc `replace`, kiểm tra lại backend, state và cấu hình trước khi apply.

[![Terraform Init network layer kết nối S3 backend và cài Provider thành công](/img/workshop/terraform/network-init.png)](/img/workshop/terraform/network-init.png)

*Terraform Init kết nối S3 backend và cài Provider thành công. Tên bucket trong ảnh thuộc môi trường đã triển khai. Bấm vào ảnh để xem đầy đủ.*

[![Terraform Network plan hiển thị resource cần thêm, thay đổi, xóa và các output](/img/workshop/terraform/network-plan-review.png)](/img/workshop/terraform/network-plan-review.png)

*Ảnh plan từ một lần chạy trên state có sẵn, có cả `change` và `destroy`, đồng thời chưa lưu bằng `-out`. Đây là ví dụ để đọc plan, không phải kết quả cần có khi tạo mới. Thực hiện theo lệnh phía trên: lưu plan và kiểm tra từng thay đổi trước khi apply. Bấm vào ảnh để xem đầy đủ.*

## 3. Apply {#3-apply}

```bash
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" output
```

[![Terraform apply Network thành công và trả VPC ID, subnet ID, NAT Gateway ID, S3 endpoint ID](/img/workshop/terraform/network-apply-outputs.png)](/img/workshop/terraform/network-apply-outputs.png)

*Network apply hoàn tất và có output cho 2 EKS layer. Resource ID và số lượng thay đổi phụ thuộc state của từng lần chạy. Bấm vào ảnh để xem đầy đủ.*

## Kiểm tra {#verify}

```bash
export VPC_ID=$(terraform -chdir="$TF_DIR/10-network" output -raw vpc_id)

aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[].{AZ:AvailabilityZone,CIDR:CidrBlock,Karpenter:Tags[?Key==`karpenter.sh/discovery`]|[0].Value}' \
  --output table
```

**Kết quả:**

- 9 subnet: ba `/24`, ba `10.20.16–48.0/20` gắn tag `eks-workload`, ba `10.20.64–96.0/20` gắn tag `eks-observability`.
- `terraform output` có `vpc_id`, `workload_node_subnet_ids` và `observability_node_subnet_ids`; hai layer tiếp theo đọc các output này.

## Quản lý network layer {#managing-this-layer-later}

Khi cần sửa network, cập nhật `terraform.tfvars`, chạy plan và kiểm tra trước khi apply. Layer 20 và 21 đang đọc các output của layer này nên cần giữ nguyên tên output. Nếu thay subnet, kiểm tra cả Node Group và EFS mount target đang sử dụng subnet đó.

**Tiếp theo:** [1.2 Cluster 1 — Workload](04-layer-20-cluster-workload.md)

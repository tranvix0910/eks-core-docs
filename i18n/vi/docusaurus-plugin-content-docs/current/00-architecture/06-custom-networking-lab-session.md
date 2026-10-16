---
title: "Mở rộng: bài lab VPC CNI Custom Networking"
---

# Thực hiện sau khi hoàn tất workshop cốt lõi {#run-this-lab-after-completing-the-core-workshop}

Custom Networking tách địa chỉ Pod khỏi subnet node. Đây không phải yêu cầu cho hai cluster, EFS, ArgoCD hoặc observability tập trung. Giữ cấu hình Prefix Delegation hiện tại cho workshop cốt lõi; chỉ thêm secondary CIDR khi cần kiểm thử yêu cầu network.

## 1. Mục tiêu và phạm vi {#1-objective-and-scope}

Dùng workload cluster hiện tại, tạo Pod subnet từ secondary VPC CIDR, chọn ENIConfig theo Availability Zone, thêm canary node và xác nhận IP Pod thuộc Pod subnet trong khi IP node vẫn thuộc node subnet. Giữ nguyên cấu hình observability cluster.

Thay đổi ảnh hưởng VPC dùng chung và cấu hình CNI toàn cluster. Dùng cửa sổ lab riêng, tách khỏi bài PDB/availability. Trước khi thực hiện, kiểm tra CIDR chồng lấn với on-premises, peering hoặc Transit Gateway; xác nhận quota subnet/ENI và chỉ định người rollback.

## 2. Kiểm kê và lưu cấu hình thực tế {#2-inventory-and-save-the-actual-configuration}

```bash
aws eks describe-addon --cluster-name eks-workload --addon-name vpc-cni \
  --output json > .workshop/vpc-cni-before.json
jq -r '.addon.configurationValues // "{}"' .workshop/vpc-cni-before.json \
  > .workshop/vpc-cni-config-before.json
kubectl --context eks-workload get nodes -o json > .workshop/nodes-before-custom-network.json
terraform -chdir="$TF_DIR/10-network" output -json
```

Tệp `labs/custom-networking/vpc-cni-configuration-before-custom-networking.json` trong checkout có thể trống. Chỉ dùng để rollback khi đã chứa cấu hình lưu cho phiên lab này.

## 3. Chuẩn bị network bằng thay đổi riêng {#3-prepare-the-network-as-a-separate-change}

Lập plan cho secondary CIDR, ba private Pod subnet cùng AZ với node subnet, route egress phù hợp và security group cho Pod ENI. Dùng subnet ID từ output thực tế. Thay ID riêng của môi trường trong `labs/custom-networking/eni-configs.yaml`.

Mỗi ENIConfig phải khớp AZ của node sử dụng nó; secondary ENI không gắn xuyên zone. NetworkPolicy, security group rule, DNS và routing phải hỗ trợ mạng Pod mới. CIDR CGNAT không tự giải quyết chồng lấn mạng doanh nghiệp.

## 4. Tạo ENIConfig và cập nhật CNI {#4-create-eniconfig-and-update-the-cni}

Sao chép ENIConfig mẫu vào `.workshop`, thay mọi subnet/SG ID bằng tài nguyên đã tạo, đặt metadata.name theo AZ tương ứng. Apply ENIConfig trước khi bật lựa chọn theo zone.

Giữ configurationValues hiện có của add-on và thêm cấu hình:

```json
{
  "env": {
    "ENABLE_PREFIX_DELEGATION": "true",
    "WARM_PREFIX_TARGET": "1",
    "AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG": "true",
    "ENI_CONFIG_LABEL_DEF": "topology.kubernetes.io/zone"
  }
}
```

**Merge các key này vào cấu hình đã lưu.** Không thay toàn bộ configurationValues nếu môi trường có cấu hình khác. Cập nhật qua EKS managed add-on API hoặc IaC quản lý nó. Sửa trực tiếp DaemonSet có thể bị add-on reconcile ghi đè. Chờ add-on và aws-node Ready.

## 5. Canary và kiểm chứng {#5-canary-and-verification}

Tăng capacity node group có kiểm soát và xác định node mới. Dùng workload cluster hiện tại. Label và taint canary bằng `lab.eks-core/custom-network=true` và `custom-network-lab=true:NoSchedule` theo manifest mẫu. Gắn taint sau khi node Ready tạo khoảng trống scheduling; ghi giới hạn đó hoặc cấu hình isolation ngay lúc bootstrap node.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR"/labs/custom-networking/custom-network-test.yaml
kubectl --context eks-workload -n custom-network-lab get pods -o wide
kubectl --context eks-workload -n kube-system logs -l k8s-app=aws-node -c aws-node --tail=50
```

Bài đạt khi canary Pod nhận IP từ secondary Pod subnet, node giữ IP primary subnet, DNS, egress và kết nối service cần thiết hoạt động. Chỉ cấp được IP chưa đủ bằng chứng.

## 6. Rollback theo thứ tự {#6-ordered-rollback}

Xóa workload thử, khôi phục chính xác configurationValues đã lưu và chờ CNI healthy. Đưa canary về trạng thái được duyệt, xử lý node theo quy trình bảo trì. Kiểm tra không còn Pod/ENI dùng secondary subnet trước khi xóa ENIConfig, security group, subnet hoặc CIDR. Không force-delete ENI hay sửa tài nguyên cluster 2.

Tham khảo: [AWS VPC CNI Custom Networking](https://docs.aws.amazon.com/eks/latest/userguide/cni-custom-network.html). Báo cáo riêng thay đổi VPC/CNI này với bài mixed pool.

---
title: "Bước 1.2 — Tạo cluster 1 (workload)"
sidebar_label: "1.2 Cluster 1 · Workload"
---

# Bước 1.2 — Tạo cluster 1 (workload) {#step-12--create-cluster-1-workload}

:::info Tóm tắt bước thực hành
**Mục tiêu:** EKS cluster `eks-workload` có Managed Node Group `infra`, tài nguyên AWS cho Karpenter, EFS và ECR.
**Yêu cầu:** 1 (Managed Node Group), 4 (EFS). **Thời gian:** khoảng 20 phút. **Chạy từ:** `$TF_DIR/20-cluster-workload`.
:::

## Tài nguyên lớp này tạo ra {#what-this-layer-creates}

| Tài nguyên | Chi tiết |
|---|---|
| EKS `eks-workload` | Kubernetes 1.34, public endpoint, control-plane log gửi CloudWatch và lưu 7 ngày |
| Managed Node Group `infra` | 3 × `t3.large` On-Demand, AL2023, label `role=infra` — chạy công cụ nền tảng |
| EKS add-on | VPC CNI, CoreDNS, kube-proxy, EBS CSI, EFS CSI, Pod Identity Agent |
| Phần AWS của Karpenter | Node IAM role, controller IAM (Pod Identity), SQS interruption queue, EventBridge rule |
| EFS | File system có mount target trong từng workload subnet; cho phép NFS (2049) từ node |
| ECR | Bảy repository `shopnow/*` lưu image ShopNow |
| Pod Identity association | EBS CSI, EFS CSI, Load Balancer Controller, Karpenter |

Lớp này còn cài Helm release cho LBC, Karpenter, ArgoCD, Prometheus, Metrics Server và StorageClass `gp3`, `efs-sc`. Chúng cần cluster đã chạy, nên được apply sau tại [bước 1.3](05-layer-21-cluster-observability.md#6-finish-cluster-1).

## 1. Kiểm tra đầu vào {#1-review-the-inputs}

```bash
grep -E 'kubernetes_version|nodegroup_|efs_create|ecr_repository' -A0 "$TF_DIR/20-cluster-workload/terraform.tfvars"
```

Giá trị mặc định đã khớp workshop: `efs_create = true` và bảy ECR repository. Giữ `eks_nodegroup_min_size` từ 2 trở lên để công cụ nền tảng còn hoạt động khi mất một infra node.

## 2. Apply hạ tầng nền (chỉ lần đầu) {#2-apply-the-foundation-first-time-only}

Với tài khoản chưa có hạ tầng, cluster 2 chưa tồn tại và Helm release chưa thể truy cập cluster đang được tạo. Lúc này chỉ apply phần hạ tầng AWS:

```bash
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan \
  -target=module.eks \
  -target=module.karpenter \
  -target=module.ebs_csi_pod_identity \
  -target=module.efs_csi_pod_identity \
  -target=module.lb_controller_pod_identity \
  -target=module.efs \
  -target=module.ecr \
  -out="$PLAN_DIR/$L-foundation.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-foundation.tfplan"
```

Terraform hiển thị cảnh báo về `-target`; điều này được dự kiến cho lượt bootstrap này. Tạo cluster mất khoảng 15 phút.

## 3. Kết nối kubectl {#3-connect-kubectl}

```bash
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
kubectl --context eks-workload get nodes -L role,node.kubernetes.io/instance-type,topology.kubernetes.io/zone
```

## Kiểm chứng {#verify}

```bash
kubectl --context eks-workload get nodes -l role=infra
kubectl --context eks-workload -n kube-system get pods
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw efs_file_system_id; echo
terraform -chdir="$TF_DIR/20-cluster-workload" output -json ecr_repository_urls | jq
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name; echo
```

**Kết quả mong đợi:**

- Ba node `Ready` có label `role=infra`, mỗi AZ một node.
- Pod CoreDNS, VPC CNI, EBS CSI và EFS CSI `Running` trong `kube-system`.
- EFS file system ID (`fs-…`), bảy ECR URL và tên node role của Karpenter.

Nếu node vẫn `NotReady`, kiểm tra Pod VPC CNI trước (`kubectl -n kube-system logs -l k8s-app=aws-node`).

**Tiếp theo:** [1.3 Cluster 2 — Observability](05-layer-21-cluster-observability.md). Bạn sẽ hoàn tất lớp này ở cuối bước đó.

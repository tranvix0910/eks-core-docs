---
title: "Bước 1.2 — Tạo workload cluster"
sidebar_label: "1.2 Cluster 1 · Workload"
---

# Bước 1.2 — Tạo workload cluster {#step-12--create-cluster-1-workload}

Sau khi có network, chúng ta sẽ tạo cluster `eks-workload`, Managed Node Group `infra`, EFS và các ECR repository cho ứng dụng. Các công cụ chạy bên trong cluster sẽ được cài ở cuối bước 1.3.

**Thời gian:** khoảng 20 phút. **Chạy từ:** `$TF_DIR/20-cluster-workload`.

## Resource được tạo {#what-this-layer-creates}

| Tài nguyên | Chi tiết |
|---|---|
| EKS `eks-workload` | Kubernetes 1.34, public endpoint, control-plane log gửi CloudWatch và lưu 7 ngày |
| Managed Node Group `infra` | 3 × `t3.large` On-Demand, AL2023, label `role=infra`, taint `CriticalAddonsOnly=true:NoSchedule` — chỉ chạy công cụ vận hành; các platform chart đều có toleration cho taint này, còn Pod ứng dụng thì không |
| EKS add-on | VPC CNI, CoreDNS, kube-proxy, EBS CSI, EFS CSI, Pod Identity Agent |
| Phần AWS của Karpenter | Node IAM role, controller IAM (Pod Identity), SQS interruption queue, EventBridge rule |
| EFS | File system có mount target trong từng workload subnet; cho phép NFS (2049) từ node |
| ECR | Bảy repository `shopnow/*` lưu image ứng dụng |
| Pod Identity association | EBS CSI, EFS CSI, Load Balancer Controller, Karpenter |

Layer này cũng quản lý LBC, Karpenter, ArgoCD, Prometheus, Metrics Server và StorageClass `gp3`, `efs-sc`. Các thành phần này cần EKS hoạt động trước, nên sẽ apply ở cuối [bước 1.3](05-layer-21-cluster-observability.md#6-finish-cluster-1).

## 1. Kiểm tra biến Terraform {#1-review-the-inputs}

```bash
grep -E 'kubernetes_version|nodegroup_|efs_create|ecr_repository' -A0 "$TF_DIR/20-cluster-workload/terraform.tfvars"
```

Giữ `efs_create = true` và bảy ECR repository cho ứng dụng. Đặt `eks_nodegroup_min_size` từ 2 trở lên để công cụ vận hành có node dự phòng khi một infra node gặp sự cố.

[![Terraform Init Workload layer kết nối S3 backend và cài EKS Module, Provider](/img/workshop/terraform/workload-init.png)](/img/workshop/terraform/workload-init.png)

*Workload layer Init thành công. Các ảnh capture dùng account và state của môi trường thực hành; làm theo lệnh bootstrap bên dưới cho lần triển khai mới. Bấm vào ảnh để xem đầy đủ.*

## 2. Apply hạ tầng AWS lần đầu {#2-apply-the-foundation-first-time-only}

Ở lần triển khai đầu, observability cluster chưa có state và Kubernetes API của workload cluster cũng chưa sẵn sàng cho Helm. Chúng ta sẽ tạo EKS cùng các AWS resource trước. Các `-target` dưới đây nằm trong cùng một lệnh plan; dấu `\` chỉ để viết lệnh trên nhiều dòng:

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

Terraform sẽ cảnh báo về `-target` vì plan này chỉ chọn một phần cấu hình. Dùng cách này cho lượt bootstrap, chờ EKS tạo xong, rồi tiếp tục bước 1.3. Sau đó quay lại chạy full plan và apply layer 20 để cài các công cụ còn lại. Thời gian tạo EKS thường khoảng 15 phút.

[![Terraform Workload plan hiển thị output Cluster endpoint, ECR Repository, EFS và Karpenter](/img/workshop/terraform/workload-plan-outputs.png)](/img/workshop/terraform/workload-plan-outputs.png)

*Output dự kiến của Workload layer. Ảnh được chụp ở một lượt plan khác, không dùng để đối chiếu số resource của foundation plan. Bấm vào ảnh để xem đầy đủ.*

## 3. Cấu hình kubeconfig {#3-connect-kubectl}

```bash
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
kubectl --context eks-workload get nodes -L role,node.kubernetes.io/instance-type,topology.kubernetes.io/zone
```

## Kiểm tra {#verify}

```bash
kubectl --context eks-workload get nodes -l role=infra
kubectl --context eks-workload -n kube-system get pods
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw efs_file_system_id; echo
terraform -chdir="$TF_DIR/20-cluster-workload" output -json ecr_repository_urls | jq
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name; echo
```

**Kết quả:**

- Ba node `Ready` có label `role=infra`, mỗi AZ một node, mỗi node có taint `CriticalAddonsOnly`.
- Pod CoreDNS, VPC CNI, EBS CSI và EFS CSI `Running` trong `kube-system`.
- EFS file system ID (`fs-…`), bảy ECR URL và tên node role của Karpenter.

Nếu node còn `NotReady`, kiểm tra VPC CNI trước (`kubectl -n kube-system logs -l k8s-app=aws-node`).

**Tiếp theo:** [1.3 Cluster 2 — Observability](05-layer-21-cluster-observability.md). Bạn sẽ hoàn tất layer này ở cuối bước đó.

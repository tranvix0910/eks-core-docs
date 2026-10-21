---
title: "Bước 5.2 — Vận hành và cleanup"
sidebar_label: "5.2 Vận hành và cleanup"
---

# Bước 5.2 — Vận hành và cleanup {#step-52--day-2-operations-and-cleanup}

Sau khi hoàn tất workshop, bạn có thể tiếp tục thay đổi cấu hình hoặc dọn môi trường. Phần này hướng dẫn cập nhật qua Terraform và GitOps, rollback khi cần và xóa resource theo đúng thứ tự.

## Quản lý thay đổi {#which-tool-changes-what}

| Bạn muốn thay đổi… | Sửa | Sau đó |
|---|---|---|
| Network, phiên bản EKS, kích thước node group, IAM, EFS, ECR, S3 | `eks-core-terraform/<layer>/*.tf` hoặc `terraform.tfvars` | plan → kiểm tra → apply lớp đó |
| Platform chart (Karpenter, ArgoCD, Prometheus, Mimir, Loki, Grafana) | File values tại `eks-core-gitops/platform/…` | plan → apply lớp cài chart (20 hoặc 21) |
| Node pool | `eks-core-gitops/platform/nodepools/*.yaml` | `kubectl apply` |
| Service ShopNow (replica, tài nguyên, PDB, spread) | Chart hoặc values tại `eks-core-gitops/apps/…` | commit + push → ArgoCD sync |
| image ShopNow | Mã trong `eks-core-apps` | `IMAGE_TAG` mới → build → render → apply Application |

## Ví dụ 1 · Resize Infra Node Group {#example-1--resize-the-infra-node-group-terraform}

```bash
# eks-core-terraform/20-cluster-workload/terraform.tfvars
#   eks_nodegroup_desired_size = 4
#   eks_nodegroup_max_size     = 5
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" show "$PLAN_DIR/$L.tfplan" | grep -E '^\s+[~+-] |Plan:'
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
kubectl --context eks-workload get nodes -l role=infra
```

plan phải thể hiện **update in-place** node group, không thay thế.

## Ví dụ 2 · Scale Service qua GitOps {#example-2--scale-a-service-gitops}

```bash
cd "$GITOPS_DIR"
# apps/shopnow-backend-config/shopnow-product-service-config/overlays/production/values.yaml → replicaCount: 3
git commit -am "product-service: 3 replicas" && git push
argocd app sync shopnow-product-service && argocd app wait shopnow-product-service --health
kubectl --context eks-workload -n shopnow get pods -l app=shopnow-product-service -o wide
```

`workload-values.yaml` được đọc cuối nên ghi đè service overlay. Cập nhật replica trong values rồi sync. Nếu chỉ dùng `kubectl scale`, ArgoCD self-heal sẽ khôi phục giá trị từ Git.

## Ví dụ 3 · deploy image mới {#example-3--release-a-new-image}

```bash
export IMAGE_TAG=workshop-v2
(cd "$APPS_DIR" && bash scripts/build-images.sh)
(cd "$GITOPS_DIR" && bash examples/workshop/prepare-applications.sh)
kubectl --context eks-workload apply -f "$GITOPS_DIR/.workshop/applications/shopnow-product-service.yaml"
argocd app wait shopnow-product-service --health
```

backend dùng RollingUpdate với `maxUnavailable` trong Deployment. Topology spread tiếp tục được áp dụng khi schedule Pod mới. PDB kiểm soát request tới eviction API; số Pod bị thay trong rolling update do Deployment controller quản lý.

## Rollback {#roll-back}

| Thay đổi | Cách làm |
|---|---|
| GitOps | `git revert <commit>` rồi push; auto-sync áp dụng trạng thái trước |
| image | apply Application render với `IMAGE_TAG` trước đó |
| Terraform | Hoàn tác `.tf`/tfvars, plan, kiểm tra, apply |
| Node pool | `kubectl apply` manifest phiên bản trước từ Git |

## Tạm dừng môi trường {#pause-to-save-cost}

Scale Pod về 0 không dừng các resource AWS: EKS control plane, node `infra`/`monitoring`, NAT, EFS và load balancer vẫn tính phí. Nếu không dùng tiếp, backup database và file EFS cần giữ rồi cleanup theo thứ tự bên dưới. Lần sau có thể tạo lại môi trường từ Terraform và GitOps.

## Cleanup môi trường {#clean-up--remove-everything}

Thực hiện lần lượt từ ứng dụng, tải Balancer đến EKS và Network. Kiểm tra bước trước đã xong rồi mới destroy layer tiếp theo.

### 1. Ứng dụng và workload thực hành (cluster 1) {#1-applications-and-test-workloads-cluster-1}

```bash
for app in workshop-proof shopnow-frontend shopnow-api-gateway shopnow-user-service shopnow-cart-service \
           shopnow-product-service shopnow-config-server shopnow-discovery-server shopnow-database-services; do
  argocd app delete "$app" --cascade --yes
done
for f in spot-proof arm64-proof ratio-proof; do
  kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/$f.yaml" --ignore-not-found
done
helm --kube-context eks-workload uninstall alloy -n monitoring
kubectl --context eks-workload delete nodepools --all     # Karpenter terminates its nodes
kubectl --context eks-workload get nodeclaims -w          # wait until empty
```

### 2. Tải balancer do Kubernetes tạo (cluster 2) {#2-load-balancers-created-by-kubernetes-cluster-2}

```bash
kubectl --context eks-observability delete -f "$GITOPS_DIR/.workshop/internal-ingress.yaml"
```

Chờ ALB nội bộ biến mất trong EC2 console; Terraform không xóa được VPC còn load balancer.

### 3. Gỡ Dependency giữa layer 20 và 21 {#3-break-the-link-between-layers-20-and-21}

layer 21 giữ DNS record cho ALB, layer 20 đọc state layer 21. Trước khi destroy:

1. Đặt `internal_observability_alb_name = null` trong tfvars layer 21 rồi apply layer 21 để xóa alias.
2. Tại layer 20, bỏ remote-state data source `cluster_observability`, đặt observability node security group thành `null`; plan và apply layer 20.

### 4. Terraform destroy từng layer {#4-destroy-layer-by-layer}

```bash
for L in 21-cluster-observability 20-cluster-workload 10-network; do
  terraform -chdir="$TF_DIR/$L" plan -destroy -out="$PLAN_DIR/destroy-$L.tfplan"
  terraform -chdir="$TF_DIR/$L" show "$PLAN_DIR/destroy-$L.tfplan" | tail -3
  read -r -p "Apply destroy of $L? (yes/no) " ok && [ "$ok" = yes ] || break
  terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/destroy-$L.tfplan"
done
```

Nếu destroy dừng vì bucket Mimir/Loki còn dữ liệu, quyết định có giữ dữ liệu không, làm trống bucket rồi lập plan lại.

### 5. Kiểm tra resource còn lại {#5-check-for-leftovers}

```bash
aws eks list-clusters
aws ec2 describe-instances --filters Name=tag:karpenter.sh/discovery,Values=eks-workload \
  --query 'Reservations[].Instances[].InstanceId'
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerName'
aws acm list-certificates --query 'CertificateSummaryList[].DomainName'
```

Xóa thủ công chứng chỉ ACM đã import vì Terraform không quản lý nó. State bucket được giữ lại; chỉ xóa khi không còn cần lịch sử.

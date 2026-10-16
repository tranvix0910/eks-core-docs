---
title: "Bước 5.2 — Vận hành và cleanup"
sidebar_label: "5.2 Vận hành và cleanup"
---

# Bước 5.2 — Vận hành và cleanup {#step-52--day-2-operations-and-cleanup}

:::info Tóm tắt bước thực hành
**Mục tiêu:** thay đổi nền tảng an toàn qua đúng công cụ quản lý, rollback, tạm dừng và cuối cùng xóa mọi tài nguyên theo thứ tự.
:::

## Công cụ nào thay đổi phần nào {#which-tool-changes-what}

| Bạn muốn thay đổi… | Sửa | Sau đó |
|---|---|---|
| Network, phiên bản EKS, kích thước node group, IAM, EFS, ECR, S3 | `eks-core-terraform/<layer>/*.tf` hoặc `terraform.tfvars` | plan → kiểm tra → apply lớp đó |
| Platform chart (Karpenter, ArgoCD, Prometheus, Mimir, Loki, Grafana) | Tệp values tại `eks-core-gitops/platform/…` | plan → apply lớp cài chart (20 hoặc 21) |
| Node pool | `eks-core-gitops/platform/nodepools/*.yaml` | `kubectl apply` |
| Service ShopNow (replica, tài nguyên, PDB, spread) | Chart hoặc values tại `eks-core-gitops/apps/…` | commit + push → ArgoCD sync |
| Image ShopNow | Mã trong `eks-core-apps` | `IMAGE_TAG` mới → build → render → apply Application |

## Ví dụ 1 — đổi kích thước infra node group (Terraform) {#example-1--resize-the-infra-node-group-terraform}

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

Plan phải thể hiện **update in-place** node group, không thay thế.

## Ví dụ 2 — tăng replica service (GitOps) {#example-2--scale-a-service-gitops}

```bash
cd "$GITOPS_DIR"
# apps/shopnow-backend-config/shopnow-product-service-config/overlays/production/values.yaml → replicaCount: 3
git commit -am "product-service: 3 replicas" && git push
argocd app sync shopnow-product-service && argocd app wait shopnow-product-service --health
kubectl --context eks-workload -n shopnow get pods -l app=shopnow-product-service -o wide
```

`workload-values.yaml` được áp dụng cuối nên giá trị ở đó ưu tiên hơn service overlay. Không `kubectl scale` Deployment do ArgoCD quản lý; self-heal sẽ khôi phục lại.

## Ví dụ 3 — phát hành image mới {#example-3--release-a-new-image}

```bash
export IMAGE_TAG=workshop-v2
(cd "$APPS_DIR" && bash scripts/build-images.sh)
(cd "$GITOPS_DIR" && bash examples/workshop/prepare-applications.sh)
kubectl --context eks-workload apply -f "$GITOPS_DIR/.workshop/applications/shopnow-product-service.yaml"
argocd app wait shopnow-product-service --health
```

Backend rollout từng Pod (`maxUnavailable` từ chart), nên quy tắc PDB và spread được giữ trong quá trình rollout.

## Rollback {#roll-back}

| Thay đổi | Cách làm |
|---|---|
| GitOps | `git revert <commit>` rồi push; auto-sync áp dụng trạng thái trước |
| Image | Apply Application render với `IMAGE_TAG` trước đó |
| Terraform | Hoàn tác `.tf`/tfvars, plan, kiểm tra, apply |
| Node pool | `kubectl apply` manifest phiên bản trước từ Git |

## Tạm dừng để tiết kiệm chi phí {#pause-to-save-cost}

Scale Pod về 0 không ngừng tính phí: control plane, node infra/monitoring, NAT, EFS và load balancer vẫn chạy. Để tạm dừng thực sự, destroy rồi tạo lại vì toàn bộ nền tảng được mô tả bằng mã. Trước khi destroy, backup dữ liệu cần giữ như database dump và tệp EFS.

## Cleanup — xóa toàn bộ {#clean-up--remove-everything}

Xóa theo thứ tự dưới đây. Mỗi bước xóa thành phần phụ thuộc vào bước tiếp theo.

### 1. Ứng dụng và workload thử nghiệm (cluster 1) {#1-applications-and-test-workloads-cluster-1}

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

### 2. Load balancer do Kubernetes tạo (cluster 2) {#2-load-balancers-created-by-kubernetes-cluster-2}

```bash
kubectl --context eks-observability delete -f "$GITOPS_DIR/.workshop/internal-ingress.yaml"
```

Chờ ALB nội bộ biến mất trong EC2 console; Terraform không xóa được VPC còn load balancer.

### 3. Ngắt phụ thuộc giữa lớp 20 và 21 {#3-break-the-link-between-layers-20-and-21}

Lớp 21 giữ DNS record cho ALB, lớp 20 đọc state lớp 21. Trước khi destroy:

1. Đặt `internal_observability_alb_name = null` trong tfvars lớp 21 rồi apply lớp 21 để xóa alias.
2. Tại lớp 20, bỏ remote-state data source `cluster_observability`, đặt observability node security group thành `null`; plan và apply lớp 20.

### 4. Destroy từng lớp {#4-destroy-layer-by-layer}

```bash
for L in 21-cluster-observability 20-cluster-workload 10-network; do
  terraform -chdir="$TF_DIR/$L" plan -destroy -out="$PLAN_DIR/destroy-$L.tfplan"
  terraform -chdir="$TF_DIR/$L" show "$PLAN_DIR/destroy-$L.tfplan" | tail -3
  read -r -p "Apply destroy of $L? (yes/no) " ok && [ "$ok" = yes ] || break
  terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/destroy-$L.tfplan"
done
```

Nếu destroy dừng vì bucket Mimir/Loki còn dữ liệu, quyết định có giữ dữ liệu không, làm trống bucket rồi lập plan lại.

### 5. Kiểm tra tài nguyên còn sót {#5-check-for-leftovers}

```bash
aws eks list-clusters
aws ec2 describe-instances --filters Name=tag:karpenter.sh/discovery,Values=eks-workload \
  --query 'Reservations[].Instances[].InstanceId'
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerName'
aws acm list-certificates --query 'CertificateSummaryList[].DomainName'
```

Xóa thủ công chứng chỉ ACM đã import vì Terraform không quản lý nó. State bucket được giữ lại; chỉ xóa khi không còn cần lịch sử.

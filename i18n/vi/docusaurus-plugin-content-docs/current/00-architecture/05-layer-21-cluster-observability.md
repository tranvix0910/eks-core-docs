---
title: "Bước 1.3 — Setup Cluster 2 · Observability và hoàn tất Cluster 1"
sidebar_label: "1.3 Cluster 2 · Observability"
---

# Bước 1.3 — Setup Cluster 2 · Observability và hoàn tất Cluster 1 {#step-13--create-cluster-2-observability-and-finish-cluster-1}

:::info Nội dung thực hiện
**Mục tiêu:** tạo Cluster Observability với Mimir, Loki, Grafana và S3; sau đó cài Platform Tools trên Cluster Workload.
**Yêu cầu:** 8 (observability tập trung). **Thời gian:** khoảng 30 phút. **Chạy từ:** `$TF_DIR`.
:::

## Resource của Layer {#what-this-layer-creates}

| Tài nguyên | Chi tiết |
|---|---|
| EKS `eks-observability` | Kubernetes 1.34 |
| Managed Node Group `monitoring` | 2 × `t3.medium` On-Demand |
| S3 bucket | `eks-observability-mimir-<account>` và `eks-observability-loki-<account>`, hết hạn sau 30 ngày |
| Pod Identity | Quyền S3 cho Mimir và Loki, EBS CSI, Load Balancer Controller |
| Security group ALB nội bộ | Cho phép node cluster 1 qua cổng 9009 (Mimir) và 3100 (Loki) |
| Private hosted zone | `observability.internal` |
| Helm release | LBC trong `kube-system`; Prometheus (metrics riêng cluster 2), Mimir 6.1, Loki 7.3, Grafana 10.5 trong `monitoring` |

Mimir và Loki dùng 1 replica cho mỗi thành phần trong môi trường workshop. S3 lưu dữ liệu dài hạn; EBS lưu write-ahead log và cache.

## 1. Apply AWS Foundation {#1-apply-the-foundation}

```bash
L=21-cluster-observability
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan \
  -target=module.eks \
  -target=module.s3 \
  -target=module.ebs_csi_pod_identity \
  -target=module.lb_controller_pod_identity \
  -target=module.s3_pod_identity \
  -out="$PLAN_DIR/$L-foundation.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-foundation.tfplan"

aws eks update-kubeconfig --name eks-observability --region "$AWS_REGION" --alias eks-observability
kubectl --context eks-observability get nodes -L role
```

## 2. Tạo Namespace, StorageClass và Load Balancer Controller {#2-namespace-storage-class-and-load-balancer-controller}

Grafana cần ConfigMap Dashboard trong namespace `monitoring`. Apply các resource chuẩn bị bằng Terraform trước khi full Apply:

```bash
terraform -chdir="$TF_DIR/$L" plan \
  -target=kubernetes_namespace_v1.monitoring \
  -target=kubernetes_storage_class_v1.gp3 \
  -target=helm_release.aws_load_balancer_controller \
  -out="$PLAN_DIR/$L-prereqs.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-prereqs.tfplan"
```

## 3. Import Grafana Dashboard {#3-load-the-grafana-dashboard}

```bash
kubectl --context eks-observability -n monitoring create configmap enterprise-workload-dashboard \
  --from-file=enterprise-workload-360.json="$GITOPS_DIR/platform/observability/grafana/dashboards/enterprise-workload-360.json" \
  --dry-run=client -o yaml | kubectl --context eks-observability apply -f -
```

## 4. Full Apply Cluster 2 {#4-full-apply-of-cluster-2}

Tạm giữ `internal_observability_alb_name = null`; ALB nội bộ được tạo tại [bước 4.1](../platform-addons/cert-manager-and-internal-tls).

```bash
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
```

Terraform đọc Mimir/Loki values từ `$GITOPS_DIR/platform/observability/` và thêm Account ID vào tên S3 Bucket.

## 5. Kiểm tra kết quả cluster 2 {#5-verify-cluster-2}

```bash
kubectl --context eks-observability -n monitoring get pods,pvc
helm --kube-context eks-observability list -n monitoring
terraform -chdir="$TF_DIR/$L" output mimir_bucket_name
```

**Kết quả cần có:** mọi Pod `Running`/`Ready`, mọi PVC `Bound`, bốn release `deployed` trong `monitoring` (prometheus, mimir, loki, grafana). Load balancer controller nằm trong `kube-system`.

| Triệu chứng | Kiểm tra |
|---|---|
| Mimir/Loki `CrashLoopBackOff` với `AccessDenied` | Pod Identity association cho ServiceAccount `mimir`/`loki`; tên bucket trong values |
| PVC `Pending` | `kubectl get sc gp3`; Pod EBS CSI trong `kube-system` |
| Pod `Pending` với `Insufficient cpu` | Requests so với capacity hai node `t3.medium`; tăng `eks_nodegroup_desired_size` |

## 6. Full Apply Cluster 1 {#6-finish-cluster-1}

Khi Cluster Observability đã có state, chạy full Plan và Apply Layer 20. Lượt này cài Platform Tools trên Managed Node Group `infra`:

```bash
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
```

[![Terraform hoàn tất Helm Release ArgoCD, Prometheus, Grafana và Grafana Ingress trên Cluster Workload](/img/workshop/terraform/workload-full-apply.png)](/img/workshop/terraform/workload-full-apply.png)

*Terraform cài Platform Tools khi full Apply Workload Layer. Số resource trong ảnh là tổng của lần chạy được capture. Bấm vào ảnh để xem đầy đủ.*

Các thành phần được cài thêm:

| Release / tài nguyên | Namespace |
|---|---|
| AWS Load Balancer Controller 3.4 | `kube-system` |
| Karpenter 1.14 (controller và CRD) | `kube-system` |
| ArgoCD (chart 10.3) | `argocd` |
| kube-prometheus-stack 88.6 | `monitoring` |
| Metrics Server | `kube-system` |
| StorageClass `gp3` và `efs-sc` | Toàn cluster |
| Grafana và Kite (công cụ hỗ trợ cục bộ trên cluster 1) | `monitoring`, `kite-system` |

Prometheus cần TLS Secret được tạo tại [bước 4.1](../platform-addons/cert-manager-and-internal-tls) để gửi metrics. Nếu chưa làm bước này, remote_write có thể báo lỗi kết nối hoặc thiếu CA.

## Kiểm tra kết quả nền tảng cluster 1 {#verify-cluster-1-platform}

```bash
helm --kube-context eks-workload list -A
kubectl --context eks-workload get storageclass gp3 efs-sc
kubectl --context eks-workload get crd nodepools.karpenter.sh ec2nodeclasses.karpenter.k8s.aws
```

**Kết quả cần có:** các release trên `deployed`, có đủ hai StorageClass và hai CRD Karpenter.

[![Cluster Workload có 3 node infra Ready ở 3 AZ; LBC, Karpenter, CSI, CoreDNS, Metrics Server Running](/img/workshop/terraform/workload-nodes-and-addons.png)](/img/workshop/terraform/workload-nodes-and-addons.png)

*Sau full Apply, 3 node `infra` ở 3 AZ đã Ready; các add-on và controller đã Running. Profile trong ảnh là profile của người thực hiện. Bấm vào ảnh để xem đầy đủ.*

**Tiếp theo:** [2.1 Platform Tools](../platform-addons/gitops-bootstrap-order)

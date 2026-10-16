---
title: "Bước 1.3 — Tạo cluster 2 (observability) và hoàn tất cluster 1"
sidebar_label: "1.3 Cluster 2 · Observability"
---

# Bước 1.3 — Tạo cluster 2 (observability) và hoàn tất cluster 1 {#step-13--create-cluster-2-observability-and-finish-cluster-1}

:::info Tóm tắt bước thực hành
**Mục tiêu:** EKS cluster `eks-observability` chạy Mimir, Loki và Grafana với lưu trữ S3; sau đó cài công cụ nền tảng trên cluster 1.
**Yêu cầu:** 8 (observability tập trung). **Thời gian:** khoảng 30 phút. **Chạy từ:** `$TF_DIR`.
:::

## Tài nguyên lớp này tạo ra {#what-this-layer-creates}

| Tài nguyên | Chi tiết |
|---|---|
| EKS `eks-observability` | Kubernetes 1.34 |
| Managed Node Group `monitoring` | 2 × `t3.medium` On-Demand |
| S3 bucket | `eks-observability-mimir-<account>` và `eks-observability-loki-<account>`, hết hạn sau 30 ngày |
| Pod Identity | Quyền S3 cho Mimir và Loki, EBS CSI, Load Balancer Controller |
| Security group ALB nội bộ | Cho phép node cluster 1 qua cổng 9009 (Mimir) và 3100 (Loki) |
| Private hosted zone | `observability.internal` |
| Helm release | LBC, Prometheus (metrics riêng cluster 2), Mimir 6.1, Loki 7.3, Grafana 10.5 — đều trong namespace `monitoring` |

Mimir và Loki chạy một replica cho mỗi thành phần để vừa hai node nhỏ. S3 lưu dữ liệu dài hạn; EBS volume lưu write-ahead log và cache.

## 1. Apply hạ tầng nền {#1-apply-the-foundation}

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

## 2. Namespace, storage class và load balancer controller {#2-namespace-storage-class-and-load-balancer-controller}

Grafana mount ConfigMap dashboard, nên namespace phải tồn tại trước khi apply đầy đủ. Để Terraform tạo namespace do chính nó quản lý:

```bash
terraform -chdir="$TF_DIR/$L" plan \
  -target=kubernetes_namespace_v1.monitoring \
  -target=kubernetes_storage_class_v1.gp3 \
  -target=helm_release.aws_load_balancer_controller \
  -out="$PLAN_DIR/$L-prereqs.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-prereqs.tfplan"
```

## 3. Nạp dashboard Grafana {#3-load-the-grafana-dashboard}

```bash
kubectl --context eks-observability -n monitoring create configmap enterprise-workload-dashboard \
  --from-file=enterprise-workload-360.json="$GITOPS_DIR/platform/observability/grafana/dashboards/enterprise-workload-360.json" \
  --dry-run=client -o yaml | kubectl --context eks-observability apply -f -
```

## 4. Apply đầy đủ cluster 2 {#4-full-apply-of-cluster-2}

Tạm giữ `internal_observability_alb_name = null`; ALB nội bộ được tạo tại [bước 4.1](../platform-addons/cert-manager-and-internal-tls).

```bash
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
```

Terraform đọc values Mimir và Loki từ `$GITOPS_DIR/platform/observability/`, rồi điền account ID của bạn vào tên bucket.

## 5. Kiểm chứng cluster 2 {#5-verify-cluster-2}

```bash
kubectl --context eks-observability -n monitoring get pods,pvc
helm --kube-context eks-observability list -n monitoring
terraform -chdir="$TF_DIR/$L" output mimir_bucket_name
```

**Kết quả mong đợi:** mọi Pod `Running`/`Ready`, mọi PVC `Bound`, bốn release `deployed` trong `monitoring` (prometheus, mimir, loki, grafana). Load balancer controller nằm trong `kube-system`.

| Triệu chứng | Kiểm tra |
|---|---|
| Mimir/Loki `CrashLoopBackOff` với `AccessDenied` | Pod Identity association cho ServiceAccount `mimir`/`loki`; tên bucket trong values |
| PVC `Pending` | `kubectl get sc gp3`; Pod EBS CSI trong `kube-system` |
| Pod `Pending` với `Insufficient cpu` | Requests so với capacity hai node `t3.medium`; tăng `eks_nodegroup_desired_size` |

## 6. Hoàn tất cluster 1 {#6-finish-cluster-1}

State cluster 2 đã tồn tại, nên có thể apply đầy đủ lớp 20. Lượt này cài công cụ nền tảng trên node `infra`:

```bash
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
```

Các thành phần được thêm:

| Release / tài nguyên | Namespace |
|---|---|
| AWS Load Balancer Controller 3.4 | `kube-system` |
| Karpenter 1.14 (controller và CRD) | `kube-system` |
| ArgoCD (chart 10.3) | `argocd` |
| kube-prometheus-stack 88.6 | `monitoring` |
| Metrics Server | `kube-system` |
| StorageClass `gp3` và `efs-sc` | Toàn cluster |
| Grafana và Kite (công cụ hỗ trợ cục bộ trên cluster 1) | `monitoring`, `kite` |

Prometheus chờ TLS secret được tạo tại [bước 4.1](../platform-addons/cert-manager-and-internal-tls) để gửi metrics; trước đó có thể xuất hiện lỗi. Đây là trạng thái dự kiến.

## Kiểm chứng nền tảng cluster 1 {#verify-cluster-1-platform}

```bash
helm --kube-context eks-workload list -A
kubectl --context eks-workload get storageclass gp3 efs-sc
kubectl --context eks-workload get crd nodepools.karpenter.sh ec2nodeclasses.karpenter.k8s.aws
```

**Kết quả mong đợi:** các release trên `deployed`, có đủ hai StorageClass và hai CRD Karpenter.

**Tiếp theo:** [2.1 Công cụ nền tảng](../platform-addons/gitops-bootstrap-order)

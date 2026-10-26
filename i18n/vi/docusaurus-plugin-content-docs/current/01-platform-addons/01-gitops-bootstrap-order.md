---
title: "Bước 2.1 — Công cụ vận hành trên Managed Node Group"
sidebar_label: "2.1 Các công cụ trên cluster"
---

# Bước 2.1 — Công cụ vận hành trên Managed Node Group {#step-21--platform-tools-on-the-managed-node-group}

Ở bước 1.3, Terraform đã cài ArgoCD, Karpenter và Prometheus. Trong phần này, chúng ta sẽ kiểm tra các công cụ đó đang chạy trên node `infra`, rồi cài thêm cert-manager, Argo Rollouts và JavaMelody.

**Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR`.

## Node selector cho công cụ vận hành {#how-the-tools-are-pinned-to-the-infra-nodes}

Node trong group `infra` có label `role=infra`. Chúng ta dùng `nodeSelector` trong Helm values để các công cụ chạy trên nhóm node này:

```yaml
nodeSelector:
  role: infra
```

| Công cụ | Cài đặt bởi | Values / manifest |
|---|---|---|
| Karpenter | Terraform (bước 1.3) | `platform/addons/karpenter/values.yaml` |
| ArgoCD | Terraform (bước 1.3) | `platform/addons/argocd/values.yaml` |
| Prometheus (kube-prometheus-stack) | Terraform (bước 1.3) | `platform/addons/prometheus/values.yaml` |
| Metrics Server, Load Balancer Controller | Terraform (bước 1.3) | `platform/addons/metrics-server/values.yaml` |
| cert-manager | Helm, tại bước này | `platform/addons/cert-manager/values.yaml` |
| Argo Rollouts | Helm, tại bước này | `--set nodeSelector.role=infra` |
| JavaMelody collector | kubectl, tại bước này | `platform/addons/javamelody/javamelody-collector.yaml` |
| Kite dashboard | Terraform (bước 1.3) | values trong `20-cluster-workload/helm_releases.tf` — xem [bước 2.5](kite-dashboard) |

Các release do Terraform cài vẫn được cập nhật bằng Terraform. Sửa values rồi plan và apply layer tương ứng, thay vì cài thêm một release bằng `helm install`.

## 1. Cài cert-manager {#1-install-cert-manager}

Công cụ cert-manager cấp chứng chỉ cho endpoint telemetry nội bộ tại [bước 4.1](cert-manager-and-internal-tls).

```bash
helm repo add jetstack https://charts.jetstack.io && helm repo update jetstack
helm --kube-context eks-workload upgrade --install cert-manager jetstack/cert-manager \
  --version v1.21.1 --namespace cert-manager --create-namespace \
  --values "$GITOPS_DIR/platform/addons/cert-manager/values.yaml" --wait --timeout 10m
```

[![Helm cài cert-manager trong namespace cert-manager với trạng thái deployed](/img/workshop/platform/cert-manager-deployed.png)](/img/workshop/platform/cert-manager-deployed.png)

*Release `cert-manager` đã `deployed` sau bước cài đặt. Bấm vào ảnh để xem đầy đủ.*

## 2. Cài Argo Rollouts {#2-install-argo-rollouts}

Frontend của ứng dụng dùng Argo `Rollout` với chiến lược Blue-Green. Cài CRD và Rollouts controller trước khi deploy frontend.

```bash
helm repo add argo https://argoproj.github.io/argo-helm && helm repo update argo
helm search repo argo/argo-rollouts --versions | head -5     # pick a version
export ROLLOUTS_CHART_VERSION=<version from the list>
helm --kube-context eks-workload upgrade --install argo-rollouts argo/argo-rollouts \
  --version "$ROLLOUTS_CHART_VERSION" --namespace argo-rollouts --create-namespace \
  --set controller.nodeSelector.role=infra \
  --set-json 'controller.tolerations=[{"key":"CriticalAddonsOnly","operator":"Exists","effect":"NoSchedule"}]' \
  --wait --timeout 10m
kubectl --context eks-workload get crd rollouts.argoproj.io
```

## 3. Cài JavaMelody collector {#3-install-the-javamelody-collector}

JavaMelody collector đọc thống kê JVM, HTTP và JDBC từ các Spring service. Collector chạy dưới dạng StatefulSet và lưu dữ liệu trên PVC `gp3` riêng.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/addons/javamelody/javamelody-collector.yaml"
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
```

Collector chỉ có dữ liệu sau khi kết nối với các service đã deploy ([JavaMelody](javamelody)).

## Kiểm tra công cụ vận hành trên node infra {#verify--every-tool-is-on-an-infra-node}

```bash
for ns in kube-system argocd monitoring cert-manager argo-rollouts javamelody; do
  kubectl --context eks-workload -n "$ns" get pods \
    -o custom-columns=NAMESPACE:.metadata.namespace,POD:.metadata.name,NODE:.spec.nodeName --no-headers
done | while read -r ns pod node; do
  printf '%-14s %-60s role=%s\n' "$ns" "$pod" \
    "$(kubectl --context eks-workload get node "$node" -o jsonpath='{.metadata.labels.role}')"
done | grep -Ev 'aws-node|kube-proxy|ebs-csi-node|efs-csi-node|pod-identity|node-exporter'
```

**Kết quả:** mọi dòng kết thúc bằng `role=infra`. DaemonSet như VPC CNI, kube-proxy, CSI node driver và node-exporter vốn chạy trên mọi node và được loại khỏi kết quả.

## Truy cập công cụ vận hành {#open-the-tools}

Dùng port-forward để truy cập các UI trên máy local. Chạy mỗi lệnh trong một terminal riêng.

| Công cụ | Lệnh | URL |
|---|---|---|
| ArgoCD | `kubectl --context eks-workload -n argocd port-forward svc/argocd-server 8080:80` | http://localhost:8080 |
| Prometheus | `kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090` | http://localhost:9090 |
| JavaMelody | `kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080` | http://localhost:8081 |

Mật khẩu admin ArgoCD:

```bash
kubectl --context eks-workload -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 --decode; echo
```

**Tiếp theo:** [2.2 Ba nhóm NodePool](../karpenter/ec2nodeclass-and-nodepools-configuration)

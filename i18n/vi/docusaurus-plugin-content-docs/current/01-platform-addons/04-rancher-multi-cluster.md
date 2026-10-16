---
title: "Mở rộng — Quản lý hai cluster bằng Rancher"
---

# Rancher là bài mở rộng {#rancher-is-an-extension-lab}

Rancher cung cấp một UI cho hai cluster. Đây không phải điều kiện nghiệm thu ArgoCD, EFS, Karpenter hoặc telemetry; hãy cài sau khi hoàn tất bài cốt lõi.

## 1. Cài trên Managed Node Group infra {#1-install-on-the-infra-managed-node-group}

```bash
helm repo add rancher-stable https://releases.rancher.com/server-charts/stable
helm repo update rancher-stable
helm --kube-context eks-workload upgrade --install rancher rancher-stable/rancher \
  --version 2.14.3 --namespace cattle-system --create-namespace \
  --values "$GITOPS_DIR"/platform/addons/rancher/values.yaml --wait --timeout 15m
kubectl --context eks-workload -n cattle-system get pods -o wide
```

Kiểm tra support matrix với phiên bản Kubernetes trước khi dùng phiên bản được ghim này. Values dùng `extraNodeSelectorTerms` và `extraTolerations`; chỉ dùng `nodeSelector` nếu template chart hỗ trợ key đó.

## 2. Truy cập UI {#2-access-the-ui}

```bash
kubectl --context eks-workload -n cattle-system port-forward svc/rancher 8443:443
```

Mở `https://localhost:8443`. Lấy bootstrap password từ Secret theo quy trình Rancher và thay mật khẩu; không ghi vào tài liệu. Trình duyệt cần HTTPS cho session cookie `Secure`.

## 3. Import cluster 2 {#3-import-cluster-2}

Apply `platform/addons/rancher/internal-nlb-service.yaml` sau khi đối chiếu tên SG với output Terraform. NLB TCP passthrough giữ nguyên chứng chỉ TLS Rancher trình cho agent. Node cluster 2 cần kết nối tới NLB/Pod qua cổng 443.

Trong Rancher, đặt server URL thành endpoint agent truy cập được, chọn Import Existing Cluster và dùng manifest đăng ký do UI của phiên bản đang chạy tạo ra. Manifest chứa registration token; không commit. Apply bằng `--context eks-observability`, sau đó kiểm tra log `cattle-cluster-agent` và trạng thái Active trong Rancher.

## 4. Quản lý và gỡ bỏ {#4-management-and-removal}

Import cluster không chuyển quyền quản lý Terraform/GitOps sang Rancher. Sửa Deployment do ArgoCD quản lý qua UI không tạo desired state bền vững. Để gỡ Rancher, gỡ cluster/agent đã import trước, xóa NLB Service rồi uninstall Rancher. Chờ load balancer được dọn xong trước khi destroy VPC.

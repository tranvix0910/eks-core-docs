---
title: "Mở rộng · Quản lý Cluster bằng Rancher"
---

# Cấu hình Rancher {#rancher-is-an-extension-lab}

Rancher cung cấp một giao diện để quản lý cả hai cluster. Bạn có thể làm phần này sau khi ứng dụng, EFS, Karpenter và observability đã hoạt động. Rancher không bắt buộc trong các bài thực hành chính.

## 1. Cài trên Managed Node Group infra {#1-install-on-the-infra-managed-node-group}

```bash
helm repo add rancher-stable https://releases.rancher.com/server-charts/stable
helm repo update rancher-stable
helm --kube-context eks-workload upgrade --install rancher rancher-stable/rancher \
  --version 2.14.3 --namespace cattle-system --create-namespace \
  --values "$GITOPS_DIR"/platform/addons/rancher/values.yaml --wait --timeout 15m
kubectl --context eks-workload -n cattle-system get pods -o wide
```

Kiểm tra support matrix của Rancher với phiên bản Kubernetes trước khi cài. Chart này dùng `extraNodeSelectorTerms` và `extraTolerations`; đối chiếu template trước khi thêm `nodeSelector`.

## 2. Truy cập UI {#2-access-the-ui}

```bash
kubectl --context eks-workload -n cattle-system port-forward svc/rancher 8443:443
```

Mở `https://localhost:8443`. Lấy bootstrap password từ Secret theo quy trình Rancher và thay mật khẩu; không ghi vào tài liệu. Trình duyệt cần HTTPS cho session cookie `Secure`.

## 3. Import cluster 2 {#3-import-cluster-2}

apply `platform/addons/rancher/internal-nlb-service.yaml` sau khi đối chiếu tên SG với output Terraform. NLB TCP passthrough giữ nguyên chứng chỉ TLS Rancher trình cho agent. Node cluster 2 cần kết nối tới NLB/Pod qua cổng 443.

Trong Rancher, đặt server URL thành endpoint agent truy cập được, chọn import Existing Cluster và dùng manifest đăng ký do UI của phiên bản đang chạy tạo ra. Manifest chứa registration token; không commit. Apply bằng `--context eks-observability`, sau đó kiểm tra log `cattle-cluster-agent` và trạng thái Active trong Rancher.

## 4. Quản lý và gỡ Rancher {#4-management-and-removal}

Sau khi import cluster, Terraform và ArgoCD vẫn quản lý các resource đã tạo. Thay đổi Deployment của ứng dụng cần được lưu trong Git để ArgoCD giữ cấu hình đó. Khi gỡ Rancher, xóa cluster/agent đã import, xóa NLB Service rồi uninstall release. Chờ load balancer được dọn xong trước khi destroy VPC.
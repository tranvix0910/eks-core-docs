---
title: "Mở rộng · Blue-Green Deployment"
---

# Deploy frontend với Argo Rollouts {#test-a-version-before-switching-users}

ArgoCD lấy cấu hình từ Git và tạo resource trong cluster. Argo Rollouts theo dõi các ReplicaSet active/preview, quản lý việc promote và chuyển phiên bản đang phục vụ người dùng. Trước khi sync frontend, cần cài controller và CRD của Rollouts.

## 1. Kiểm tra Rollout hiện tại {#1-inspect-the-current-rollout}

```bash
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -o yaml
kubectl --context eks-workload -n shopnow get svc shopnow-frontend-service shopnow-frontend-preview-service -o yaml
```

`activeService` trỏ tới phiên bản đang phục vụ người dùng, còn `previewService` trỏ tới phiên bản mới để thử trước. Với `autoPromotionEnabled=false`, rollout chờ bạn promote. Sau khi chuyển, `scaleDownDelaySeconds=30` giữ phiên bản cũ thêm một khoảng ngắn trước khi scale down.

## 2. Deploy phiên bản mới {#2-deliver-a-new-version-through-argocd}

build và push frontend với image tag mới, cập nhật Application/values rồi ArgoCD sync. Dùng tag riêng cho mỗi phiên bản để Kubernetes có thể phân biệt image.

```bash
argocd app get shopnow-frontend
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -w
```

## 3. Test preview {#3-verify-preview}

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-frontend-preview-service 8083:80
```

Mở `http://localhost:8083`, kiểm tra UI/API URL, danh sách sản phẩm, đăng nhập và giỏ hàng bằng dữ liệu giả lập. Port-forward preview không thay API URL đã được build vào image.

## 4. Promote và rollback {#4-promote-or-roll-back}

Với plugin `kubectl argo rollouts` tương thích:

```bash
kubectl --context eks-workload argo rollouts get rollout shopnow-frontend-rollout -n shopnow
kubectl --context eks-workload argo rollouts promote shopnow-frontend-rollout -n shopnow
```

Có thể dùng action promote của ArgoCD nếu extension/controller hỗ trợ. Kiểm tra active selector và request thực tế sau promote.

Để rollback và giữ cấu hình sau đó, đưa image tag/commit trong Git về phiên bản trước rồi sync. Nếu chỉ chạy `argo rollouts undo`, ArgoCD self-heal có thể deploy lại tag đang khai báo trong Git. Blue-Green chuyển toàn bộ Active Service sang phiên bản mới; bài này không dùng Weighted Canary 10/90.

**Kết quả kiểm tra:** commit/tag trước và sau, preview hoạt động, active selector thay đổi sau promote và rollback thành công về phiên bản mong muốn.

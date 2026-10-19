---
title: "Mở rộng · Blue-Green Deployment"
---

# Deploy Frontend với Argo Rollouts {#test-a-version-before-switching-users}

ArgoCD Sync cấu hình từ Git; Argo Rollouts quản lý Active/Preview ReplicaSet và Promote phiên bản. Cài Rollouts Controller và CRD trước khi Sync Frontend.

## 1. Kiểm tra Rollout hiện tại {#1-inspect-the-current-rollout}

```bash
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -o yaml
kubectl --context eks-workload -n shopnow get svc shopnow-frontend-service shopnow-frontend-preview-service -o yaml
```

`activeService` phục vụ người dùng; `previewService` trỏ tới phiên bản đang thử. `autoPromotionEnabled=false` tạo điểm chờ phê duyệt thủ công. `scaleDownDelaySeconds=30` giữ phiên bản trước trong thời gian ngắn sau promote, không bảo đảm rollback tức thì vô thời hạn.

## 2. Deploy phiên bản mới {#2-deliver-a-new-version-through-argocd}

Build và Push Frontend với Image Tag mới, cập nhật Application/values rồi ArgoCD Sync. Dùng tag riêng cho mỗi phiên bản để Kubernetes có thể phân biệt image.

```bash
argocd app get shopnow-frontend
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -w
```

## 3. Test Preview {#3-verify-preview}

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-frontend-preview-service 8083:80
```

Mở `http://localhost:8083`, kiểm tra UI/API URL, danh sách sản phẩm, đăng nhập và giỏ hàng bằng dữ liệu giả lập. Port-forward preview không thay API URL đã được build vào image.

## 4. Promote và Rollback {#4-promote-or-roll-back}

Với plugin `kubectl argo rollouts` tương thích:

```bash
kubectl --context eks-workload argo rollouts get rollout shopnow-frontend-rollout -n shopnow
kubectl --context eks-workload argo rollouts promote shopnow-frontend-rollout -n shopnow
```

Có thể dùng action promote của ArgoCD nếu extension/controller hỗ trợ. Kiểm tra active selector và request thực tế sau promote.

Để Rollback và giữ cấu hình sau đó, đưa Image Tag/commit trong Git về phiên bản trước rồi Sync. Nếu chỉ chạy `argo rollouts undo`, ArgoCD Self-heal có thể Deploy lại tag đang khai báo trong Git. Blue-Green chuyển toàn bộ Active Service sang phiên bản mới; bài này không dùng Weighted Canary 10/90.

**Bằng chứng:** commit/tag trước và sau, preview hoạt động, active selector thay đổi sau promote và rollback thành công về phiên bản mong muốn.

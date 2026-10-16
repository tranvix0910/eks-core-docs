---
title: "Mở rộng — Phát hành frontend bằng blue-green"
---

# Kiểm thử phiên bản trước khi chuyển người dùng {#test-a-version-before-switching-users}

ArgoCD đồng bộ desired state từ Git. Argo Rollouts quản lý ReplicaSet active/preview và thời điểm promote. Cài controller và CRD Rollouts trước khi sync frontend.

## 1. Xem rollout hiện tại {#1-inspect-the-current-rollout}

```bash
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -o yaml
kubectl --context eks-workload -n shopnow get svc shopnow-frontend-service shopnow-frontend-preview-service -o yaml
```

`activeService` phục vụ người dùng; `previewService` trỏ tới phiên bản đang thử. `autoPromotionEnabled=false` tạo điểm chờ phê duyệt thủ công. `scaleDownDelaySeconds=30` giữ phiên bản trước trong thời gian ngắn sau promote, không bảo đảm rollback tức thì vô thời hạn.

## 2. Đưa phiên bản mới qua ArgoCD {#2-deliver-a-new-version-through-argocd}

Dùng tag mới, build/push frontend, cập nhật Application/values ArgoCD đọc rồi sync. Không dùng lại cùng tag với `IfNotPresent` để minh họa bản phát hành mới.

```bash
argocd app get shopnow-frontend
kubectl --context eks-workload -n shopnow get rollout shopnow-frontend-rollout -w
```

## 3. Kiểm chứng preview {#3-verify-preview}

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-frontend-preview-service 8083:80
```

Mở `http://localhost:8083`, kiểm tra UI/API URL, danh sách sản phẩm, đăng nhập và giỏ hàng bằng dữ liệu giả lập. Port-forward preview không thay API URL đã được build vào image.

## 4. Promote hoặc rollback {#4-promote-or-roll-back}

Với plugin `kubectl argo rollouts` tương thích:

```bash
kubectl --context eks-workload argo rollouts get rollout shopnow-frontend-rollout -n shopnow
kubectl --context eks-workload argo rollouts promote shopnow-frontend-rollout -n shopnow
```

Có thể dùng action promote của ArgoCD nếu extension/controller hỗ trợ. Kiểm tra active selector và request thực tế sau promote.

Để rollback bền vững, hoàn tác image tag/commit trong Git rồi sync. `argo rollouts undo` là thao tác ứng phó sự cố; self-heal có thể khôi phục image mong muốn nếu Git không đổi. Blue-green chuyển phiên bản active, không chia traffic canary theo trọng số 10/90.

**Bằng chứng:** commit/tag trước và sau, preview hoạt động, active selector thay đổi sau promote và rollback thành công về phiên bản mong muốn.

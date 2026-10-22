---
title: "Triển khai và rollback ứng dụng"
---

# Deploy và cập nhật ứng dụng {#choose-the-appropriate-release-strategy}

Ứng dụng được triển khai bằng ArgoCD. Backend sử dụng Deployment RollingUpdate, còn frontend dùng Argo Rollouts với chiến lược blue-green. Các bài bên dưới hướng dẫn từ build image đến kiểm tra phiên bản mới và rollback.

| Công việc | Hướng dẫn |
|---|---|
| build/push image tag mới | [build và CI](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md) |
| Tạo Application cho từng service | [Triển khai microservices](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md) |
| Kiểm thử preview và promote frontend | [Blue-green](04-apps-shopnow/03-blue-green-argo-rollouts.md) |
| Khôi phục cấu hình cũ và xem drift | [Vận hành](06-operations/05-lifecycle-and-cleanup.md) |

Để rollback, Revert commit cấu hình trong Git rồi ArgoCD sync. Nếu rollback nhanh bằng UI/CLI khi xử lý sự cố, cập nhật Git sau đó để self-heal giữ đúng phiên bản cần chạy.

Dùng image tag riêng cho mỗi bản build. Lưu commit, image digest và thời điểm promote/rollback trong kết quả bài test.

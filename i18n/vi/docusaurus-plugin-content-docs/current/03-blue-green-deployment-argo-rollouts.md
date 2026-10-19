---
title: "Application Deployment và Rollback"
---

# Deploy và cập nhật ShopNow {#choose-the-appropriate-release-strategy}

Workshop Deploy Microservices qua ArgoCD, sử dụng EFS, Topology Spread và PDB. Backend dùng Deployment RollingUpdate; Frontend dùng Argo Rollout Blue-Green. Bài mở rộng hướng dẫn test Preview và Promote phiên bản mới.

| Công việc | Hướng dẫn |
|---|---|
| Build/push image tag mới | [Build và CI](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md) |
| Tạo Application cho từng service | [Triển khai ShopNow](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md) |
| Kiểm thử preview và promote frontend | [Blue-green](04-apps-shopnow/03-blue-green-argo-rollouts.md) |
| Khôi phục cấu hình cũ và xem drift | [Vận hành](06-operations/05-lifecycle-and-cleanup.md) |

Để Rollback, Revert commit cấu hình trong Git rồi ArgoCD Sync. Nếu Rollback nhanh bằng UI/CLI khi xử lý sự cố, cập nhật Git sau đó để Self-heal giữ đúng phiên bản cần chạy.

Dùng Image Tag riêng cho mỗi bản Build. Lưu commit, Image Digest và thời điểm Promote/Rollback trong kết quả bài test.

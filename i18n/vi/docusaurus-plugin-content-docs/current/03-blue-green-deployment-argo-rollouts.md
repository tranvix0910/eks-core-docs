---
title: "Phát hành và rollback ứng dụng"
---

# Chọn chiến lược phát hành phù hợp {#choose-the-appropriate-release-strategy}

Bài cốt lõi triển khai microservices qua ArgoCD, mount EFS, phân bổ replica và áp dụng PDB. Backend hiện dùng Deployment RollingUpdate. Frontend đã có chiến lược Argo Rollout blue-green và được trình bày trong bài mở rộng.

| Công việc | Hướng dẫn |
|---|---|
| Build/push image tag mới | [Build và CI](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md) |
| Tạo Application cho từng service | [Triển khai ShopNow](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md) |
| Kiểm thử preview và promote frontend | [Blue-green](04-apps-shopnow/03-blue-green-argo-rollouts.md) |
| Khôi phục cấu hình cũ và xem drift | [Vận hành](06-operations/05-lifecycle-and-cleanup.md) |

Hoàn tác commit cấu hình nguồn rồi sync để rollback bền vững. Rollback qua UI/CLI lúc chạy là bước ứng phó sự cố; cập nhật Git sau đó để self-heal không triển khai lại bản lỗi.

Không dùng cùng image tag cho hai bản build khác nhau trong bài phát hành. Ghi commit, image digest và thời điểm promote/rollback làm bằng chứng.

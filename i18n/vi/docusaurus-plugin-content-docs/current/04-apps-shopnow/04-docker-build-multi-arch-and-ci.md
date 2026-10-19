---
title: "Bước 3.1 — Build Image ShopNow và Push ECR"
sidebar_label: "3.1 Build Image"
---

# Bước 3.1 — Build Image ShopNow và Push ECR {#step-31--build-the-shopnow-images-and-push-them-to-ecr}

:::info Nội dung thực hiện
**Mục tiêu:** Build 7 image ShopNow và Push lên ECR với tag `$IMAGE_TAG`.
**Thời gian:** khoảng 20 phút (build Maven và npm). **Chạy từ:** `$APPS_DIR` (`eks-core-apps`).
:::

## ShopNow Images {#what-gets-built}

| Image (`shopnow/…`) | Thư mục mã nguồn | Công nghệ |
|---|---|---|
| `shopnow-frontend` | `shopnow-frontend` | React, phục vụ bằng Nginx |
| `shopnow-api-gateway` | `shopnow-backend/api-gateway` | Spring Cloud Gateway |
| `shopnow-config-server` | `shopnow-config-server` | Spring Cloud Config |
| `shopnow-discovery-server` | `shopnow-discovery-server` | Eureka |
| `shopnow-product-service` | `shopnow-product-service` | Spring Boot + PostgreSQL |
| `shopnow-shopping-cart-service` | `shopnow-shopping-cart-service` | Spring Boot + PostgreSQL |
| `shopnow-user-service` | `shopnow-user-service` | Spring Boot + Keycloak |

## 1. Setup Build Environment {#1-set-the-build-variables}

```bash
export IMAGE_TAG=workshop-v1
export REACT_APP_BASE_API_URL=http://localhost:5860   # API URL the browser will call
export WORKSHOP_PLATFORMS=linux/amd64                 # pool 2 runs amd64 nodes
```

`REACT_APP_BASE_API_URL` được gắn vào Frontend lúc Build. Dùng `http://localhost:5860` cho Port-forward tại [bước 3.2](shopnow-end-to-end-deployment-guide). Nếu chuyển sang ALB hoặc domain riêng, Build lại Frontend với API URL mới.

Mixed Pool dùng `amd64`. Khi Build trên Mac Apple Silicon, chỉ định `linux/amd64` để tránh tạo image chỉ có ARM64.

## 2. Build và Push {#2-build-and-push}

```bash
cd "$APPS_DIR"
bash scripts/build-images.sh
```

Script đăng nhập ECR rồi chạy `docker buildx build --push` cho từng image với tag `$IMAGE_TAG`.

## Kiểm tra kết quả {#verify}

```bash
for repo in frontend api-gateway config-server discovery-server product-service shopping-cart-service user-service; do
  aws ecr describe-images --repository-name "shopnow/shopnow-$repo" --image-ids imageTag="$IMAGE_TAG" \
    --query 'imageDetails[0].[repositoryName,imageTags[0],imagePushedAt]' --output text
done | tee "$EVIDENCE_DIR/images.txt"

docker buildx imagetools inspect \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow/shopnow-product-service:$IMAGE_TAG"
```

**Kết quả cần có:** bảy dòng, mỗi repository một dòng; manifest hiển thị `linux/amd64`.

| Triệu chứng | Xử lý |
|---|---|
| `no basic auth credentials` | Đăng nhập ECR hết hạn — chạy lại script |
| `RepositoryNotFoundException` | ECR repository do Layer 20 tạo; kiểm tra `ecr_repository_names` trong tfvars và apply |
| Pod sau đó lỗi `exec format error` | Image sai architecture; build lại bằng `WORKSHOP_PLATFORMS=linux/amd64` |

## Build phiên bản mới {#releasing-a-new-version-later}

Mỗi phiên bản dùng tag riêng, ví dụ `export IMAGE_TAG=workshop-v2`. Build và Push, sau đó render và Apply lại Application ([bước 3.2](shopnow-end-to-end-deployment-guide), phần 2). Giữ tag cố định cho một bản build để ArgoCD và Kubernetes nhận biết phiên bản mới.

**Tiếp theo:** [3.2 Triển khai bằng ArgoCD](shopnow-end-to-end-deployment-guide)

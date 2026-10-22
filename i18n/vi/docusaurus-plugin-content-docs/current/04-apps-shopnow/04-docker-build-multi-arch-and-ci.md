---
title: "Bước 3.1 — Build image và push lên ECR"
sidebar_label: "3.1 Build image"
---

# Bước 3.1 — Build image và push lên ECR {#step-31--build-the-shopnow-images-and-push-them-to-ecr}

Trước khi triển khai ứng dụng, chúng ta cần build image cho frontend và sáu backend service, sau đó push lên ECR. Các image trong lần triển khai này sử dụng cùng một tag để dễ theo dõi.

**Thời gian:** khoảng 20 phút (build Maven và npm). **Chạy từ:** `$APPS_DIR` (`eks-core-apps`).

## Các image cần build {#what-gets-built}

| image (`shopnow/…`) | Thư mục mã nguồn | Công nghệ |
|---|---|---|
| `shopnow-frontend` | `shopnow-frontend` | React, phục vụ bằng Nginx |
| `shopnow-api-gateway` | `shopnow-backend/api-gateway` | Spring Cloud Gateway |
| `shopnow-config-server` | `shopnow-config-server` | Spring Cloud Config |
| `shopnow-discovery-server` | `shopnow-discovery-server` | Eureka |
| `shopnow-product-service` | `shopnow-product-service` | Spring Boot + PostgreSQL |
| `shopnow-shopping-cart-service` | `shopnow-shopping-cart-service` | Spring Boot + PostgreSQL |
| `shopnow-user-service` | `shopnow-user-service` | Spring Boot + Keycloak |

## 1. Cấu hình build Environment {#1-set-the-build-variables}

```bash
export IMAGE_TAG=workshop-v1
export REACT_APP_BASE_API_URL=http://localhost:5860   # API URL the browser will call
export WORKSHOP_PLATFORMS=linux/amd64                 # pool 2 runs amd64 nodes
```

`REACT_APP_BASE_API_URL` được gắn vào frontend lúc build. Dùng `http://localhost:5860` cho port-forward tại [bước 3.2](shopnow-end-to-end-deployment-guide). Nếu chuyển sang ALB hoặc domain riêng, build lại frontend với API URL mới.

Các node của mixed pool dùng `amd64`. Nếu build trên Mac Apple Silicon, chỉ định `linux/amd64` để image chạy được trên nhóm node này. Bài ARM64 sẽ dùng image có architecture phù hợp riêng.

## 2. Build và push {#2-build-and-push}

```bash
cd "$APPS_DIR"
bash scripts/build-images.sh
```

Script đăng nhập ECR rồi chạy `docker buildx build --push` cho từng image với tag `$IMAGE_TAG`.

## Kiểm tra {#verify}

```bash
for repo in frontend api-gateway config-server discovery-server product-service shopping-cart-service user-service; do
  aws ecr describe-images --repository-name "shopnow/shopnow-$repo" --image-ids imageTag="$IMAGE_TAG" \
    --query 'imageDetails[0].[repositoryName,imageTags[0],imagePushedAt]' --output text
done | tee "$EVIDENCE_DIR/images.txt"

docker buildx imagetools inspect \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow/shopnow-product-service:$IMAGE_TAG"
```

**Kết quả:** bảy dòng, mỗi repository một dòng; manifest hiển thị `linux/amd64`.

| Triệu chứng | Xử lý |
|---|---|
| `no basic auth credentials` | Đăng nhập ECR hết hạn — chạy lại script |
| `RepositoryNotFoundException` | ECR repository do layer 20 tạo; kiểm tra `ecr_repository_names` trong tfvars và apply |
| Pod sau đó lỗi `exec format error` | image sai architecture; build lại bằng `WORKSHOP_PLATFORMS=linux/amd64` |

## Build phiên bản mới {#releasing-a-new-version-later}

Mỗi lần cập nhật ứng dụng, dùng tag mới, ví dụ `export IMAGE_TAG=workshop-v2`. Build và push image, sau đó render và apply lại Application ở [bước 3.2](shopnow-end-to-end-deployment-guide), phần 2. Một tag chỉ nên trỏ tới một bản build để dễ theo dõi và rollback.

**Tiếp theo:** [3.2 Triển khai bằng ArgoCD](shopnow-end-to-end-deployment-guide)

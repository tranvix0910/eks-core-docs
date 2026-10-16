---
title: "Bước 3.1 — Build image ShopNow và push lên ECR"
sidebar_label: "3.1 Build image"
---

# Bước 3.1 — Build image ShopNow và push lên ECR {#step-31--build-the-shopnow-images-and-push-them-to-ecr}

:::info Tóm tắt bước thực hành
**Mục tiêu:** bảy image trong ECR, tất cả có tag `$IMAGE_TAG`.
**Thời gian:** khoảng 20 phút (build Maven và npm). **Chạy từ:** `$APPS_DIR` (`eks-core-apps`).
:::

## Các image được build {#what-gets-built}

| Image (`shopnow/…`) | Thư mục mã nguồn | Công nghệ |
|---|---|---|
| `shopnow-frontend` | `shopnow-frontend` | React, phục vụ bằng Nginx |
| `shopnow-api-gateway` | `shopnow-backend/api-gateway` | Spring Cloud Gateway |
| `shopnow-config-server` | `shopnow-config-server` | Spring Cloud Config |
| `shopnow-discovery-server` | `shopnow-discovery-server` | Eureka |
| `shopnow-product-service` | `shopnow-product-service` | Spring Boot + PostgreSQL |
| `shopnow-shopping-cart-service` | `shopnow-shopping-cart-service` | Spring Boot + PostgreSQL |
| `shopnow-user-service` | `shopnow-user-service` | Spring Boot + Keycloak |

## 1. Đặt biến build {#1-set-the-build-variables}

```bash
export IMAGE_TAG=workshop-v1
export REACT_APP_BASE_API_URL=http://localhost:5860   # API URL the browser will call
export WORKSHOP_PLATFORMS=linux/amd64                 # pool 2 runs amd64 nodes
```

`REACT_APP_BASE_API_URL` được biên dịch vào JavaScript frontend lúc build. `http://localhost:5860` dùng được với port-forward ở [bước 3.2](shopnow-end-to-end-deployment-guide). Nếu sau này công khai API qua load balancer hoặc domain, build lại frontend với URL đó.

Trên Mac Apple Silicon, giữ `linux/amd64`: build không chỉ định platform tạo image ARM64, không chạy được trên pool 2.

## 2. Build và push {#2-build-and-push}

```bash
cd "$APPS_DIR"
bash scripts/build-images.sh
```

Script đăng nhập ECR rồi chạy `docker buildx build --push` cho từng image với tag `$IMAGE_TAG`.

## Kiểm chứng {#verify}

```bash
for repo in frontend api-gateway config-server discovery-server product-service shopping-cart-service user-service; do
  aws ecr describe-images --repository-name "shopnow/shopnow-$repo" --image-ids imageTag="$IMAGE_TAG" \
    --query 'imageDetails[0].[repositoryName,imageTags[0],imagePushedAt]' --output text
done | tee "$EVIDENCE_DIR/images.txt"

docker buildx imagetools inspect \
  "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/shopnow/shopnow-product-service:$IMAGE_TAG"
```

**Kết quả mong đợi:** bảy dòng, mỗi repository một dòng; manifest hiển thị `linux/amd64`.

| Triệu chứng | Xử lý |
|---|---|
| `no basic auth credentials` | Đăng nhập ECR hết hạn — chạy lại script |
| `RepositoryNotFoundException` | ECR repository do lớp 20 tạo; kiểm tra `ecr_repository_names` trong tfvars và apply |
| Pod sau đó lỗi `exec format error` | Image sai architecture; build lại bằng `WORKSHOP_PLATFORMS=linux/amd64` |

## Phát hành phiên bản mới về sau {#releasing-a-new-version-later}

Mỗi bản phát hành dùng tag mới, ví dụ `export IMAGE_TAG=workshop-v2`, build lại, rồi render và apply Application lại ([bước 3.2](shopnow-end-to-end-deployment-guide), phần 2). Không dùng cùng tag cho mã khác nhau; ArgoCD và Kubernetes không phân biệt được các image đó.

**Tiếp theo:** [3.2 Triển khai bằng ArgoCD](shopnow-end-to-end-deployment-guide)

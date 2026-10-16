---
title: "Xác thực và phân quyền truy cập EKS"
---

# Xác định lớp từ chối truy cập {#identify-the-layer-rejecting-access}

AWS CLI credentials, xác thực EKS và Kubernetes RBAC là các lớp riêng. Thành công ở một lớp không tự cấp quyền cho lớp tiếp theo.

## 1. Kiểm tra tài khoản và kubeconfig {#1-check-account-and-kubeconfig}

```bash
aws sts get-caller-identity
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
aws eks update-kubeconfig --name eks-observability --region "$AWS_REGION" --alias eks-observability
kubectl config get-contexts
kubectl --context eks-workload auth can-i get pods -A
kubectl --context eks-workload auth can-i create applications.argoproj.io -n argocd
```

Kubeconfig dùng exec plugin gọi `aws eks get-token`; không lưu token cố định trong tệp dùng chung hoặc tài liệu. Nếu kubeconfig tạo bằng profile khác, xem `users[].user.exec` để tránh dùng nhầm identity.

## 2. Access entry {#2-access-entries}

```bash
aws eks list-access-entries --cluster-name eks-workload
aws eks list-access-entries --cluster-name eks-observability
```

Module hiện cấp quyền admin cho người tạo cluster. Người vận hành khác cần access entry/policy hoặc RBAC có phạm vi phù hợp; không chia sẻ credentials người tạo. Node IAM role của Karpenter cũng cần đúng loại entry để node join cluster.

## 3. Triệu chứng thường gặp {#3-common-symptoms}

| Lỗi | Lớp cần kiểm tra |
|---|---|
| AWS `ExpiredToken` | Phiên AWS/SSO |
| AWS `AccessDenied` khi describe cluster | IAM/SCP trước Kubernetes |
| Kubernetes `Unauthorized` | Identity, token, access entry |
| Kubernetes `Forbidden` | RBAC hoặc phạm vi access policy |
| Endpoint timeout | Network, endpoint public/private, CIDR được cho phép |

Để quản lý quyền bằng Terraform, khai báo principal/scope rồi plan/kiểm tra/apply bằng identity đã có quyền. Sửa `aws-auth` không phải cách xử lý chung cho cluster dùng access entry.

## 4. Chỉ định context cho mọi thao tác {#4-specify-context-for-every-operation}

Lệnh dùng `--context` với kubectl và `--kube-context` với Helm. Chỉ dựa vào `use-context` trước một chuỗi lệnh dài dễ gửi nhầm manifest receiver sang workload cluster. Ghi cluster/tài khoản và timestamp cùng bằng chứng.

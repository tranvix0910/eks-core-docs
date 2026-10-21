---
title: "AWS Identity và EKS Access Entry"
---

# Kiểm tra quyền truy cập EKS {#identify-the-layer-rejecting-access}

Để truy cập EKS, AWS CLI cần credentials hợp lệ, EKS cần nhận diện được IAM principal và người dùng cần quyền trên Kubernetes resource. Chúng ta sẽ kiểm tra lần lượt các phần này để phân biệt lỗi đăng nhập với lỗi phân quyền.

## 1. Kiểm tra tài khoản AWS và Kubeconfig {#1-check-account-and-kubeconfig}

```bash
aws sts get-caller-identity
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
aws eks update-kubeconfig --name eks-observability --region "$AWS_REGION" --alias eks-observability
kubectl config get-contexts
kubectl --context eks-workload auth can-i get pods -A
kubectl --context eks-workload auth can-i create applications.argoproj.io -n argocd
```

Kubeconfig dùng Exec Plugin để gọi `aws eks get-token`. Kiểm tra `users[].user.exec` đang dùng đúng AWS profile. Không lưu token cố định trong file chia sẻ hoặc docs.

## 2. Access entry {#2-access-entries}

```bash
aws eks list-access-entries --cluster-name eks-workload
aws eks list-access-entries --cluster-name eks-observability
```

Module đang cấp quyền admin cho identity tạo cluster. Người dùng khác cần access entry, access policy hoặc RBAC phù hợp. Không dùng chung credentials của người tạo. Node role của Karpenter cũng cần access entry đúng loại để node join cluster.

## 3. Troubleshooting {#3-common-symptoms}

| Lỗi | Lớp cần kiểm tra |
|---|---|
| AWS `ExpiredToken` | Phiên AWS/SSO |
| AWS `AccessDenied` khi describe cluster | IAM/SCP trước Kubernetes |
| Kubernetes `Unauthorized` | Identity, token, access entry |
| Kubernetes `Forbidden` | RBAC hoặc phạm vi access policy |
| endpoint timeout | Network, endpoint public/private, CIDR được cho phép |

Để quản lý quyền bằng Terraform, khai báo principal/scope rồi plan/kiểm tra/apply bằng identity đã có quyền. Sửa `aws-auth` không phải cách xử lý chung cho cluster dùng access entry.

## 4. Chọn đúng cluster context {#4-specify-context-for-every-operation}

Truyền `--context` cho kubectl và `--kube-context` cho Helm để chọn workload cluster hoặc Observability trong từng lệnh. Khi lưu kết quả, ghi Cluster, tài khoản AWS và timestamp để dễ đối chiếu.

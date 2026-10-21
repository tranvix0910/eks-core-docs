---
title: "EKS Pod Identity"
---

# Cấu hình AWS permission cho Pod {#associate-aws-permissions-with-the-correct-serviceaccount}

Pod Identity cho phép Pod gọi AWS API bằng quyền gắn với ServiceAccount. Terraform tạo IAM role, policy và association; Pod Identity Agent cung cấp credentials cho SDK trong Pod. Khi controller báo thiếu quyền, chúng ta sẽ kiểm tra các thành phần này trước.

## 1. ServiceAccount và IAM permission {#1-compare-mappings}

| Cluster | Namespace/ServiceAccount | Quyền cần có |
|---|---|---|
| Workload | `kube-system/karpenter` | Cấp EC2 và truy cập interruption queue qua module |
| Workload | `kube-system/aws-load-balancer-controller` | ELB/EC2 networking cần cho controller |
| Workload | `kube-system/ebs-csi-controller-sa` | Cấp EBS |
| Workload | `kube-system/efs-csi-controller-sa` | Cấp EFS Access Point |
| Observability | `kube-system/ebs-csi-controller-sa` | Cấp EBS |
| Observability | `kube-system/aws-load-balancer-controller` | tải balancing |
| Observability | `monitoring/mimir` | Truy cập đúng bucket Mimir |
| Observability | `monitoring/loki` | Truy cập đúng bucket Loki |

## 2. Kiểm tra Pod Identity Association {#2-verify-aws-and-kubernetes}

```bash
aws eks list-pod-identity-associations --cluster-name eks-workload
aws eks list-pod-identity-associations --cluster-name eks-observability
kubectl --context eks-workload -n kube-system get daemonset eks-pod-identity-agent
kubectl --context eks-observability -n monitoring get serviceaccount mimir loki
```

Lấy Association ID từ danh sách trên và kiểm tra Role, Namespace, ServiceAccount:

```bash
: "${WORKSHOP_ASSOCIATION_ID:?Set an association ID from the list above}"
aws eks describe-pod-identity-association --cluster-name eks-workload \
  --association-id "$WORKSHOP_ASSOCIATION_ID"
```

Với cluster 2, dùng tên cluster sở hữu association đó. Không sao chép ARN của tài khoản khác.

## 3. Troubleshooting AccessDenied {#3-diagnose-accessdenied}

1. Xác nhận `serviceAccountName` của Pod.
2. Kiểm tra cluster, namespace và ServiceAccount trong association.
3. Xác nhận agent Ready trên node đó, network hoạt động và SDK hỗ trợ credential chain.
4. Kiểm tra action/resource trong policy và region/tên bucket.
5. Khi identity đã đúng, xem explicit deny trong SCP/bucket policy.

Sau khi sửa association, tạo lại Pod khi cần và xem controller log để kiểm tra quyền đã được nhận. Không thêm access key vào Helm values để bỏ qua lỗi IAM, cũng không in credentials ra log.

Tham khảo: [AWS EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).

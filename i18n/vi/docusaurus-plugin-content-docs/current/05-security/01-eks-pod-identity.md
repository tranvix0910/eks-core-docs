---
title: "EKS Pod Identity"
---

# Cấu hình AWS Permission cho Pod {#associate-aws-permissions-with-the-correct-serviceaccount}

Terraform tạo IAM Role, Policy và Pod Identity Association cho ServiceAccount. Pod Identity Agent cung cấp credentials để SDK trong Pod gọi AWS API. Khi thiếu quyền, kiểm tra association của Pod trước khi sửa Node Role.

## 1. ServiceAccount và IAM Permission {#1-compare-mappings}

| Cluster | Namespace/ServiceAccount | Quyền cần có |
|---|---|---|
| Workload | `kube-system/karpenter` | Cấp EC2 và truy cập interruption queue qua module |
| Workload | `kube-system/aws-load-balancer-controller` | ELB/EC2 networking cần cho controller |
| Workload | `kube-system/ebs-csi-controller-sa` | Cấp EBS |
| Workload | `kube-system/efs-csi-controller-sa` | Cấp EFS Access Point |
| Observability | `kube-system/ebs-csi-controller-sa` | Cấp EBS |
| Observability | `kube-system/aws-load-balancer-controller` | Load balancing |
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
4. Kiểm tra kết quả action/resource trong policy và region/tên bucket.
5. Khi identity đã đúng, xem explicit deny trong SCP/bucket policy.

Sau khi sửa Association, kiểm tra Pod mới và Controller log. Giữ credentials qua Pod Identity; không thêm Access Key tĩnh vào Helm values hoặc in credentials ra log để debug.

Tham khảo: [AWS EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).

---
title: "Pod Identity — Cấp quyền gọi AWS API cho controller"
---

# Gắn quyền AWS với đúng ServiceAccount {#associate-aws-permissions-with-the-correct-serviceaccount}

Terraform tạo IAM role/policy và association. Pod Identity Agent cấp credentials cho SDK trong Pod. Không mặc định gắn policy vào node role để thay cho việc sửa association sai.

## 1. Đối chiếu ánh xạ {#1-compare-mappings}

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

## 2. Kiểm chứng AWS và Kubernetes {#2-verify-aws-and-kubernetes}

```bash
aws eks list-pod-identity-associations --cluster-name eks-workload
aws eks list-pod-identity-associations --cluster-name eks-observability
kubectl --context eks-workload -n kube-system get daemonset eks-pod-identity-agent
kubectl --context eks-observability -n monitoring get serviceaccount mimir loki
```

Chọn association ID từ danh sách, đặt biến bên dưới rồi xem role/namespace/ServiceAccount trong terminal cá nhân:

```bash
: "${WORKSHOP_ASSOCIATION_ID:?Set an association ID from the list above}"
aws eks describe-pod-identity-association --cluster-name eks-workload \
  --association-id "$WORKSHOP_ASSOCIATION_ID"
```

Với cluster 2, dùng tên cluster sở hữu association đó. Không sao chép ARN của tài khoản khác.

## 3. Chẩn đoán AccessDenied {#3-diagnose-accessdenied}

1. Xác nhận `serviceAccountName` của Pod.
2. Kiểm tra cluster, namespace và ServiceAccount trong association.
3. Xác nhận agent Ready trên node đó, network hoạt động và SDK hỗ trợ credential chain.
4. Kiểm chứng action/resource trong policy và region/tên bucket.
5. Khi identity đã đúng, xem explicit deny trong SCP/bucket policy.

Không thêm AWS key tĩnh vào Helm values để bỏ qua lỗi IAM. Sau khi sửa association, kiểm tra Pod mới và log thực tế; không in toàn bộ credentials môi trường để debug.

Tham khảo: [AWS EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).

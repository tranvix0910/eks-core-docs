---
title: "Karpenter: hạ tầng AWS và controller trong cluster"
---

# Kiểm chứng cả hai phần trước khi cấp node {#verify-both-halves-before-provisioning-nodes}

## Phần 1: Terraform tạo tài nguyên AWS {#half-1-terraform-creates-aws-resources}

`20-cluster-workload/karpenter.tf` dùng module Karpenter để tạo IAM node/controller, interruption queue, EventBridge và quyền EKS cho node role. Pod Identity association liên kết controller với ServiceAccount. Các tài nguyên này không phải tiến trình theo dõi Pod.

## Phần 2: Helm cài controller và CRD {#half-2-helm-installs-the-controller-and-crds}

`helm_releases.tf` cài release `karpenter` trong `kube-system`, đọc `platform/addons/karpenter/values.yaml` và ghi đè cấu hình cluster/queue từ output. Terraform quản lý release này.

```bash
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_queue_name
kubectl --context eks-workload get crd nodepools.karpenter.sh ec2nodeclasses.karpenter.k8s.aws
kubectl --context eks-workload -n kube-system get pods -l app.kubernetes.io/name=karpenter -o wide
kubectl --context eks-workload -n kube-system logs deployment/karpenter --tail=100
```

Controller chạy trên `role=infra`; ServiceAccount và namespace phải khớp association. Đặt controller vào pool mà nó có thể xóa tạo ra phụ thuộc không cần thiết.

## Khi Pod Pending {#when-a-pod-is-pending}

1. Scheduler ghi lý do không thể xếp Pod: tài nguyên, selector, taint, topology hoặc PVC.
2. Karpenter tìm NodePool đáp ứng đồng thời ràng buộc của Pod và pool.
3. Tạo NodeClaim, khởi chạy EC2 và đăng ký node với EKS.
4. CSI/CNI và DaemonSet khởi tạo; sau đó kube-scheduler có thể xếp Pod.

Không có NodeClaim: xem ràng buộc scheduling. Có EC2 nhưng node không join: xem IAM/access entry, bootstrap và network. Node Ready nhưng Pod chưa khả dụng: xem Pod/PVC thay vì tiếp tục sửa IAM controller.

## Điều kiện hoàn thành {#completion-gate}

Controller Available, có CRD, Pod Identity và node role đúng. Tiếp theo: [apply các nhóm node](02-ec2nodeclass-and-nodepools-configuration.md).

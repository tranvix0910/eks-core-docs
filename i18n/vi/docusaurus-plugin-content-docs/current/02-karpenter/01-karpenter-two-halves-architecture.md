---
title: "Các thành phần của Karpenter"
---

# Cấu trúc Karpenter {#verify-both-halves-before-provisioning-nodes}

## Phần 1 · AWS resources {#half-1-terraform-creates-aws-resources}

Karpenter cần cả resource trên AWS và controller trong Kubernetes. File `20-cluster-workload/karpenter.tf` tạo IAM role, SQS interruption queue, EventBridge rule và EKS access entry cho node role. Pod Identity association cấp quyền AWS cho ServiceAccount của controller.

## Phần 2 · controller và CRD {#half-2-helm-installs-the-controller-and-crds}

`helm_releases.tf` cài release `karpenter` trong `kube-system`, đọc `platform/addons/karpenter/values.yaml` và ghi đè cấu hình cluster/queue từ output. Terraform quản lý release này.

```bash
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_queue_name
kubectl --context eks-workload get crd nodepools.karpenter.sh ec2nodeclasses.karpenter.k8s.aws
kubectl --context eks-workload -n kube-system get pods -l app.kubernetes.io/name=karpenter -o wide
kubectl --context eks-workload -n kube-system logs deployment/karpenter --tail=100
```

Controller chạy trên Managed Node Group có label `role=infra`. Kiểm tra ServiceAccount và Namespace khớp Pod Identity Association. Giữ controller trên node `infra` để nó vẫn chạy khi các NodePool không còn node.

## Khi Pod Pending {#when-a-pod-is-pending}

1. Scheduler ghi lý do không thể xếp Pod: tài nguyên, selector, taint, topology hoặc PVC.
2. Karpenter tìm NodePool đáp ứng đồng thời ràng buộc của Pod và pool.
3. Tạo NodeClaim, khởi chạy EC2 và đăng ký node với EKS.
4. CSI/CNI và DaemonSet khởi tạo; sau đó kube-scheduler có thể xếp Pod.

Khi tìm lỗi, bắt đầu từ trạng thái hiện tại. Nếu chưa có NodeClaim, xem yêu cầu scheduling của Pod. Nếu EC2 đã tạo nhưng node chưa join EKS, kiểm tra IAM, access entry, bootstrap và network. Nếu node đã Ready, chuyển sang Pod Events và PVC để xem vì sao ứng dụng chưa chạy.

## Điều kiện hoàn thành {#completion-gate}

Controller `Available`, CRD đã cài, Pod Identity và node role khớp cấu hình. Tiếp theo: [apply các nhóm node](02-ec2nodeclass-and-nodepools-configuration.md).

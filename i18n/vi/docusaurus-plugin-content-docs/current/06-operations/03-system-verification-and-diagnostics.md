---
title: "Kiểm tra hệ thống"
---

# Kiểm tra hệ thống {#check-infrastructure-through-application-behavior}

Source `workshop.env`, sau đó chạy các nhóm lệnh bên dưới để xem trạng thái AWS, Kubernetes và ArgoCD. Các bài EFS, placement và PDB có bước test riêng; những lệnh xem trạng thái ở đây giúp bạn tìm thành phần cần kiểm tra tiếp.

## 1. Tài khoản AWS, Cluster và Node {#1-account-clusters-nodes}

```bash
aws sts get-caller-identity
aws eks describe-cluster --name eks-workload --query 'cluster.{Name:name,Status:status,Version:version}'
aws eks describe-cluster --name eks-observability --query 'cluster.{Name:name,Status:status,Version:version}'
kubectl --context eks-workload get nodes -o wide
kubectl --context eks-observability get nodes -o wide
kubectl --context eks-workload get nodes -L role,workload,capacity,karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch
```

## 2. Capacity và scheduling {#2-capacity-and-scheduling}

```bash
kubectl --context eks-workload get nodepools,nodeclaims,ec2nodeclasses
kubectl --context eks-workload -n shopnow get pods -o wide
kubectl --context eks-workload -n shopnow get events --sort-by=.metadata.creationTimestamp
kubectl --context eks-workload -n kube-system logs deployment/karpenter --since=10m
kubectl --context eks-workload top nodes
kubectl --context eks-workload top pods -n shopnow
```

`top` cần Metrics Server hoạt động tốt; Prometheus không cung cấp API đó. Với Pod Pending, dùng `describe pod` để phân biệt lỗi scheduling và volume binding.

## 3. GitOps và storage {#3-gitops-and-storage}

```bash
kubectl --context eks-workload -n argocd get applications
kubectl --context eks-workload -n shopnow get deployment,rollout,svc,pvc,pdb
kubectl --context eks-workload get pv,storageclass
argocd app get shopnow-product-service
argocd app diff shopnow-product-service
```

Đối chiếu cả trạng thái `Synced` và Git Revision của Application để xác nhận đang chạy đúng commit cần deploy.

## 4. Telemetry Sender và Receiver {#4-receivers-and-senders}

```bash
kubectl --context eks-observability -n monitoring get pods,pvc,svc,ingress
kubectl --context eks-workload -n monitoring get pods,daemonsets,prometheus
kubectl --context eks-workload -n monitoring logs -l app.kubernetes.io/instance=alloy --tail=20 --prefix
```

Dùng query ở bài [Mimir](../03-observability/02-mimir-metrics-pipeline.md) và [Loki](../03-observability/03-loki-logging-pipeline.md) để kiểm tra dữ liệu. Query qua port-forward cho biết receiver trả lời được. Muốn kiểm tra đường gửi từ cluster 1, cần tìm sample hoặc log vừa được tạo ở cluster đó.


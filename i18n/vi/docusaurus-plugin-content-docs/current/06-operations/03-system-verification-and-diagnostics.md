---
title: "System Verification"
---

# Kiểm tra hệ thống {#check-infrastructure-through-application-behavior}

Source `workshop.env` ở bước 0.1, sau đó chạy các nhóm lệnh dưới để kiểm tra hệ thống. Bài test Load và Eviction thực hiện riêng theo checklist workshop.

## 1. AWS Account, Cluster và Node {#1-account-clusters-nodes}

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

## 3. GitOps và Storage {#3-gitops-and-storage}

```bash
kubectl --context eks-workload -n argocd get applications
kubectl --context eks-workload -n shopnow get deployment,rollout,svc,pvc,pdb
kubectl --context eks-workload get pv,storageclass
argocd app get shopnow-product-service
argocd app diff shopnow-product-service
```

Đối chiếu cả trạng thái `Synced` và Git Revision của Application để xác nhận đang chạy đúng commit cần Deploy.

## 4. Telemetry Sender và Receiver {#4-receivers-and-senders}

```bash
kubectl --context eks-observability -n monitoring get pods,pvc,svc,ingress
kubectl --context eks-workload -n monitoring get pods,daemonsets,prometheus
kubectl --context eks-workload -n monitoring logs -l app.kubernetes.io/instance=alloy --tail=20 --prefix
```

Dùng query đầu cuối tại bài [Mimir](../03-observability/02-mimir-metrics-pipeline.md) và [Loki](../03-observability/03-loki-logging-pipeline.md). Query receiver thành công qua port-forward chứng minh quyền đọc; có dữ liệu mới từ cluster 1 còn chứng minh đường gửi.

## 5. Lưu kết quả kiểm tra {#5-save-evidence-without-secrets}

```bash
mkdir -p .workshop/evidence
kubectl --context eks-workload -n shopnow get pods -o json > $EVIDENCE_DIR/shopnow-pods.json
kubectl --context eks-workload get nodes -o json > $EVIDENCE_DIR/workload-nodes.json
kubectl --context eks-workload -n shopnow get pdb -o json > $EVIDENCE_DIR/pdb.json
kubectl --context eks-observability -n monitoring get pods -o json > $EVIDENCE_DIR/receiver-pods.json
date -u +%FT%TZ > $EVIDENCE_DIR/checked-at.txt
```

Kiểm tra output trước khi đưa vào báo cáo: Pod Spec và log có thể chứa biến môi trường hoặc dữ liệu ứng dụng. Không đính kèm Secret YAML, Terraform State hoặc AWS Credentials.

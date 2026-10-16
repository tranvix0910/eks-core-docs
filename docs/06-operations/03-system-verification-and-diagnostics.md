---
title: "Verify the system and collect evidence"
---

# Check infrastructure through application behavior

Run at the repository root after setting variables. These commands inspect state; they do not replace the load/eviction tests used for acceptance.

## 1. Account, clusters, nodes

```bash
aws sts get-caller-identity
aws eks describe-cluster --name eks-workload --query 'cluster.{Name:name,Status:status,Version:version}'
aws eks describe-cluster --name eks-observability --query 'cluster.{Name:name,Status:status,Version:version}'
kubectl --context eks-workload get nodes -o wide
kubectl --context eks-observability get nodes -o wide
kubectl --context eks-workload get nodes -L role,workload,capacity,karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch
```

## 2. Capacity and scheduling

```bash
kubectl --context eks-workload get nodepools,nodeclaims,ec2nodeclasses
kubectl --context eks-workload -n shopnow get pods -o wide
kubectl --context eks-workload -n shopnow get events --sort-by=.metadata.creationTimestamp
kubectl --context eks-workload -n kube-system logs deployment/karpenter --since=10m
kubectl --context eks-workload top nodes
kubectl --context eks-workload top pods -n shopnow
```

`top` requires a healthy Metrics Server; Prometheus does not serve that API. For Pending Pods, use `describe pod` to distinguish scheduling from volume-binding failures.

## 3. GitOps and storage

```bash
kubectl --context eks-workload -n argocd get applications
kubectl --context eks-workload -n shopnow get deployment,rollout,svc,pvc,pdb
kubectl --context eks-workload get pv,storageclass
argocd app get shopnow-product-service
argocd app diff shopnow-product-service
```

Check the actual revision in Application status, not just `Synced`. An old revision can also be synced to old desired state.

## 4. Receivers and senders

```bash
kubectl --context eks-observability -n monitoring get pods,pvc,svc,ingress
kubectl --context eks-workload -n monitoring get pods,daemonsets,prometheus
kubectl --context eks-workload -n monitoring logs -l app.kubernetes.io/instance=alloy --tail=20 --prefix
```

Use the end-to-end queries in the [Mimir](../03-observability/02-mimir-metrics-pipeline.md) and [Loki](../03-observability/03-loki-logging-pipeline.md) labs. A successful receiver query through port-forward proves read access; new cluster 1 data proves the shipping path too.

## 5. Save evidence without secrets

```bash
mkdir -p .workshop/evidence
kubectl --context eks-workload -n shopnow get pods -o json > .workshop/evidence/shopnow-pods.json
kubectl --context eks-workload get nodes -o json > .workshop/evidence/workload-nodes.json
kubectl --context eks-workload -n shopnow get pdb -o json > .workshop/evidence/pdb.json
kubectl --context eks-observability -n monitoring get pods -o json > .workshop/evidence/receiver-pods.json
date -u +%FT%TZ > .workshop/evidence/checked-at.txt
```

Review before sharing: Pod specs/logs can contain environment values or application data. Do not save `kubectl get secrets -A -o yaml`, full Terraform state, or cloud credentials in evidence.

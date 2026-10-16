# System Verification & Diagnostics Guide

Standard CLI commands to verify, inspect, and diagnose the complete health of EKS clusters, Karpenter Autoscaling, Observability Pipelines, and ShopNow applications.

---

## 1. Inspecting EKS Clusters & Nodes

```bash
# 1. Check all nodes in the workload cluster
kubectl --context eks-workload get nodes -o wide

# 2. Check infra node group (3x t3.large, role=infra)
kubectl --context eks-workload get nodes -l role=infra

# 3. Check monitoring nodes in the observability cluster
kubectl --context eks-observability get nodes -o wide
```

---

## 2. Verifying Karpenter & NodePools

```bash
# 1. Check Karpenter Controller Pods
kubectl --context eks-workload get pods -n kube-system -l app.kubernetes.io/name=karpenter

# 2. Inspect all 8 readiness conditions on EC2NodeClass
kubectl --context eks-workload get ec2nodeclass default \
  -o jsonpath='{range .status.conditions[*]}{.type}{"\t"}{.status}{"\n"}{end}'

# 3. List NodePools
kubectl --context eks-workload get nodepools

# 4. Stream real-time NodeClaim provisioning events
kubectl --context eks-workload get nodeclaims -w
```

---

## 3. Verifying the Observability Pipeline (Metrics & Logs)

### Check Metrics Ingested into Mimir:
```bash
kubectl --context eks-workload exec -n monitoring prometheus-prometheus-kube-prometheus-prometheus-0 -- \
  promtool query instant http://localhost:9090 'prometheus_remote_storage_samples_total'
```

### Check Logs Streamed into Loki:
```bash
# Check Grafana Alloy DaemonSet logs
kubectl --context eks-workload logs -n monitoring -l app.kubernetes.io/name=alloy --tail=50

# Check Loki receiving logs
kubectl --context eks-observability logs -n monitoring -l app.kubernetes.io/name=loki --tail=50
```

---

## 4. Verifying ShopNow Applications & Argo Rollouts

```bash
# 1. List all ShopNow pods
kubectl --context eks-workload get pods -n shopnow

# 2. Inspect the Frontend Blue-Green Rollout
kubectl --context eks-workload argo rollouts get rollout shopnow-frontend-rollout -n shopnow

# 3. Test API Gateway on port 5860
curl -s http://<ALB_DNS>:5860/product | jq .

# 4. Test Preview Service for Frontend
kubectl --context eks-workload port-forward -n shopnow svc/shopnow-frontend-preview-service 8085:80
```

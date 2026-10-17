---
title: "Step 1.3 — Create cluster 2 (observability) and finish cluster 1"
sidebar_label: "1.3 Cluster 2 · Observability"
---

# Step 1.3 — Create cluster 2 (observability) and finish cluster 1

:::info Step summary
**Goal:** EKS cluster `eks-observability` running Mimir, Loki and Grafana on S3; then the platform tools on cluster 1.
**Requirement:** 8 (centralized observability). **Time:** about 30 minutes. **Run from:** `$TF_DIR`.
:::

## What this layer creates

| Resource | Details |
|---|---|
| EKS `eks-observability` | Kubernetes 1.34 |
| Managed Node Group `monitoring` | 2 × `t3.medium` On-Demand |
| S3 buckets | `eks-observability-mimir-<account>` and `eks-observability-loki-<account>`, 30-day expiry |
| Pod Identity | S3 access for Mimir and Loki, EBS CSI, Load Balancer Controller |
| Internal ALB security group | Allows cluster 1 nodes on 9009 (Mimir) and 3100 (Loki) |
| Private hosted zone | `observability.internal` |
| Helm releases | LBC, Prometheus (cluster 2's own metrics), Mimir 6.1, Loki 7.3, Grafana 10.5 — all in namespace `monitoring` |

Mimir and Loki run one replica per component to fit two small nodes. S3 holds the long-term data; EBS volumes hold write-ahead logs and caches.

## 1. Apply the foundation

```bash
L=21-cluster-observability
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan \
  -target=module.eks \
  -target=module.s3 \
  -target=module.ebs_csi_pod_identity \
  -target=module.lb_controller_pod_identity \
  -target=module.s3_pod_identity \
  -out="$PLAN_DIR/$L-foundation.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-foundation.tfplan"

aws eks update-kubeconfig --name eks-observability --region "$AWS_REGION" --alias eks-observability
kubectl --context eks-observability get nodes -L role
```

## 2. Namespace, storage class and load balancer controller

Grafana mounts a dashboard ConfigMap, so the namespace has to exist before the full apply. Let Terraform create it (it owns the namespace):

```bash
terraform -chdir="$TF_DIR/$L" plan \
  -target=kubernetes_namespace_v1.monitoring \
  -target=kubernetes_storage_class_v1.gp3 \
  -target=helm_release.aws_load_balancer_controller \
  -out="$PLAN_DIR/$L-prereqs.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-prereqs.tfplan"
```

## 3. Load the Grafana dashboard

```bash
kubectl --context eks-observability -n monitoring create configmap enterprise-workload-dashboard \
  --from-file=enterprise-workload-360.json="$GITOPS_DIR/platform/observability/grafana/dashboards/enterprise-workload-360.json" \
  --dry-run=client -o yaml | kubectl --context eks-observability apply -f -
```

## 4. Full apply of cluster 2

Leave `internal_observability_alb_name = null` for now; the internal ALB is created in [step 4.1](../platform-addons/cert-manager-and-internal-tls).

```bash
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
```

Terraform reads the Mimir and Loki values from `$GITOPS_DIR/platform/observability/` and fills in your account ID for the bucket names.

## 5. Verify cluster 2

```bash
kubectl --context eks-observability -n monitoring get pods,pvc
helm --kube-context eks-observability list -n monitoring
terraform -chdir="$TF_DIR/$L" output mimir_bucket_name
```

**Expected:** all Pods `Running`/`Ready`, every PVC `Bound`, and four releases `deployed` in `monitoring` (prometheus, mimir, loki, grafana). The load balancer controller is in `kube-system`.

| Symptom | Check |
|---|---|
| Mimir/Loki `CrashLoopBackOff` with `AccessDenied` | Pod Identity association for the `mimir`/`loki` ServiceAccount; bucket name in values |
| PVC `Pending` | `kubectl get sc gp3`; EBS CSI Pods in `kube-system` |
| Pods `Pending` with `Insufficient cpu` | Requests vs two `t3.medium` nodes; raise `eks_nodegroup_desired_size` |

## 6. Finish cluster 1

Cluster 2's state now exists, so layer 20 can be applied in full. This installs the platform tools on the `infra` nodes:

```bash
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
```

This adds:

| Release / resource | Namespace |
|---|---|
| AWS Load Balancer Controller 3.4 | `kube-system` |
| Karpenter 1.14 (controller and CRDs) | `kube-system` |
| ArgoCD (chart 10.3) | `argocd` |
| kube-prometheus-stack 88.6 | `monitoring` |
| Metrics Server | `kube-system` |
| StorageClasses `gp3` and `efs-sc` | cluster-wide |
| Grafana (local helper on cluster 1) | `monitoring` |

Prometheus waits for the TLS secret created in [step 4.1](../platform-addons/cert-manager-and-internal-tls) before it can ship metrics; it may show errors until then. That is expected.

## Verify cluster 1 platform

```bash
helm --kube-context eks-workload list -A
kubectl --context eks-workload get storageclass gp3 efs-sc
kubectl --context eks-workload get crd nodepools.karpenter.sh ec2nodeclasses.karpenter.k8s.aws
```

**Expected:** the releases above `deployed`, both StorageClasses present, both Karpenter CRDs present.

**Next:** [2.1 Platform add-ons](../platform-addons/gitops-bootstrap-order)

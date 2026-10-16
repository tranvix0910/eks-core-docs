---
title: "Step 5.2 — Day-2 operations and cleanup"
sidebar_label: "5.2 Day-2 and cleanup"
---

# Step 5.2 — Day-2 operations and cleanup

:::info Step summary
**Goal:** change the platform safely through the right owner, roll back, pause, and finally remove everything in the right order.
:::

## Which tool changes what

| You want to change… | Edit | Then |
|---|---|---|
| Network, EKS version, node group size, IAM, EFS, ECR, S3 | `eks-core-terraform/<layer>/*.tf` or `terraform.tfvars` | plan → review → apply that layer |
| A platform chart (Karpenter, ArgoCD, Prometheus, Mimir, Loki, Grafana) | its values file in `eks-core-gitops/platform/…` | plan → apply the layer that installs it (20 or 21) |
| Node pools | `eks-core-gitops/platform/nodepools/*.yaml` | `kubectl apply` |
| A ShopNow service (replicas, resources, PDB, spread) | chart or values in `eks-core-gitops/apps/…` | commit + push → ArgoCD syncs |
| A ShopNow image | code in `eks-core-apps` | new `IMAGE_TAG` → build → render → apply the Application |

## Example 1 — resize the infra node group (Terraform)

```bash
# eks-core-terraform/20-cluster-workload/terraform.tfvars
#   eks_nodegroup_desired_size = 4
#   eks_nodegroup_max_size     = 5
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" plan -out="$PLAN_DIR/$L.tfplan"
terraform -chdir="$TF_DIR/$L" show "$PLAN_DIR/$L.tfplan" | grep -E '^\s+[~+-] |Plan:'
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L.tfplan"
kubectl --context eks-workload get nodes -l role=infra
```

The plan must show an **update in-place** of the node group, not a replacement.

## Example 2 — scale a service (GitOps)

```bash
cd "$GITOPS_DIR"
# apps/shopnow-backend-config/shopnow-product-service-config/overlays/production/values.yaml → replicaCount: 3
git commit -am "product-service: 3 replicas" && git push
argocd app sync shopnow-product-service && argocd app wait shopnow-product-service --health
kubectl --context eks-workload -n shopnow get pods -l app=shopnow-product-service -o wide
```

`workload-values.yaml` is applied last, so a value set there wins over the service overlay. Never `kubectl scale` an ArgoCD-managed Deployment — self-heal puts it back.

## Example 3 — release a new image

```bash
export IMAGE_TAG=workshop-v2
(cd "$APPS_DIR" && bash scripts/build-images.sh)
(cd "$GITOPS_DIR" && bash examples/workshop/prepare-applications.sh)
kubectl --context eks-workload apply -f "$GITOPS_DIR/.workshop/applications/shopnow-product-service.yaml"
argocd app wait shopnow-product-service --health
```

Backends roll one Pod at a time (`maxUnavailable` from the chart), so the PDB and spread rules hold during the rollout.

## Roll back

| What | How |
|---|---|
| GitOps change | `git revert <commit>` and push; auto-sync applies the previous state |
| Image | apply the Application rendered with the previous `IMAGE_TAG` |
| Terraform change | revert the `.tf`/tfvars change, plan, review, apply |
| Node pool | `kubectl apply` the previous manifest from Git |

## Pause to save cost

Scaling Pods to zero does not stop the bill: control planes, infra and monitoring nodes, NAT, EFS and load balancers keep running. For a real pause, destroy and recreate — the whole platform is code. Before destroying, back up anything you want to keep (database dumps, EFS files).

## Clean up — remove everything

Delete in this order. Each step removes what depends on the next.

### 1. Applications and test workloads (cluster 1)

```bash
for app in workshop-proof shopnow-frontend shopnow-api-gateway shopnow-user-service shopnow-cart-service \
           shopnow-product-service shopnow-config-server shopnow-discovery-server shopnow-database-services; do
  argocd app delete "$app" --cascade --yes
done
for f in spot-proof arm64-proof ratio-proof; do
  kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/$f.yaml" --ignore-not-found
done
helm --kube-context eks-workload uninstall alloy -n monitoring
kubectl --context eks-workload delete nodepools --all     # Karpenter terminates its nodes
kubectl --context eks-workload get nodeclaims -w          # wait until empty
```

### 2. Load balancers created by Kubernetes (cluster 2)

```bash
kubectl --context eks-observability delete -f "$GITOPS_DIR/.workshop/internal-ingress.yaml"
```

Wait until the internal ALB disappears from the EC2 console; Terraform cannot delete a VPC that still has load balancers.

### 3. Break the link between layers 20 and 21

Layer 21 holds DNS records for the ALB, and layer 20 reads layer 21's state. Before destroying:

1. Set `internal_observability_alb_name = null` in layer 21's tfvars and apply layer 21 (removes the aliases).
2. In layer 20, remove the `cluster_observability` remote-state data source and set the observability node security group to `null`; plan and apply layer 20.

### 4. Destroy, layer by layer

```bash
for L in 21-cluster-observability 20-cluster-workload 10-network; do
  terraform -chdir="$TF_DIR/$L" plan -destroy -out="$PLAN_DIR/destroy-$L.tfplan"
  terraform -chdir="$TF_DIR/$L" show "$PLAN_DIR/destroy-$L.tfplan" | tail -3
  read -r -p "Apply destroy of $L? (yes/no) " ok && [ "$ok" = yes ] || break
  terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/destroy-$L.tfplan"
done
```

If a destroy stops on non-empty Mimir/Loki buckets, decide whether to keep the data, empty the buckets, and plan again.

### 5. Check for leftovers

```bash
aws eks list-clusters
aws ec2 describe-instances --filters Name=tag:karpenter.sh/discovery,Values=eks-workload \
  --query 'Reservations[].Instances[].InstanceId'
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerName'
aws acm list-certificates --query 'CertificateSummaryList[].DomainName'
```

Delete the imported ACM certificate by hand (it is not managed by Terraform). The state bucket stays; remove it only when you no longer need the history.

---
title: "Step 3 - Create the centralized observability cluster"
---

# Create the metrics and logs receiver environment

**Input:** network and Layer 20 foundation state exist. **Output:** `eks-observability`, the `monitoring` node group, S3, and Mimir/Loki/Grafana receiver services.

## 1. Check account-specific values

Confirm region, account, node sizes, desired/min/max capacity, `s3_expiration_days`, and `route53_private_zone_name` in tfvars. Two monitoring nodes provide baseline capacity; they do not make single-replica workloads highly available. For Pending/OOM conditions, inspect the stack's total requests before resizing nodes.

Match bucket names in `platform/observability/mimir/values.yaml` and `loki/values.yaml` to the expressions in `locals.tf`: `eks-observability-mimir-<account>` and `eks-observability-loki-<account>`. Update S3 region/endpoint when changing environments.

## 2. Create the AWS foundation

```bash
terraform -chdir=21-cluster-observability init
terraform -chdir=21-cluster-observability validate
terraform -chdir=21-cluster-observability plan \
  -target=module.eks \
  -target=module.s3 \
  -target=module.ebs_csi_pod_identity \
  -target=module.lb_controller_pod_identity \
  -target=module.s3_pod_identity \
  -out="$REPO_ROOT/.workshop/plans/observability-foundation.tfplan"
terraform -chdir=21-cluster-observability show "$REPO_ROOT/.workshop/plans/observability-foundation.tfplan"
terraform -chdir=21-cluster-observability apply "$REPO_ROOT/.workshop/plans/observability-foundation.tfplan"
aws eks update-kubeconfig --name eks-observability --region "$AWS_REGION" --alias eks-observability
kubectl --context eks-observability get nodes -L role,topology.kubernetes.io/zone
```

Targeting is only for fresh bootstrap with this repository structure. Foundation state now exports `node_security_group_id`; return to the previous lab to complete Layer 20.

## 3. Prepare namespace, storage, and dashboard dependencies

Grafana values reference the `enterprise-workload-dashboard` ConfigMap. Create it before full Helm apply waits for Grafana readiness. Terraform retains ownership of the namespace and StorageClass:

```bash
terraform -chdir=21-cluster-observability plan \
  -target=kubernetes_namespace_v1.monitoring \
  -target=kubernetes_storage_class_v1.gp3 \
  -target=helm_release.aws_load_balancer_controller \
  -out="$REPO_ROOT/.workshop/plans/observability-prereqs.tfplan"
terraform -chdir=21-cluster-observability apply "$REPO_ROOT/.workshop/plans/observability-prereqs.tfplan"
kubectl --context eks-observability -n monitoring create configmap enterprise-workload-dashboard \
  --from-file=enterprise-workload-360.json=platform/observability/grafana/dashboards/enterprise-workload-360.json \
  --dry-run=client -o yaml | kubectl --context eks-observability apply -f -
```

Review the plan before applying, as in earlier steps. Do not create the namespace manually and leave Terraform attempting to create the same resource under another owner.

## 4. Full apply and stack verification

Leave `internal_observability_alb_name=null` on the first pass. The ACM resource is currently commented out; certificates are prepared in the TLS lab.

```bash
terraform -chdir=21-cluster-observability plan -out="$REPO_ROOT/.workshop/plans/observability.tfplan"
terraform -chdir=21-cluster-observability show "$REPO_ROOT/.workshop/plans/observability.tfplan"
terraform -chdir=21-cluster-observability apply "$REPO_ROOT/.workshop/plans/observability.tfplan"
kubectl --context eks-observability -n monitoring get pods,pvc,svc -o wide
helm --kube-context eks-observability list -n monitoring
```

Mimir distributed uses one replica per component, Loki uses SingleBinary, and Grafana has its own PVC. S3 stores long-term blocks/chunks; EBS is still needed for WALs/caches and local data. An S3 lifecycle policy does not imply every new write has already reached S3.

## 5. Complete the connection between clusters

Continue with [TLS/internal ingress](../01-platform-addons/03-cert-manager-and-internal-tls.md), then set `internal_observability_alb_name` to the actual ALB name and fully apply Layer 21 to create DNS aliases. Do not configure aliases for an ALB that does not exist yet.

Verify both SG hops: workload node → ALB on 9009/3100; ALB → gateway Pod on **8080**, rather than the Service's port 80. Ingress SG names must match outputs. Workload NodePools must use the SG allowed by Terraform.

**Completion gate:** monitoring nodes Ready, receiver Pods Ready, PVCs Bound, correct S3/IAM configuration, followed by metrics/logs crossing private endpoints after the TLS lab. A Helm `deployed` status is not an end-to-end data-flow check.

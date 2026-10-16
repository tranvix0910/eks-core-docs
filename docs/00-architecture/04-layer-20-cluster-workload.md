---
title: "Step 1.2 — Create cluster 1 (workload)"
sidebar_label: "1.2 Cluster 1 · Workload"
---

# Step 1.2 — Create cluster 1 (workload)

:::info Step summary
**Goal:** EKS cluster `eks-workload` with the `infra` Managed Node Group, Karpenter's AWS resources, EFS and ECR.
**Requirements:** 1 (Managed Node Group), 4 (EFS). **Time:** about 20 minutes. **Run from:** `$TF_DIR/20-cluster-workload`.
:::

## What this layer creates

| Resource | Details |
|---|---|
| EKS `eks-workload` | Kubernetes 1.34, public endpoint, control-plane logs to CloudWatch (7 days) |
| Managed Node Group `infra` | 3 × `t3.large` On-Demand, AL2023, label `role=infra` — runs the platform tools |
| EKS add-ons | VPC CNI, CoreDNS, kube-proxy, EBS CSI, EFS CSI, Pod Identity Agent |
| Karpenter AWS side | Node IAM role, controller IAM (Pod Identity), SQS interruption queue, EventBridge rules |
| EFS | File system with a mount target in each workload subnet; NFS (2049) allowed from the nodes |
| ECR | Seven repositories `shopnow/*` for the ShopNow images |
| Pod Identity associations | EBS CSI, EFS CSI, Load Balancer Controller, Karpenter |

The same layer also installs Helm releases (LBC, Karpenter, ArgoCD, Prometheus, Metrics Server) and the StorageClasses `gp3` and `efs-sc`. Those need a running cluster, so they are applied later in [step 1.3](05-layer-21-cluster-observability.md#6-finish-cluster-1).

## 1. Review the inputs

```bash
grep -E 'kubernetes_version|nodegroup_|efs_create|ecr_repository' -A0 "$TF_DIR/20-cluster-workload/terraform.tfvars"
```

The defaults already match the workshop: `efs_create = true` and the seven ECR repositories. Keep `eks_nodegroup_min_size` at 2 or more so the platform tools survive one infra node going away.

## 2. Apply the foundation (first time only)

On an empty account cluster 2 does not exist yet, and the Helm releases cannot reach a cluster that is still being created. Apply only the AWS foundation now:

```bash
L=20-cluster-workload
terraform -chdir="$TF_DIR/$L" init -backend-config=backend.hcl
terraform -chdir="$TF_DIR/$L" validate
terraform -chdir="$TF_DIR/$L" plan \
  -target=module.eks \
  -target=module.karpenter \
  -target=module.ebs_csi_pod_identity \
  -target=module.efs_csi_pod_identity \
  -target=module.lb_controller_pod_identity \
  -target=module.efs \
  -target=module.ecr \
  -out="$PLAN_DIR/$L-foundation.tfplan"
terraform -chdir="$TF_DIR/$L" apply "$PLAN_DIR/$L-foundation.tfplan"
```

Terraform prints a warning about `-target`; that is expected for this one pass. Cluster creation takes about 15 minutes.

## 3. Connect kubectl

```bash
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
kubectl --context eks-workload get nodes -L role,node.kubernetes.io/instance-type,topology.kubernetes.io/zone
```

## Verify

```bash
kubectl --context eks-workload get nodes -l role=infra
kubectl --context eks-workload -n kube-system get pods
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw efs_file_system_id; echo
terraform -chdir="$TF_DIR/20-cluster-workload" output -json ecr_repository_urls | jq
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name; echo
```

**Expected:**

- Three `Ready` nodes labelled `role=infra`, one per AZ.
- CoreDNS, VPC CNI, EBS CSI and EFS CSI Pods `Running` in `kube-system`.
- An EFS file system ID (`fs-…`), seven ECR URLs and a Karpenter node role name.

If nodes stay `NotReady`, check the VPC CNI Pods first (`kubectl -n kube-system logs -l k8s-app=aws-node`).

**Next:** [1.3 Cluster 2 — Observability](05-layer-21-cluster-observability.md). You will come back to finish this layer at the end of that step.

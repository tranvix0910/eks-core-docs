---
title: "Step 2 - Create the workload cluster, EFS, and ECR"
---

# Create the foundation for microservices

This layer creates EKS, the `infra` Managed Node Group, Pod Identity, Karpenter IAM/SQS resources, EFS, and ECR. It also contains Helm/Kubernetes resources; fresh bootstrap must separate the AWS foundation from software installation inside the cluster.

## 1. Enable the workshop requirements

Set the following in `20-cluster-workload/terraform.tfvars`:

```hcl
efs_create = true

ecr_repository_names = [
  "shopnow/shopnow-frontend",
  "shopnow/shopnow-api-gateway",
  "shopnow/shopnow-config-server",
  "shopnow/shopnow-discovery-server",
  "shopnow/shopnow-product-service",
  "shopnow/shopnow-shopping-cart-service",
  "shopnow/shopnow-user-service",
]
```

Keep at least two `infra` nodes for controller availability tests; the current example uses three. `role=infra` labels the node group. It is currently untainted; backend selectors still constrain applications to the mixed pool.

If another stack already manages ECR/EFS, do not declare duplicate resources. Inspect Terraform state and AWS first; import/migration needs its own plan. This documentation does not automatically adopt existing resources into a new state.

## 2. Create the foundation on a fresh deployment

Layer 20 reads Layer 21 state for the Rancher rule, while Layer 21 reads Layer 20's node SG. `try(remote_state.outputs, null)` cannot handle failure to load a nonexistent state. Helm providers also cannot authenticate to a cluster that has not been created.

Because this configuration combines those responsibilities, use **limited resource targeting** for the initial foundation. This is a bootstrap exception; a full-layer plan is required afterward.

```bash
terraform -chdir=20-cluster-workload init
terraform -chdir=20-cluster-workload validate
terraform -chdir=20-cluster-workload plan \
  -target=module.eks \
  -target=module.karpenter \
  -target=module.ebs_csi_pod_identity \
  -target=module.efs_csi_pod_identity \
  -target=module.lb_controller_pod_identity \
  -target=module.efs \
  -target=module.ecr \
  -out="$REPO_ROOT/.workshop/plans/workload-foundation.tfplan"
terraform -chdir=20-cluster-workload show "$REPO_ROOT/.workshop/plans/workload-foundation.tfplan"
terraform -chdir=20-cluster-workload apply "$REPO_ROOT/.workshop/plans/workload-foundation.tfplan"
```

The plan should include only foundation resources and their dependencies. It should not read missing Layer 21 state or call Helm against an uncreated cluster. If a changed dependency graph still pulls those resources in, stop and inspect it; do not create fake state. Separating AWS foundation state from add-on state is a better long-term design.

## 3. Connect and verify

```bash
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
kubectl --context eks-workload get nodes -L role,topology.kubernetes.io/zone
kubectl --context eks-workload get pods -n kube-system -o wide
aws eks list-addons --cluster-name eks-workload
terraform -chdir=20-cluster-workload output -raw node_security_group_id
terraform -chdir=20-cluster-workload output -raw efs_file_system_id
terraform -chdir=20-cluster-workload output -json ecr_repository_urls
```

Nodes must be Ready and core add-ons healthy before continuing. EFS needs mount targets in worker AZs and TCP 2049 from the node SG. Karpenter has IAM/SQS resources at this stage, but the foundation pass has not installed its Helm controller.

## 4. Finish Layer 20 after the Layer 21 foundation

Complete [Step 3's foundation section](05-layer-21-cluster-observability.md), then return here:

```bash
terraform -chdir=20-cluster-workload plan -out="$REPO_ROOT/.workshop/plans/workload.tfplan"
terraform -chdir=20-cluster-workload show "$REPO_ROOT/.workshop/plans/workload.tfplan"
terraform -chdir=20-cluster-workload apply "$REPO_ROOT/.workshop/plans/workload.tfplan"
kubectl --context eks-workload get storageclass
helm --kube-context eks-workload list -A
```

Full apply installs LBC, Karpenter, ArgoCD, kube-prometheus-stack, Metrics Server, auxiliary Grafana/Kite, and StorageClasses. Chart versions come from `helm_releases.tf`; do not reinstall these releases using older Helm commands in comments.

Prometheus may not become Ready until the `observability-alb-tls` CA Secret exists. The TLS lab closes that dependency; do not disable certificate verification. Terraform sets `wait=false` for Prometheus, so a successful apply does not prove Prometheus works.

## 5. Managing changes after bootstrap

Edit `.tf`/tfvars/the values read by releases → `fmt -check` → `validate` → saved plan → review → apply. Do not use `-target` for routine updates. Save nonsensitive outputs and plan summaries in the report; do not share full state.

Reference: [HashiCorp resource targeting limitations](https://developer.hashicorp.com/terraform/tutorials/state/resource-targeting).

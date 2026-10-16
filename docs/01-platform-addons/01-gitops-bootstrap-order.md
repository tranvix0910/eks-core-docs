---
title: "Step 4 - Bootstrap the platform and establish ownership"
---

# Install the platform in dependency order

Complete full apply for Layers 20/21 first. Every release has one owner: do not reinstall a Terraform-managed release through Helm CLI or ArgoCD.

## 1. Verify what Terraform installed

```bash
helm --kube-context eks-workload list -A
helm --kube-context eks-observability list -A
kubectl --context eks-workload -n kube-system rollout status deployment/aws-load-balancer-controller --timeout=5m
kubectl --context eks-workload -n kube-system rollout status deployment/karpenter --timeout=5m
kubectl --context eks-workload -n argocd get pods -o wide
kubectl --context eks-workload get storageclass gp3 efs-sc
```

Expect LBC, Karpenter, ArgoCD, Prometheus, and Metrics Server in cluster 1, and the receiver stack in cluster 2. Install NodePools after CRDs/controllers. Prometheus needs its CA Secret; follow the TLS lab if it is not Ready.

## 2. cert-manager

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update jetstack
helm --kube-context eks-workload upgrade --install cert-manager jetstack/cert-manager \
  --version v1.21.1 --namespace cert-manager --create-namespace \
  --values platform/addons/cert-manager/values.yaml --wait --timeout 10m
kubectl --context eks-workload -n cert-manager get pods -o wide
```

This version is the repository pin, not a claim that it is the latest release. Check chart availability and Kubernetes compatibility before the workshop. cert-manager provides cross-cluster TLS; it is not a prerequisite for creating EC2 NodePools.

## 3. Argo Rollouts for the frontend

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update argo
helm search repo argo/argo-rollouts --versions | head -n 8
```

Select a listed chart version with a suitable app version, record it in a variable, and render before installation:

```bash
: "${ROLLOUTS_CHART_VERSION:?Set the chart version selected above}"
helm template argo-rollouts argo/argo-rollouts --version "$ROLLOUTS_CHART_VERSION" \
  --namespace argo-rollouts --set nodeSelector.role=infra > .workshop/rollouts-rendered.yaml
helm --kube-context eks-workload upgrade --install argo-rollouts argo/argo-rollouts \
  --version "$ROLLOUTS_CHART_VERSION" --namespace argo-rollouts --create-namespace \
  --set nodeSelector.role=infra --wait --timeout 10m
kubectl --context eks-workload get crd rollouts.argoproj.io
```

Chart version and app version are different values. If a controller already exists, check its owner/version and reuse it; do not add a second controller.

## 4. JavaMelody on infra nodes

```bash
kubectl --context eks-workload apply -f platform/addons/javamelody/javamelody-collector.yaml
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
kubectl --context eks-workload -n javamelody get pods -o wide
```

The Pod must run on a node labeled `role=infra`. A newly installed collector has no application URLs, so its UI may be empty. The [JavaMelody lab](06-javamelody.md) connects backends after application deployment.

## 5. NodePools, AppProject, and applications

1. [Configure EC2NodeClass/NodePools](../02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md).
2. Build and push images using the build lab.
3. Create the AppProject, then create Applications in dependency order using the [ShopNow deployment lab](../04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md).
4. Install Alloy once TLS trust and the Loki endpoint are ready.

Do not apply `platform/bootstrap/app-of-apps.yaml` as an “install everything” button. It still references the old repository, requires a `platform` project absent from this procedure, and recursively scans a directory containing Helm values for two clusters. For a real app-of-apps setup, use a directory containing **only child Applications** and configure child health assessment first.

`sync-wave` annotations on independent Applications created together do not automatically ensure database health before backend deployment. This workshop creates and waits for each group explicitly. See [ArgoCD sync waves](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/) and [Application health](https://argo-cd.readthedocs.io/en/stable/operator-manual/health/) for their scope.

## Completion gate

Controllers run on infra nodes, CRDs exist, gp3/efs-sc are available, and each component has a known owner. Record release → version → owner in the report so future updates use the correct tool.

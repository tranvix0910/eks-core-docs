---
title: "Step 2.1 — Platform tools on the Managed Node Group"
sidebar_label: "2.1 Platform add-ons"
---

# Step 2.1 — Platform tools on the Managed Node Group

:::info Step summary
**Goal:** every infrastructure tool — Prometheus, JavaMelody, Karpenter, ArgoCD — running on the `infra` Managed Node Group, plus cert-manager and Argo Rollouts, which later steps need.
**Requirement:** 1. **Time:** about 15 minutes. **Run from:** `$GITOPS_DIR`.
:::

## How the tools are pinned to the infra nodes

The `infra` node group carries the label `role=infra`. Every platform chart sets the same selector in its values:

```yaml
nodeSelector:
  role: infra
```

| Tool | Installed by | Values / manifest |
|---|---|---|
| Karpenter | Terraform (step 1.3) | `platform/addons/karpenter/values.yaml` |
| ArgoCD | Terraform (step 1.3) | `platform/addons/argocd/values.yaml` |
| Prometheus (kube-prometheus-stack) | Terraform (step 1.3) | `platform/addons/prometheus/values.yaml` |
| Metrics Server, Load Balancer Controller | Terraform (step 1.3) | `platform/addons/metrics-server/values.yaml` |
| cert-manager | Helm, this step | `platform/addons/cert-manager/values.yaml` |
| Argo Rollouts | Helm, this step | `--set nodeSelector.role=infra` |
| JavaMelody collector | kubectl, this step | `platform/addons/javamelody/javamelody-collector.yaml` |
| Kite dashboard | Terraform (step 1.3) | values in `20-cluster-workload/helm_releases.tf` — see [step 2.5](kite-dashboard) |

Do not reinstall a Terraform-managed chart with `helm install`; change its values file and re-apply Terraform instead.

## 1. Install cert-manager

cert-manager issues the certificate for the private telemetry endpoint in [step 4.1](cert-manager-and-internal-tls).

```bash
helm repo add jetstack https://charts.jetstack.io && helm repo update jetstack
helm --kube-context eks-workload upgrade --install cert-manager jetstack/cert-manager \
  --version v1.21.1 --namespace cert-manager --create-namespace \
  --values "$GITOPS_DIR/platform/addons/cert-manager/values.yaml" --wait --timeout 10m
```

## 2. Install Argo Rollouts

The application frontend is an Argo `Rollout` (blue-green), so the Rollouts CRD and controller must exist before the frontend is deployed.

```bash
helm repo add argo https://argoproj.github.io/argo-helm && helm repo update argo
helm search repo argo/argo-rollouts --versions | head -5     # pick a version
export ROLLOUTS_CHART_VERSION=<version from the list>
helm --kube-context eks-workload upgrade --install argo-rollouts argo/argo-rollouts \
  --version "$ROLLOUTS_CHART_VERSION" --namespace argo-rollouts --create-namespace \
  --set controller.nodeSelector.role=infra \
  --set-json 'controller.tolerations=[{"key":"CriticalAddonsOnly","operator":"Exists","effect":"NoSchedule"}]' \
  --wait --timeout 10m
kubectl --context eks-workload get crd rollouts.argoproj.io
```

## 3. Install the JavaMelody collector

JavaMelody collects JVM, HTTP and JDBC statistics from the Spring services. It runs as a StatefulSet with its own `gp3` volume.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/addons/javamelody/javamelody-collector.yaml"
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
```

The collector starts empty. You connect it to the services after they are deployed ([JavaMelody](javamelody)).

## Verify — every tool is on an infra node

```bash
for ns in kube-system argocd monitoring cert-manager argo-rollouts javamelody; do
  kubectl --context eks-workload -n "$ns" get pods \
    -o custom-columns=NAMESPACE:.metadata.namespace,POD:.metadata.name,NODE:.spec.nodeName --no-headers
done | while read -r ns pod node; do
  printf '%-14s %-60s role=%s\n' "$ns" "$pod" \
    "$(kubectl --context eks-workload get node "$node" -o jsonpath='{.metadata.labels.role}')"
done | grep -Ev 'aws-node|kube-proxy|ebs-csi-node|efs-csi-node|pod-identity|node-exporter' \
  | tee "$EVIDENCE_DIR/infra-placement.txt"
```

**Expected:** every line ends with `role=infra`. DaemonSets (VPC CNI, kube-proxy, CSI node drivers, node-exporter) run on every node by design and are filtered out.

## Open the tools

Use port-forwarding; nothing is exposed publicly. Run each in its own terminal.

| Tool | Command | URL |
|---|---|---|
| ArgoCD | `kubectl --context eks-workload -n argocd port-forward svc/argocd-server 8080:80` | http://localhost:8080 |
| Prometheus | `kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090` | http://localhost:9090 |
| JavaMelody | `kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080` | http://localhost:8081 |

ArgoCD admin password:

```bash
kubectl --context eks-workload -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 --decode; echo
```

**Next:** [2.2 Three node pools](../karpenter/ec2nodeclass-and-nodepools-configuration)

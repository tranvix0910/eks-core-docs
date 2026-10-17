---
title: "Step 2.5 — Kite dashboard"
sidebar_label: "2.5 Kite dashboard"
---

# Step 2.5 — Kite dashboard

:::info Step summary
**Goal:** a web dashboard for cluster 1 — workloads, logs, events, resource usage and an in-browser terminal — running on the infra node group.
**Time:** about 15 minutes. **Run from:** `$GITOPS_DIR` (and `$TF_DIR` for changes).
:::

## What Kite is and how it is installed

[Kite](https://github.com/kite-org/kite) is a lightweight Kubernetes dashboard: browse every resource, read Pod logs, open a shell in a container, and see CPU and memory from Prometheus. It is a convenience for operators; ArgoCD, Karpenter and the observability stack do not depend on it.

Terraform installs Kite in **layer 20** (`20-cluster-workload/helm_releases.tf`) during the full apply of [step 1.3](../architecture/layer-21-cluster-observability#6-finish-cluster-1). You do not run `helm install` yourself.

| Setting | Value | Why |
|---|---|---|
| Chart | `oci://ghcr.io/kite-org/charts/kite` version `0.15.0` | Pinned, like every other release |
| Namespace | `kite-system` | Created by Terraform |
| Replicas / strategy | 1 / `Recreate` | SQLite allows one writer; `Recreate` stops the old Pod before the new one mounts the volume |
| Database | SQLite on a 5 GiB `gp3` PVC | Users and settings survive Pod restarts |
| Secrets | Secret `kite` with random `JWT_SECRET` and `KITE_ENCRYPT_KEY` (64 chars each) | Replaces the chart's default encryption key |
| Placement | `nodeSelector: role=infra` | Platform tool, so it lives on the Managed Node Group |
| Resources | requests 250m CPU / 256 MiB, limit 512 MiB | — |
| Service | `kite`, ClusterIP, port `8080` | Health check at `/healthz` |
| Ingress | disabled in the chart | Exposed separately in section 4, if you want it |
| Kubernetes access | ServiceAccount bound to a ClusterRole with **all verbs on all resources** | Chart default; see section 5 to reduce it |

## 1. Check the installation

```bash
helm --kube-context eks-workload list -n kite-system
kubectl --context eks-workload -n kite-system get pods,svc,pvc -o wide
kubectl --context eks-workload -n kite-system get pod -l app.kubernetes.io/name=kite \
  -o jsonpath='{.items[0].spec.nodeName}' | xargs -I{} kubectl --context eks-workload get node {} -L role
```

**Expected:** release `kite` `deployed`, one Pod `Running` and `1/1` Ready, Service `kite` on `8080`, PVC `Bound`, and the Pod's node shows `role=infra`.

## 2. Open Kite with port-forward

Port-forward needs no load balancer and nothing is exposed. Use it by default.

```bash
kubectl --context eks-workload -n kite-system port-forward svc/kite 8088:8080
```

Open http://localhost:8088.

## 3. First sign-in

The first time Kite opens it has no users:

1. Create the first **administrator** account. Use a strong password; this account can do anything in the cluster.
2. Add the cluster Kite should manage and choose **in-cluster**. Kite then uses its own ServiceAccount; no kubeconfig is uploaded.
3. Set the Prometheus URL for the resource charts: `http://prometheus-kube-prometheus-prometheus.monitoring.svc:9090`.

Users and settings are stored in SQLite on the PVC, so they survive restarts and upgrades.

## Verify

- The workloads view lists the namespaces `argocd`, `monitoring`, `shopnow`, `kite-system`.
- Open a ShopNow Pod: its logs stream, and CPU and memory charts show data from Prometheus.
- `kubectl --context eks-workload -n kite-system logs deploy/kite --tail=20` shows no errors.

## 4. Optional — reach Kite through the shared admin ALB

The workshop has no DNS domain, so tools are reached by the **ALB's own hostname** and separated by port, the same way as ArgoCD (`:80`), Prometheus (`:9090`), Alertmanager (`:9093`), JavaMelody (`:8081`) and Grafana (`:3000`). Kite gets port **8088** on the same ALB group `eks-workload`, from `platform/ingress/kite-ingress.yaml`.

Unlike those tools, Kite is **not** opened to `0.0.0.0/0`: it can modify any resource and opens shells in containers. The manifest holds a placeholder `<ADMIN_CIDR>` that you fill with your own address when applying:

```bash
cd "$GITOPS_DIR"
export ADMIN_CIDR="$(curl -s -4 ifconfig.me)/32"
sed "s|<ADMIN_CIDR>|$ADMIN_CIDR|" platform/ingress/kite-ingress.yaml \
  | kubectl --context eks-workload apply -f -
kubectl --context eks-workload -n kite-system get ingress kite -w     # wait for ADDRESS, then Ctrl+C
```

```bash
echo "http://$(kubectl --context eks-workload -n kite-system get ingress kite \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):8088"
```

Open that URL and sign in.

| Check | Expected |
|---|---|
| Page loads from your network | yes |
| Page from any other network | connection refused or timeout (blocked by `inbound-cidrs`) |
| After sign-in, navigating to another page keeps you signed in | yes |

If sign-in succeeds but the next page sends you back to the login screen or answers `401`, the session cookie is marked `Secure` and the browser will not send it over plain HTTP — the same problem Rancher had on this ALB. In that case remove the Ingress and keep using port-forward:

```bash
kubectl --context eks-workload -n kite-system delete ingress kite
```

When your public IP changes, apply the manifest again with the new `ADMIN_CIDR`. Traffic is plain HTTP: the ALB hostname is not a domain you own, so no certificate can be issued for it. Treat this listener as a lab convenience, not a production setup.

## 5. Hardening (recommended outside a lab)

| Risk | Change |
|---|---|
| Cluster-wide write access | Narrow the chart's `rbac.rules` (below) and use Kite's own roles for users |
| Password and session over HTTP | Prefer port-forward, or put the ALB behind a domain with an ACM certificate |
| Single admin account | Create named users in Kite instead of sharing the first account |
| Data loss | Back up the PVC (EBS snapshot) before upgrades |

Read-only Kubernetes access for Kite — edit the `helm_release "kite"` values in `$TF_DIR/20-cluster-workload/helm_releases.tf`:

```hcl
    rbac = {
      create = true
      rules = [{
        apiGroups = ["*"]
        resources = ["*"]
        verbs     = ["get", "list", "watch"]
      }]
    }
```

Then plan and apply layer 20 as usual. With read-only rules the terminal, edit and delete actions in Kite stop working; that is the point.

## Installing Kite without Terraform

On a cluster that is not managed by these layers, the same setup with Helm is:

```bash
kubectl create namespace kite-system
kubectl -n kite-system create secret generic kite \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=KITE_ENCRYPT_KEY="$(openssl rand -hex 32)" \
  --from-literal=DB_TYPE=sqlite

cat > kite-values.yaml <<'VALUES'
replicaCount: 1
deploymentStrategy: { type: Recreate }
secret: { create: false, existingSecret: kite }
db:
  type: sqlite
  sqlite:
    persistence:
      pvc: { enabled: true, storageClass: gp3, accessModes: [ReadWriteOnce], size: 5Gi }
nodeSelector: { role: infra }
resources:
  requests: { cpu: 250m, memory: 256Mi }
  limits: { memory: 512Mi }
ingress: { enabled: false }
VALUES

helm upgrade --install kite oci://ghcr.io/kite-org/charts/kite --version 0.15.0 \
  -n kite-system -f kite-values.yaml --wait
```

In this workshop Terraform owns the release: do not also run the Helm command against `eks-workload`, or the two owners will overwrite each other.

## Troubleshooting

| Symptom | Check |
|---|---|
| Pod `Pending` | PVC `Bound`? `gp3` StorageClass exists; an infra node has room (`kubectl describe pod`) |
| Pod restarting | `kubectl -n kite-system logs deploy/kite --previous`; Secret `kite` has `JWT_SECRET` and `KITE_ENCRYPT_KEY` |
| Ingress has no ADDRESS | Load Balancer Controller logs: `kubectl -n kube-system logs deploy/aws-load-balancer-controller` |
| ALB target unhealthy | Health check path `/healthz`; Pod Ready |
| Resource charts empty | Prometheus URL in Kite's cluster settings |

## Remove Kite

Delete the Ingress if you created one, then remove the `kite` resources (`kubernetes_namespace_v1.kite`, `random_password.kite_*`, `kubernetes_secret_v1.kite`, `helm_release.kite`) from layer 20 and apply. Deleting the namespace also deletes the PVC and Kite's data.

**Next:** [3.1 Build images](../apps-shopnow/docker-build-multi-arch-and-ci)

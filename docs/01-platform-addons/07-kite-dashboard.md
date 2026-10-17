---
title: "Step 2.5 — Kite dashboard"
sidebar_label: "2.5 Kite dashboard"
---

# Step 2.5 — Kite dashboard {#step-25--kite-dashboard}

:::info Step summary
**Goal:** understand how Kite was installed, check it, and open it by port-forward **or** through the shared admin ALB on port 8088.
**Time:** about 15 minutes. **Run from:** `$GITOPS_DIR` (Ingress). Nothing to install: Terraform already did it.
:::

[Kite](https://github.com/kite-org/kite) is a lightweight Kubernetes dashboard: browse every resource, read Pod logs, open a shell in a container, and see CPU and memory from Prometheus. Nothing else in the workshop depends on it.

```mermaid
flowchart LR
  You["Your browser"] -- "A · port-forward :8088" --> Svc
  You -- "B · http://ALB-DNS:8088<br/>only from ADMIN_CIDR" --> ALB["Shared admin ALB<br/>group eks-workload"]
  ALB -- "target type ip · :8080" --> Pod
  subgraph C1["eks-workload · namespace kite-system"]
    Svc["Service kite :8080"] --> Pod["Kite Pod<br/>infra node"]
    Pod --> PVC[("PVC gp3 5 GiB<br/>SQLite")]
    Pod -. "ServiceAccount + ClusterRole" .-> API[Kubernetes API]
  end
```

## Part 1 — How Kite is installed {#part-1--how-kite-is-installed}

Kite is a `helm_release` in **Terraform layer 20** (`$TF_DIR/20-cluster-workload/helm_releases.tf`). It was installed when you applied that layer in [step 1.3](../architecture/layer-21-cluster-observability#6-finish-cluster-1); there is no separate install command.

```mermaid
flowchart LR
  A["terraform apply<br/>layer 20"] --> B["Namespace<br/>kite-system"]
  B --> C["random_password ×2<br/>→ Secret kite"]
  C --> D["helm_release kite<br/>chart 0.15.0"]
  D --> E["Deployment · Service :8080<br/>PVC gp3 5 GiB · RBAC"]
```

| Order | Terraform resource | Result in the cluster |
|---|---|---|
| 1 | `kubernetes_namespace_v1.kite` | Namespace `kite-system` |
| 2 | `random_password.kite_jwt`, `random_password.kite_encryption` | Two random 64-character keys (kept in Terraform state) |
| 3 | `kubernetes_secret_v1.kite` | Secret `kite`: `JWT_SECRET`, `KITE_ENCRYPT_KEY`, `DB_TYPE=sqlite` |
| 4 | `helm_release.kite` | Chart `oci://ghcr.io/kite-org/charts/kite` `0.15.0`: Deployment, Service `kite` (ClusterIP `8080`), PVC, ServiceAccount + ClusterRole |

Main values passed to the chart:

| Value | Setting | Why |
|---|---|---|
| `replicaCount`, `deploymentStrategy` | `1`, `Recreate` | SQLite has one writer; the old Pod stops before the new one mounts the disk |
| `secret.existingSecret` | `kite` | Use the Terraform Secret instead of the chart's default keys |
| `db.sqlite.persistence.pvc` | `gp3`, `ReadWriteOnce`, `5Gi` | Users and settings survive restarts |
| `nodeSelector`, `tolerations` | `role: infra`, `CriticalAddonsOnly` | Runs on the infra Managed Node Group |
| `ingress.enabled` | `false` | Access is port-forward or the Ingress in Part 2 |

To change a value, edit the `helm_release "kite"` block, then plan and apply layer 20 as usual. Helm waits for the Pod (`wait`, `atomic`) and rolls back if it does not become Ready.

### Check that Kite is running {#check-that-kite-is-running}

```bash
helm --kube-context eks-workload list -n kite-system
kubectl --context eks-workload -n kite-system get deploy,pods,svc,pvc,secret -o wide
kubectl --context eks-workload -n kite-system get pod -l app.kubernetes.io/name=kite \
  -o jsonpath='{.items[0].spec.nodeName}' | xargs -I{} kubectl --context eks-workload get node {} -L role
kubectl --context eks-workload -n kite-system logs deploy/kite --tail=20
```

**Expected:**

- release `kite` `deployed`, chart `kite-0.15.0`;
- Deployment `kite` `1/1`, Pod `Running`;
- Service `kite` `ClusterIP` on `8080/TCP`;
- PVC `Bound`, class `gp3`, `5Gi`;
- Secret `kite` present;
- the node shows `role=infra`;
- no errors in the log.

## Part 2 — Access Kite {#part-2--access-kite}

Choose one way in. Port-forward exposes nothing and is the default; the ALB gives a URL you can open without `kubectl`.

| | A · Port-forward | B · Admin ALB |
|---|---|---|
| URL | `http://localhost:8088` | `http://<ALB-DNS>:8088` |
| Needs | `kubectl` access | the Ingress below, your IP in `ADMIN_CIDR` |
| Exposed to the Internet | no | only to `ADMIN_CIDR` |

### 2A — Port-forward {#2a--port-forward}

```bash
kubectl --context eks-workload -n kite-system port-forward svc/kite 8088:8080
```

Open http://localhost:8088, then continue with [Part 3](#part-3--first-sign-in).

### 2B — Through the admin ALB {#2b--through-the-admin-alb}

There is no DNS domain in this workshop, so admin tools are reached by **the ALB's own hostname**, one listener port per tool:

| Port | Tool | Defined in |
|---|---|---|
| 80 | ArgoCD | `platform/ingress/admin-ingress.yaml` |
| 9090 | Prometheus | `platform/ingress/admin-ingress.yaml` |
| 9093 | Alertmanager | `platform/ingress/admin-ingress.yaml` |
| 8081 | JavaMelody | `platform/ingress/admin-ingress.yaml` |
| 3000 | Grafana (local) | Terraform layer 20 |
| **8088** | **Kite** | `platform/ingress/kite-ingress.yaml` |

Every Ingress with `alb.ingress.kubernetes.io/group.name: eks-workload` is merged into **one** ALB by the AWS Load Balancer Controller. Adding the Kite Ingress therefore adds a listener on port 8088 to the existing ALB instead of creating a new one.

#### 2B.1 Read the manifest {#2b1-read-the-manifest}

```bash
cat "$GITOPS_DIR/platform/ingress/kite-ingress.yaml"
```

| Annotation / field | Value | Effect |
|---|---|---|
| `group.name` | `eks-workload` | Join the shared admin ALB |
| `group.order` | `60` | Rule order inside the group (after the other tools) |
| `scheme` | `internet-facing` | ALB in the public subnets |
| `target-type` | `ip` | Traffic goes straight to the Pod IP, not through a NodePort |
| `listen-ports` | `[{"HTTP": 8088}]` | New listener on port 8088 |
| `inbound-cidrs` | `<ADMIN_CIDR>` | Only this address range may connect to port 8088 |
| `healthcheck-path` | `/healthz` | Target is healthy when Kite answers here |
| backend | Service `kite`, port `8080` | Where requests go |

Kite is **not** opened to `0.0.0.0/0` like the other tools: it can change any resource and open shells in containers. `<ADMIN_CIDR>` is a placeholder you fill in when applying, so your IP never ends up in Git.

#### 2B.2 Check the prerequisites {#2b2-check-the-prerequisites}

```bash
kubectl --context eks-workload -n kube-system get deploy aws-load-balancer-controller
kubectl --context eks-workload get ingressclass alb
kubectl --context eks-workload get ingress -A | grep -E 'NAME|eks-workload' || true
```

**Expected:** the controller is `1/1` or `2/2` Ready and the `alb` IngressClass exists. Other admin Ingresses may already be listed; they share the ALB.

#### 2B.3 Fill in your address and review the result {#2b3-fill-in-your-address-and-review-the-result}

```bash
cd "$GITOPS_DIR"
mkdir -p "$GITOPS_DIR/.workshop"
export ADMIN_CIDR="$(curl -s -4 ifconfig.me)/32"
echo "$ADMIN_CIDR"

sed "s|<ADMIN_CIDR>|$ADMIN_CIDR|" platform/ingress/kite-ingress.yaml > "$GITOPS_DIR/.workshop/kite-ingress.yaml"
grep -n 'inbound-cidrs' "$GITOPS_DIR/.workshop/kite-ingress.yaml"
kubectl --context eks-workload apply --dry-run=server -f "$GITOPS_DIR/.workshop/kite-ingress.yaml"
```

The `echo` must print your public IP followed by `/32`. The server-side dry run must answer `ingress.networking.k8s.io/kite created (server dry run)`. If you connect through a VPN or office network, use that network's CIDR instead of `ifconfig.me`.

#### 2B.4 Apply the Ingress {#2b4-apply-the-ingress}

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/.workshop/kite-ingress.yaml"
kubectl --context eks-workload -n kite-system get ingress kite -w     # wait for ADDRESS, then Ctrl+C
```

The `ADDRESS` column fills in with the shared ALB's hostname after about a minute. Behind the scenes the controller:

1. adds a listener on port 8088 to the ALB;
2. creates a target group (type `ip`) and registers the Kite Pod IP;
3. adds an inbound rule for `ADMIN_CIDR` on port 8088 to the ALB's security group;
4. adds a rule on the listener that forwards `/` to that target group.

Follow it in the controller log:

```bash
kubectl --context eks-workload -n kube-system logs deploy/aws-load-balancer-controller --since=5m \
  | grep -iE 'kite|eks-workload|error'
```

#### 2B.5 Check the listener and target on AWS {#2b5-check-the-listener-and-target-on-aws}

```bash
export ALB_DNS=$(kubectl --context eks-workload -n kite-system get ingress kite \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
export ALB_ARN=$(aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?DNSName=='$ALB_DNS'].LoadBalancerArn" --output text)

aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
  --query 'Listeners[].{Port:Port,Protocol:Protocol}' --output table

for tg in $(aws elbv2 describe-target-groups --load-balancer-arn "$ALB_ARN" \
              --query "TargetGroups[?contains(TargetGroupName,'kitesyst')].TargetGroupArn" --output text); do
  aws elbv2 describe-target-health --target-group-arn "$tg" \
    --query 'TargetHealthDescriptions[].{IP:Target.Id,Port:Target.Port,State:TargetHealth.State}' --output table
done
```

**Expected:** a listener `8088 HTTP` next to the other tools' ports, and one target — the Kite Pod IP on port `8080` — in state `healthy`. It can show `initial` for the first 30 seconds.

#### 2B.6 Open Kite through the ALB {#2b6-open-kite-through-the-alb}

```bash
echo "http://$ALB_DNS:8088"
curl -s -o /dev/null -w '%{http_code}\n' "http://$ALB_DNS:8088/healthz"
```

`curl` from your machine returns `200`. Open the URL in the browser, then continue with [Part 3](#part-3--first-sign-in).

| Check | Expected |
|---|---|
| Page loads from your network | yes |
| Page from any other network (for example a phone on mobile data) | timeout — blocked by `inbound-cidrs` |
| After sign-in, open another page | still signed in |

If sign-in succeeds but the next page sends you back to the login screen or answers `401`, the session cookie is marked `Secure` and the browser does not send it over plain HTTP — the same problem Rancher had on this ALB. Remove the Ingress (2B.8) and keep using port-forward.

#### 2B.7 When your IP changes {#2b7-when-your-ip-changes}

```bash
cd "$GITOPS_DIR"
export ADMIN_CIDR="$(curl -s -4 ifconfig.me)/32"
sed "s|<ADMIN_CIDR>|$ADMIN_CIDR|" platform/ingress/kite-ingress.yaml > "$GITOPS_DIR/.workshop/kite-ingress.yaml"
kubectl --context eks-workload apply -f "$GITOPS_DIR/.workshop/kite-ingress.yaml"
```

The controller replaces the security-group rule within a minute.

#### 2B.8 Remove the ALB access {#2b8-remove-the-alb-access}

```bash
kubectl --context eks-workload -n kite-system delete ingress kite
```

The controller removes the 8088 listener, the target group and the rule. The ALB itself stays as long as other Ingresses in the group exist.

Traffic through the ALB is plain HTTP: the ALB hostname is not a domain you own, so no certificate can be issued for it. Treat this listener as a lab convenience.

## Part 3 — First sign-in {#part-3--first-sign-in}

The first time Kite opens it has no users:

1. Create the first **administrator** account. Use a strong password; this account can do anything in the cluster.
2. Add the cluster Kite should manage and choose **in-cluster**. Kite then uses its own ServiceAccount; no kubeconfig is uploaded.
3. Set the Prometheus URL for the resource charts: `http://prometheus-kube-prometheus-prometheus.monitoring.svc:9090`.

### Verify {#verify}

- The workloads view lists `argocd`, `monitoring`, `shopnow`, `kite-system`.
- A ShopNow Pod shows streaming logs and CPU and memory charts.
- Restart the Pod (`kubectl --context eks-workload -n kite-system rollout restart deploy/kite`) and sign in again with the same account: the data is on the PVC.

## Part 4 — Hardening (recommended outside a lab) {#part-4--hardening-recommended-outside-a-lab}

| Risk | Change |
|---|---|
| Cluster-wide write access | Narrow the chart's `rbac.rules` (below) and use Kite's own roles for users |
| Password and session over HTTP | Prefer port-forward, or put the ALB behind a domain with an ACM certificate |
| Single admin account | Create named users in Kite instead of sharing the first account |
| Data loss | Snapshot the PVC's EBS volume before upgrades |

Read-only Kubernetes access for Kite — add to the `helm_release "kite"` values in `$TF_DIR/20-cluster-workload/helm_releases.tf`:

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

Then plan and apply layer 20. With read-only rules the terminal, edit and delete actions in Kite stop working; that is the point.

## Troubleshooting {#troubleshooting}

| Symptom | Check |
|---|---|
| Helm release fails / rolls back | `kubectl -n kite-system describe pod`; PVC `Bound`; `gp3` StorageClass exists; an infra node has room |
| Pod restarting | `kubectl -n kite-system logs deploy/kite --previous`; Secret `kite` has `JWT_SECRET` and `KITE_ENCRYPT_KEY` |
| Ingress has no ADDRESS | Controller log (2B.4); IngressClass `alb`; public subnets tagged `kubernetes.io/role/elb=1` |
| Target `unhealthy` | `curl` `/healthz` from inside the cluster; Pod Ready; the cluster node SG allows the ALB SG on 8080 |
| Browser times out | Your current IP is not `ADMIN_CIDR` — repeat 2B.7 |
| Resource charts empty | Prometheus URL in Kite's cluster settings |

## Remove Kite {#remove-kite}

Delete the Ingress (2B.8), then remove the `kite` resources (`kubernetes_namespace_v1.kite`, `random_password.kite_*`, `kubernetes_secret_v1.kite`, `helm_release.kite`) from layer 20 and apply. Deleting the namespace also deletes the PVC and Kite's data.

**Next:** [3.1 Build images](../apps-shopnow/docker-build-multi-arch-and-ci)

# AWS Load Balancer Controller & ALB Ingress Grouping

Technical deep-dive on the **AWS Load Balancer Controller (LBC) v3.5.0**, IP target registration mode (`target-type: ip`), Ingress Grouping, and common configuration pitfalls.

---

## 1. Controller Architecture & Helm Configuration

* **Helm Chart**: `eks/aws-load-balancer-controller` v3.5.0 (Repository: `https://aws.github.io/eks-charts`).
* **Namespace**: `kube-system`
* **IAM Authentication**: Uses **EKS Pod Identity**, requiring zero `eks.amazonaws.com/role-arn` annotations on the ServiceAccount.

### Mandatory Configuration in `values.yaml`:
```yaml
clusterName: eks-workload
region: ap-northeast-1
vpcId: <VPC_ID>
defaultTargetType: ip
```

> [!WARNING]
> If `vpcId` or `region` are mismatched (e.g. copied from another region), the controller fails silently with:
> `{"level":"error","msg":"Reconciler error","error":"couldn't auto-discover subnets: Evaluated 0 subnets"}`.
> Always verify that `vpcId` matches the Layer 10 Terraform output.

---

## 2. IP Target Mode (`target-type: ip`) vs Instance Mode

The platform uses `alb.ingress.kubernetes.io/target-type: ip`:

```
Client ──> ALB ──> Direct Pod IP (via VPC CNI ENI)
```

### Why IP Target Mode is Mandatory:
1. **Bypasses NodePort Hop**: Traffic routes directly from ALB to the target Pod without traversing `kube-proxy` iptables or node port translation.
2. **Karpenter Autoscaling Compatibility**: When Karpenter scales down, consolidates, or drains EC2 nodes, ALB target groups track Pod IPs directly. Pods migrating to new nodes are instantly registered without node-level disruption.

---

## 3. Ingress Grouping: Cost & Architecture Efficiency

Without Ingress Grouping, every Kubernetes `Ingress` manifest triggers AWS LB Controller to provision a distinct AWS Application Load Balancer ($16-$25/month each).

Using annotation `alb.ingress.kubernetes.io/group.name`:

```yaml
annotations:
  alb.ingress.kubernetes.io/group.name: "eks-workload"
  alb.ingress.kubernetes.io/group.order: "10"
```

* **On `eks-workload`**: Merges ArgoCD (80), Prometheus (9090), Alertmanager (9093), JavaMelody (8081), and ShopNow microservices into **1 single Public ALB**.
* **On `eks-observability`**: Merges Mimir (9009) and Loki (3100) into **1 single Internal ALB** (`group.name: eks-observability-internal`).

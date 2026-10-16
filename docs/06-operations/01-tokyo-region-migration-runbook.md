# Tokyo Region Migration Runbook (`ap-northeast-1`)

Step-by-step operational runbook for deploying and migrating the entire platform from scratch to the AWS Tokyo region (`ap-northeast-1`), resolving the Layer 20 ↔ Layer 21 circular dependency and the post-GitOps DNS/TLS bootstrap loop.

---

## 1. Prerequisites & Cleanup

```bash
export AWS_PROFILE=eks-core
export AWS_REGION=ap-northeast-1

# Verify account and identity
aws sts get-caller-identity
```

---

## 2. Infrastructure Deployment Sequence

### Step 1: Deploy Network Layer 10
```bash
cd 10-network
terraform init
terraform apply -auto-approve
```

### Step 2: Deploy Workload Cluster Layer 20 (Pass 1)
> [!IMPORTANT]
> In [main.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/20-cluster-workload/main.tf), temporarily comment out resource `aws_vpc_security_group_ingress_rule.rancher_from_cluster_observability` (which references Layer 21's output).

```bash
cd ../20-cluster-workload
terraform init
terraform apply -auto-approve
```

### Step 3: Deploy Observability Cluster Layer 21 (Pass 1)
> [!IMPORTANT]
> In [dns.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/21-cluster-observability/dns.tf) and [tls.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/21-cluster-observability/tls.tf), keep resources commented out because the Internal ALB and certificate files do not exist yet.

```bash
cd ../21-cluster-observability
terraform init
terraform apply -auto-approve
```

### Step 4: Finalize Workload Cluster Layer 20 (Pass 2)
Uncomment `rancher_from_cluster_observability` in Layer 20 and re-apply:
```bash
cd ../20-cluster-workload
terraform apply -auto-approve
```

---

## 3. GitOps Add-ons & Observability Loop Closure

1. **Deploy Add-ons on `eks-workload`**:
   Follow [docs/01-platform-addons/01-gitops-bootstrap-order.md](../01-platform-addons/01-gitops-bootstrap-order.md) to install AWS LB Controller, Karpenter, cert-manager, ArgoCD, and Rancher.
2. **Export TLS Certificates**:
   ```bash
   mkdir -p certs
   kubectl --context eks-workload -n monitoring get secret alb-tls-cert -o jsonpath="{.data['tls\.crt']}" | base64 -d > certs/cert.pem
   kubectl --context eks-workload -n monitoring get secret alb-tls-cert -o jsonpath="{.data['tls\.key']}" | base64 -d > certs/key.pem
   kubectl --context eks-workload -n monitoring get secret alb-tls-cert -o jsonpath="{.data['ca\.crt']}"  | base64 -d > certs/chain.pem
   ```
3. **Deploy Observability Add-ons & Internal Ingress on `eks-observability`**:
   Deploy Mimir, Loki, and `internal-ingress.yaml`.
4. **Finalize Layer 21 DNS & TLS in Terraform (Pass 2)**:
   Uncomment `dns.tf` and `tls.tf` in `21-cluster-observability/` and run `terraform apply -auto-approve`.

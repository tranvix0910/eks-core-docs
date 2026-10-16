# cert-manager & Internal TLS Architecture

Detailed guide on **cert-manager v1.21.1**, internal Private CA generation, automated TLS certificate provisioning, and the workflow for exporting/importing certificates into AWS ACM for the Internal ALB.

---

## 1. Overview & Architecture

To secure unauthenticated telemetry streams (`remote_write` and log `push`) between clusters, traffic across the VPC uses private HTTPS.

* **Issuer**: Internal Private Root CA managed by cert-manager in `eks-workload`.
* **Subjects (SANs)**: `mimir.observability.internal`, `loki.observability.internal`.
* **Consumer**: AWS ACM (AWS Certificate Manager) attached to the Internal ALB HTTPS listeners.

```
cert-manager (Cluster 1)
   │
   ├──> Root CA Issuer (10-year validity)
   └──> TLS Certificate (1-year validity)
           │
           ▼ (Exported via kubectl)
        certs/cert.pem, certs/key.pem, certs/chain.pem
           │
           ▼ (Imported via Terraform tls.tf)
        AWS ACM Certificate (ap-northeast-1)
           │
           ▼
        Internal ALB HTTPS Listener (9009 / 3100)
```

---

## 2. In-Cluster Certificate Provisioning

Manifests located in [platform/observability/tls/](https://github.com/tranvix0910/eks-core-gitops/tree/main/platform/observability/tls):

### 2.1 — Self-Signed CA Issuer ([ca-issuer.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/observability/tls/ca-issuer.yaml))
Generates a 10-year internal Root Certificate Authority stored in Secret `internal-ca-secret`.

### 2.2 — ALB Certificate ([alb-cert.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/observability/tls/alb-cert.yaml))
Requests a 1-year certificate with SANs:
* `mimir.observability.internal`
* `loki.observability.internal`

---

## 3. Export & ACM Import Workflow

Because AWS Application Load Balancer only accepts certificates hosted in AWS ACM, in-cluster certificates must be imported into ACM:

```bash
# 1. Export Certificate, Private Key, and CA Chain from Kubernetes Secret
mkdir -p certs
kubectl -n monitoring get secret alb-tls-cert -o jsonpath="{.data['tls\.crt']}" | base64 -d > certs/cert.pem
kubectl -n monitoring get secret alb-tls-cert -o jsonpath="{.data['tls\.key']}" | base64 -d > certs/key.pem
kubectl -n monitoring get secret alb-tls-cert -o jsonpath="{.data['ca\.crt']}"  | base64 -d > certs/chain.pem

# 2. Import into AWS ACM via Terraform
# Uncomment tls.tf in 21-cluster-observability/ and run:
cd 21-cluster-observability
terraform apply -auto-approve
```

---

## 4. Verification

Verify that Prometheus Agent and Grafana Alloy validate the internal CA properly:
```bash
# Verify Prometheus remote_write metrics delivered over HTTPS
kubectl --context eks-workload exec -n monitoring prometheus-prometheus-kube-prometheus-prometheus-0 -- \
  promtool query instant http://localhost:9090 'prometheus_remote_storage_samples_total'
```

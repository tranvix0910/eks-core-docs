# TLS Certificate Lifecycle & ACM Integration

Technical guide covering the lifecycle of internal TLS certificates managed by cert-manager, automated in-cluster renewal, and the renewal workflow for certificates imported into AWS ACM.

---

## 1. Internal Certificate Lifecycles

* **Root Certificate Authority (`internal-ca-secret`)**:
  * Validity: **10 years** (`duration: 87600h`).
  * Renew before: **30 days** before expiry.
* **Internal ALB Certificate (`alb-tls-cert`)**:
  * Validity: **1 year** (`duration: 8760h`).
  * Renew before: **30 days** before expiry.

---

## 2. In-Cluster vs ACM Import Renewal Disconnect

* **In-Cluster**: cert-manager automatically re-issues and rotates the Kubernetes `Secret` `alb-tls-cert` before it expires.
* **AWS ACM Disconnect**: Because the certificate is an **Imported Certificate** in AWS ACM (not issued directly by AWS Private CA), **AWS ACM CANNOT AUTO-RENEW IT**.

### Renewal Procedure for ACM:
When cert-manager renews the certificate:
1. Re-export the renewed certificate and key:
   ```bash
   kubectl -n monitoring get secret alb-tls-cert -o jsonpath="{.data['tls\.crt']}" | base64 -d > certs/cert.pem
   kubectl -n monitoring get secret alb-tls-cert -o jsonpath="{.data['tls\.key']}" | base64 -d > certs/key.pem
   kubectl -n monitoring get secret alb-tls-cert -o jsonpath="{.data['ca\.crt']}"  | base64 -d > certs/chain.pem
   ```
2. Re-apply Terraform to update the imported certificate in ACM:
   ```bash
   cd 21-cluster-observability && terraform apply -auto-approve
   ```
3. AWS ACM replaces the active certificate without modifying the Certificate ARN, maintaining zero downtime on the Internal ALB.

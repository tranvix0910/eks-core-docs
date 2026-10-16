---
title: "Step 8a - Connect both clusters with TLS and private DNS"
---

# Prepare a telemetry path with certificate verification

**Input:** both clusters and receiver Pods exist; cert-manager runs in cluster 1. **Output:** cluster 1 clients trust the CA and reach Mimir/Loki through private DNS.

## 1. Create the CA and certificate

```bash
kubectl --context eks-workload apply -f platform/observability/tls/ca-issuer.yaml
kubectl --context eks-workload -n cert-manager wait certificate/observability-ca \
  --for=condition=Ready --timeout=3m
kubectl --context eks-workload apply -f platform/observability/tls/alb-cert.yaml
kubectl --context eks-workload -n cert-manager wait certificate/observability-alb-tls \
  --for=condition=Ready --timeout=3m
```

SANs must match `mimir.observability.internal` and `loki.observability.internal`, or hostnames consistently substituted throughout your values. The root CA Secret is `observability-ca-secret`; the leaf Secret is `observability-alb-tls`.

## 2. Export securely and import into ACM

Keep the private key outside Git. The files below are local data; `acm.tf` is commented out and does not manage this certificate. This procedure uses AWS CLI as the certificate owner.

```bash
umask 077
export WORKSHOP_CERT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/eks-workshop-certs.XXXXXX")
kubectl --context eks-workload -n cert-manager get secret observability-alb-tls \
  -o jsonpath='{.data.tls\.crt}' | base64 --decode > "$WORKSHOP_CERT_DIR/cert.pem"
kubectl --context eks-workload -n cert-manager get secret observability-alb-tls \
  -o jsonpath='{.data.tls\.key}' | base64 --decode > "$WORKSHOP_CERT_DIR/key.pem"
kubectl --context eks-workload -n cert-manager get secret observability-alb-tls \
  -o jsonpath='{.data.ca\.crt}' | base64 --decode > "$WORKSHOP_CERT_DIR/chain.pem"
openssl x509 -in "$WORKSHOP_CERT_DIR/cert.pem" -noout -dates -ext subjectAltName
export WORKSHOP_CERT_ARN=$(aws acm import-certificate --region "$AWS_REGION" \
  --certificate "fileb://$WORKSHOP_CERT_DIR/cert.pem" \
  --private-key "fileb://$WORKSHOP_CERT_DIR/key.pem" \
  --certificate-chain "fileb://$WORKSHOP_CERT_DIR/chain.pem" \
  --query CertificateArn --output text)
```

For renewal, use `--certificate-arn` to re-import into the existing ARN instead of creating a new ARN every time. To move ownership to Terraform, import the resource into state first; do not manage the same certificate through both paths.

## 3. Create internal ingress with the correct ARN and SG

```bash
export WORKSHOP_INGEST_SG=$(terraform -chdir=21-cluster-observability output -raw internal_alb_security_group_id)
python3 - <<'PATCH'
import os,re
from pathlib import Path
src=Path('platform/observability/ingress/internal-ingress.yaml').read_text()
src=re.sub(r'(alb.ingress.kubernetes.io/certificate-arn:).*',r'\1 '+os.environ['WORKSHOP_CERT_ARN'],src)
src=re.sub(r'(alb.ingress.kubernetes.io/security-groups:).*',r'\1 '+os.environ['WORKSHOP_INGEST_SG'],src)
Path('.workshop/internal-ingress.yaml').write_text(src)
PATCH
kubectl --context eks-observability apply -f .workshop/internal-ingress.yaml
kubectl --context eks-observability -n monitoring get ingress mimir loki -w
```

Wait for `ADDRESS`, then stop watching with Ctrl+C. Persist the ARN/SG mapping in your managed environment configuration if you need to recreate it later; `.workshop` output is not the application's GitOps source.

## 4. Create private DNS aliases

```bash
export WORKSHOP_INGEST_DNS=$(kubectl --context eks-observability -n monitoring get ingress mimir \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
export WORKSHOP_INGEST_ALB=$(aws elbv2 describe-load-balancers --region "$AWS_REGION" \
  --query "LoadBalancers[?DNSName=='${WORKSHOP_INGEST_DNS}'].LoadBalancerName | [0]" --output text)
printf '%s\n' "$WORKSHOP_INGEST_ALB"
```

Set Layer 21's `internal_observability_alb_name` tfvar to the discovered name, then plan/review/full apply Layer 21. Terraform creates two A aliases in the private hosted zone. Use the ALB name, not its DNS string. The ALB scheme must be `internal`.

## 5. Provide trust to Prometheus and Alloy

Secrets do not propagate automatically from `cert-manager` to `monitoring`. Clients need only the public CA; do not copy the leaf private key into monitoring:

```bash
kubectl --context eks-workload -n monitoring create secret generic observability-alb-tls \
  --from-file=ca.crt="$WORKSHOP_CERT_DIR/chain.pem" \
  --dry-run=client -o yaml | kubectl --context eks-workload apply -f -
kubectl --context eks-workload -n monitoring get pods
```

Prometheus mounts `ca.crt` at `/etc/prometheus/secrets/observability-alb-tls/ca.crt`; Alloy uses `/etc/alloy/ca/ca.crt`. A Secret volume update does not guarantee the client has reloaded its CA; verify and perform a controlled restart when needed.

## 6. Verify from cluster 1

```bash
kubectl --context eks-workload -n monitoring run telemetry-dns-check \
  --image=public.ecr.aws/docker/library/busybox:1.37.0 --restart=Never \
  --command -- sh -c 'nslookup mimir.observability.internal; nslookup loki.observability.internal'
kubectl --context eks-workload -n monitoring logs telemetry-dns-check
kubectl --context eks-workload -n monitoring delete pod telemetry-dns-check
```

If taints prevent the temporary Pod from scheduling, run the check on infra capacity or use a test manifest with an appropriate toleration. Verify actual HTTPS traffic through Prometheus remote_write and Alloy logs in subsequent labs. Successful DNS resolution alone does not prove TLS or ingestion works.

**Completion gate:** DNS resolves to the private endpoint, SANs match, clients trust the CA, and receivers no longer report 401/403/5xx errors. `insecure_skip_verify` is not an acceptance criterion.

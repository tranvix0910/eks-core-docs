---
title: "Renew certificates without breaking telemetry"
---

# Keep three certificate locations synchronized

cert-manager manages the leaf Secret, ACM holds the imported ALB certificate, and Prometheus/Alloy hold CA trust. Secret renewal does not update the other two locations automatically.

## 1. Inspect expiration

```bash
kubectl --context eks-workload -n cert-manager get certificates
kubectl --context eks-workload -n cert-manager describe certificate observability-alb-tls
aws acm describe-certificate --certificate-arn "$WORKSHOP_CERT_ARN" \
  --query 'Certificate.{NotAfter:NotAfter,Status:Status,Type:Type,InUseBy:InUseBy}'
```

The leaf manifest currently requests one year with renewal 30 days before expiry; the CA lasts longer. Operate from actual `NotAfter` values rather than local file creation dates.

## 2. Renew and re-import the leaf

After cert-manager issues a new certificate, export it to a protected temporary directory using the TLS lab procedure. Re-import into the **same ARN**:

```bash
aws acm import-certificate --region "$AWS_REGION" \
  --certificate-arn "$WORKSHOP_CERT_ARN" \
  --certificate "fileb://$WORKSHOP_CERT_DIR/cert.pem" \
  --private-key "fileb://$WORKSHOP_CERT_DIR/key.pem" \
  --certificate-chain "fileb://$WORKSHOP_CERT_DIR/chain.pem"
```

This command uses newly exported files; it does not fetch renewed Kubernetes data itself. Check dates/SANs before import. An imported certificate should not be assumed to use the same automatic renewal as an ACM-managed certificate.

## 3. If the CA changes too

Use an overlap period with both old and new CAs trusted by clients. Deploy trust before switching the ALB certificate. Update the monitoring Secret and verify client reload or a controlled rollout. Do not remove the old CA until every client/endpoint has migrated.

## 4. Verify after changes

Mimir queries must return new samples and Loki must show new markers. Senders should have no x509 errors or prolonged retries, and the ALB must use the intended ARN. Record new expiration dates and renewal ownership, never private keys.

Delete temporary key files after ensuring managed retention follows team policy. Do not use `insecure_skip_verify` to bypass a failed rotation.

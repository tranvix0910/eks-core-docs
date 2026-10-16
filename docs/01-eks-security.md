# EKS Security — Identity, Secrets & TLS Certificates

> Overview document covering security principles, identity federation, and secret management on the EKS Core Platform.
> For deep-dive technical guides, see the [docs/05-security/](https://github.com/tranvix0910/eks-core-docs/tree/main/docs/05-security) directory.

---

## Table of Contents

- [1. Base64 Bearer Tokens & STS SigV4 Mechanism](05-security/02-sts-tokens-and-access-entries.md)
- [2. Identity: EKS Pod Identity vs IRSA](05-security/01-eks-pod-identity.md)
- [3. API Server Access via EKS Access Entries](05-security/02-sts-tokens-and-access-entries.md#2-eks-access-entries-replacing-aws-auth-configmap)
- [4. Secrets Management: KMS Envelope Encryption & ESO Rotation](05-security/03-secrets-management-and-rotation.md)
- [5. TLS Certificate Lifecycle & ACM Import](05-security/04-tls-certificate-lifecycle.md)
- [6. Admin Ingress Security Tradeoffs & Hardening Guidelines](01-platform-addons/05-admin-ingress-and-hardening.md)

---

## Core Security Tenets

1. **EKS Pod Identity Replaces IRSA Completely**:
   * All ServiceAccounts (EBS CSI, EFS CSI, AWS LB Controller, Karpenter, Mimir, Loki) authenticate via EKS Pod Identity.
   * No IRSA annotations (`eks.amazonaws.com/role-arn`) on ServiceAccounts.
2. **Cluster Access Authentication via EKS Access Entries**:
   * Legacy `aws-auth` ConfigMap is discarded. Karpenter node IAM roles join the cluster directly via EKS Access Entries.
3. **Secrets Encryption via AWS KMS**:
   * Envelope encryption enabled for Kubernetes Secrets in etcd.
   * External Secrets Operator (ESO) fetches dynamic credentials from AWS Secrets Manager.
4. **Internal In-Transit Encryption via Private TLS**:
   * All `remote_write` and log `push` streams between clusters cross private subnets over HTTPS with cert-manager internal Private CA certs.

---
title: "Access, secrets, and TLS in the workshop"
---

# Manage access by operational flow

Security follows each access path through the labs rather than a disconnected list of technologies.

| Flow | Mechanism | Guide |
|---|---|---|
| Operator → AWS/EKS | AWS identity, EKS access entries, Kubernetes RBAC | [Cluster access](05-security/02-sts-tokens-and-access-entries.md) |
| Pod → AWS APIs | EKS Pod Identity and IAM policy | [Pod Identity](05-security/01-eks-pod-identity.md) |
| Application → database/Keycloak | Kubernetes Secret and an optional synchronization mechanism | [Secrets](05-security/03-secrets-management-and-rotation.md) |
| Cluster 1 → cluster 2 receivers | Private DNS/SGs, HTTPS, CA trust | [TLS](01-platform-addons/03-cert-manager-and-internal-tls.md) |
| Certificate renewal | cert-manager, ACM re-import, client CA updates when needed | [Certificate lifecycle](05-security/04-tls-certificate-lifecycle.md) |
| Browser → admin UI | Port-forward or an endpoint with HTTPS/authentication | [Tool access](01-platform-addons/05-admin-ingress-and-hardening.md) |

## Important distinctions

- `sensitive=true` hides values in some Terraform output; state still needs protection.
- Kubernetes Secret base64 encoding is not encryption.
- Mimir's tenant header is not a login credential.
- PDBs and topology spread provide availability controls, not authorization.
- External Secrets documentation does not prove the operator/SecretStore is installed.

Sample configuration contains synthetic-data credentials and some open ingress rules. Replace these following the relevant lab before sharing the environment. Do not put passwords, private keys, or registration tokens in the workshop report.

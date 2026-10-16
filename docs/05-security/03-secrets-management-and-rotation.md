---
title: "Manage secrets and rotate credentials"
---

# Keep documentation out of the credential storage path

This checkout contains sample values in ConfigMaps, database manifests, and the realm export. They are for synthetic-data environments only. This documentation does not repeat real Grafana passwords or tokens.

## 1. Inventory before sharing the workshop

Inspect database credentials, Keycloak admin/client secrets, Grafana, ArgoCD, CI tokens, certificate private keys, and Terraform plans/state. Rotate an exposed credential at its source; deleting a line from current Git content does not revoke a previously shared value.

## 2. Replace hardcoded values with Secrets

Use `valueFrom.secretKeyRef` or mounted files in Deployments. If a chart lacks `secretKeyRef`/envFrom support, extend its template. Creating a Secret while leaving `spring.datasource.password` in a ConfigMap does not solve the issue.

Spring Boot supports environment overrides such as `SPRING_DATASOURCE_PASSWORD`, but verify precedence against effective configuration and test database connectivity after rollout. Use your team's secret-management mechanism rather than placing real passwords in command lines/history.

## 3. External Secrets Operator is an extension

`platform/addons/external-secrets` is currently a placeholder. The core procedure has no complete operator release, SecretStore, or ExternalSecret, so do not claim automated rotation. An ESO implementation requires:

1. A compatible pinned operator/chart running on infra nodes.
2. Pod Identity and IAM permissions restricted to the required Secret ARNs.
3. A SecretStore/ClusterSecretStore in the correct region.
4. An ExternalSecret with explicit refresh interval and target Secret/keys.
5. Workloads reading the target Secret, with rollout/reload tested.
6. Credential rotation at the source, measured propagation, and verified database access.

Secret updates do not restart containers consuming environment variables. Use rollout/reloader or tested application reload behavior.

## 4. Encryption and Terraform state

Inspect EKS `encryptionConfig` and the module's KMS key rather than claiming compliance because documentation mentions KMS. Protect EFS/S3/EBS and backups according to the actual data.

```bash
aws eks describe-cluster --name eks-workload --query 'cluster.encryptionConfig'
aws eks describe-cluster --name eks-observability --query 'cluster.encryptionConfig'
```

State contains generated passwords and some secret data. S3 backends need encryption, versioning, least privilege, and reader controls. Run secret `terraform output -raw` commands only in authorized terminals, without redirecting values into evidence.

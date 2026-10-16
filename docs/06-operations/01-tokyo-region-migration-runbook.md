---
title: "Redeploy or move to a new environment"
---

# Reuse the workshop in another account or region

This runbook covers parallel deployment and verified cutover, rather than changing `region` and applying against old state. The main learning path remains [the workshop start page](../00-platform-overview-and-deployment.md).

## 1. Inventory environment-specific settings

| Setting | Location |
|---|---|
| Account, profile, region, version, tags | All three layers' tfvars |
| Bucket, state keys, backend region | Backend and remote-state configuration |
| CIDRs and AZs | Layer 10 tfvars |
| Mimir/Loki buckets and S3 endpoint | Receiver values |
| Node IAM role, AMI pin, discovery labels | EC2NodeClass and Terraform outputs |
| Certificate ARN, SG, internal ALB name | TLS rendering and Layer 21 tfvars |
| Repository, revision, registry, image tag | Application rendering variables |
| Frontend API URL | Docker build argument |
| Private hostnames and CA | Certificate, sender values, DNS |

Do not copy `.terraform/`, `.tfstate`, or another account's certificate key into a new repository. Provider lock files can preserve reproducible versions; review module constraints during init.

## 2. Create an independent destination

Use a separate checkout/branch and state keys. Reusing a key in the same bucket points to the same state rather than an independent environment. Verify identity and backend before each plan.

Follow this order: network → workload foundation → observability foundation → full workload → monitoring prerequisites → full observability → NodePools → applications → TLS/telemetry → acceptance.

## 3. Move data deliberately

Application data lives in PostgreSQL, MySQL/Keycloak, and potentially EFS files. Back up/restore each using a tested procedure. Copying images does not copy databases. Existing EFS Access Point IDs/PV volumeHandles cannot be reused unchanged with a new filesystem.

For Mimir/Loki S3 history, choose whether to retain the old environment or migrate using the product's procedure. Do not point independent writers at the same bucket/prefix without a supporting design.

## 4. Cut over

Verify APIs, login, EFS, placement, PDBs, and metrics/logs in the destination. Change endpoints/DNS and the frontend API URL according to your access design. Monitor errors and keep the old environment available for rollback until new data is accepted.

## 5. Finish

Record old/new environment mappings, cutover time, owner, and evidence. Remove old resources only when backups/rollback no longer need them. SCP-protected Flow Logs or versioned buckets are explicit cleanup blockers; removing them from state does not prove cleanup is complete.

---
title: "Troubleshoot by symptom"
---

# Diagnose using components and evidence

This catalogue retains useful situations from earlier documentation and adds gaps found in configuration. Entries are **hypotheses to verify**, not claims that every incident occurred or was resolved in your environment.

| # | Symptom | Evidence to check | Action after verification |
|---|---|---|---|
| 1 | EKS/EFS AccessDenied despite IAM admin | Explicit deny/SCP and current region | Use an authorized region/permission set |
| 2 | Flow Log destroy blocked | `DeleteFlowLogs` SCP and resource owner | Agree on retention/cleanup; do not silently remove state |
| 3 | Layer 20 cannot read state 21 | Bucket/key and state existence | Use two-stage foundation bootstrap |
| 4 | Provider cannot connect on first deployment | Cluster endpoint existence and exec credentials | Create AWS foundation before Helm resources |
| 5 | LBC `Evaluated 0 subnets` | Effective region/VPC and subnet tags | Update configuration under its correct owner |
| 6 | Internal ALB targets unhealthy | Container target port, second SG hop, gateway readiness | Permit current gateway port 8080 |
| 7 | Rancher login loop | Browser HTTPS and Secure cookie | HTTPS port-forward or correct TLS endpoint |
| 8 | Rancher agent CA mismatch | TLS termination changes the presented certificate | Correct passthrough/trust design |
| 9 | Unexpected Mimir Kafka/MinIO | Rendered chart and ingest-storage flags | Align pins/configuration with the selected model |
| 10 | Mimir storage-prefix collision | Blocks/ruler/alertmanager bucket/prefix | Separate prefixes in configuration |
| 11 | Mimir push gRPC error | Ingest-storage path and push flag | Enable direct push when Kafka is disabled |
| 12 | Mimir/Loki quorum errors | Replicas and replication factor | Align factor with lab topology |
| 13 | S3 redirect or AccessDenied | Region/endpoint/bucket and Pod Identity | Correct environment/IAM for the target bucket |
| 14 | Receiver PVC Pending | Default gp3, CSI logs, IAM/AZ | Create Terraform-owned StorageClass and repair CSI |
| 15 | Alloy parsing failure | River syntax and rendered ConfigMap | Validate Alloy syntax before rollout |
| 16 | Missing mixed-pool logs | DaemonSet tolerations and NODE_NAME selector | Use workshop overrides; check node coverage |
| 17 | Duplicate logs | Several Alloy agents tail one Pod | Node-local discovery or deliberate clustering |
| 18 | x509 during telemetry push | SAN, CA Secret, ALB certificate | Repair trust/ACM import; retain verification |
| 19 | NodeClass NotReady | AMI alias, role, subnet/SG selectors | Correct pin/role/discovery using outputs |
| 20 | NodePool kind not recognized | CRD/controller installation | Complete controller installation before manifests |
| 21 | EC2 exists but cannot join EKS | Node access entry, bootstrap, egress | Repair authentication/network; inspect NodeClaim conditions |
| 22 | Pod cannot enter mixed pool | Selector, toleration, requirements, requests | Describe Pod, then update chart/values through Git |
| 23 | Expected 1:3 ratio absent | Node versus vCPU metric, load, existing capacity | Report observed capacity accurately; use the dedicated fixture |
| 24 | ARM64 `exec format error` | Image platforms | Build/push ARM64 or multi-architecture image |
| 25 | EFS mount timeout | SG 2049, mount target, DNS/AZ | Repair networking with the correct worker SG |
| 26 | EFS write Permission denied | UID/GID, Access Point permissions, path | Align POSIX identity 10001 |
| 27 | Frontend receives HTML instead of JSON | API build argument and browser URL | Rebuild with the correct API URL |
| 28 | Gateway 404/503 | Prefix and Eureka service ID | Correct the failing hop |
| 29 | ArgoCD resource forbidden | AppProject group/destination permissions | Add narrowly scoped required permissions |
| 30 | HPA target missing | Helper fullname differs from Deployment name | Target `<appName>-deployment` in the correct namespace |
| 31 | Replicas oscillate between values | ArgoCD/self-heal, HPA, KEDA competing | One scaler per target; define replica ownership |
| 32 | Grafana No data or incorrect RPS | Datasource UID, tenant, labels, metric units | Repair query/UID; do not substitute CPU for traffic |

## Using this during the lab

Save `describe`, Events, and timestamped logs before making changes. Change one cause at a time, render/plan when applicable, then repeat the failing test. Do not apply every listed remedy: one symptom may have several causes.

Collection commands: [verification and diagnostics](03-system-verification-and-diagnostics.md).

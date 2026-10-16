# Master Incident & Troubleshooting Catalogue (32 Incidents)

Complete, comprehensive catalogue of all 32 real-world technical incidents encountered, root-cause analyzed, and permanently resolved during the design, bootstrap, tuning, and migration of the EKS Core Platform.

---

## 1. Infrastructure, Networking & Observability Incidents (#1 – #16)

| # | Incident / Symptom | Root Cause | Permanent Resolution |
|---|---|---|---|
| **#1** | `SCP explicit deny` on EKS in Sydney/Singapore | AWS Organization SCP `<SCP_POLICY_ID>` restricts EKS creation to 3 regions (`ap-southeast-1`, `ap-southeast-5`, `ap-northeast-1`). | Migrated all infrastructure to Tokyo (`ap-northeast-1`). |
| **#2** | `VPC Flow Log deletion denied` during teardown | SCP forbids `ec2:DeleteFlowLogs`. | Used `terraform state rm` to decouple Flow Logs from state. |
| **#3** | Circular dependency: Layer 20 ↔ Layer 21 | Layer 20 references Layer 21 SG for Rancher; Layer 21 references Layer 20 SG for nodes. | 2-pass deployment workflow: comment rule in Layer 20 first, deploy 21, uncomment and re-apply 20. |
| **#4** | Post-GitOps DNS/TLS dependency in Layer 21 | `dns.tf` and `tls.tf` require the Internal ALB and exported cert-manager certs. | Deployed core Layer 21 first, deployed GitOps add-ons, exported certs, then applied `dns.tf`/`tls.tf`. |
| **#5** | AWS LB Controller: `Evaluated 0 subnets` | Stale `vpcId` and `region` in Helm `values.yaml` from old region. | Set `region: ap-northeast-1` and dynamic VPC ID `<VPC_ID>`. |
| **#6** | Rancher Agent: `certificate verify failed` on ALB | ALB terminated TLS and changed the root CA hash, breaking agent `--ca-checksum`. | Replaced ALB with Internal NLB TCP Passthrough (`rancher-internal-nlb`). |
| **#7** | Rancher Web UI: Login loops with `401 Unauthorized` | Rancher sets `Secure` cookie flag; plain HTTP ALB caused browsers to drop cookies. | Accessed via `kubectl port-forward -n cattle-system svc/rancher 8443:443`. |
| **#8** | Mimir: `unexpected Kafka StatefulSet deployed` | Base chart defaulted `ingest_storage.enabled: true` and `kafka.enabled: true`. | Explicitly disabled Kafka and ingest storage in `mimir/values.yaml`. |
| **#9** | Mimir: `storage prefix collision error` | All Mimir components wrote to the same root S3 prefix without subdirectories. | Added unique prefixes: `alertmanager_storage.storage_prefix: alertmanager`, `ruler_storage.storage_prefix: ruler`. |
| **#10**| Mimir: `cannot disable Push gRPC method` | Base chart disabled push gRPC assuming Kafka was active. | Set `ingester.push_grpc_method_enabled: true` in `mimir/values.yaml`. |
| **#11**| Mimir: `at least 2 live replicas required in ring` | Default replication factor was 3; single-replica lab failed quorum. | Configured `ingester.ring.replication_factor: 1`. |
| **#12**| Grafana Alloy: `River parse error: expected expression` | Used bash `#` comments instead of River `//` comments in Alloy config. | Updated all comments to `//` River syntax. |
| **#13**| Grafana Alloy: `TLS handshake error on log push` | Alloy lacked the internal cert-manager CA certificate for the Internal ALB. | Injected Private Root CA into Alloy's `tls_config.ca_pem`. |
| **#14**| Loki: `replication factor quorum error` | SingleBinary Loki defaulted to replication factor 3. | Set `loki.commonConfig.replication_factor: 1`. |
| **#15**| Loki: `memcached pod memory bloat` | Default cache allocated 8Gi RAM per memcached instance. | Disabled `chunksCache` and `resultsCache` for lab scale. |
| **#16**| Mimir/Loki: `S3 PermanentRedirect 301` | S3 region was configured as `ap-southeast-1` while buckets were created in `ap-northeast-1`. | Updated S3 region and endpoint to `ap-northeast-1` in both charts. |

---

## 2. Karpenter Autoscaling Incidents (#K1 – #K7)

| # | Incident / Symptom | Root Cause | Permanent Resolution |
|---|---|---|---|
| **#K1**| `no matches for kind "EC2NodeClass"` | Applied NodePool YAML before installing the Karpenter Helm chart. | Installed Helm chart v1.14.0 first to register CRDs. |
| **#K2**| Karpenter Controller crash-looping in custom NS | Terraform module binds Pod Identity to `kube-system/karpenter`. | Installed Karpenter Controller explicitly in `kube-system`. |
| **#K3**| Discrepancy in `limits.cpu` (2 vs 24 vs 72) | Mixed testing limits with target production ratios. | Standardized 1:3 ratio: `ms-od` (24 vCPUs, weight 100) and `ms-spot` (72 vCPUs, weight 10). |
| **#K4**| 1 vCPU node leakage (`t3.medium` instances) | NodePool allowed `medium` instances, leaving only ~1.4 usable vCPUs. | Excluded sizes `["nano", "micro", "small", "medium"]`. |
| **#K5**| Karpenter nodes failing to join cluster | IAM Role lacked cluster permissions. | Created native EKS Access Entry with type `EC2_LINUX`. |
| **#K6**| Spot Interruption notices missed | EventBridge rules or SQS queue permissions were missing. | Configured full EventBridge pipeline + SQS queue in Terraform. |
| **#K7**| Node consolidation thrashing | `consolidateAfter` was too aggressive. | Set `consolidateAfter: 30s` with policy `WhenEmptyOrUnderutilized`. |

---

## 3. ShopNow Microservices & Rollouts Incidents (#R1 – #R9)

| # | Incident / Symptom | Root Cause | Permanent Resolution |
|---|---|---|---|
| **#R1**| React Frontend home page blank crash | `REACT_APP_BASE_API_URL` was missing during Docker build time. | Added `--build-arg REACT_APP_BASE_API_URL="http://<ALB_DNS>:5860"`. |
| **#R2**| Docker `exec format error` on EKS | Built images with ARM64 architecture on Apple Silicon Mac. | Built with `docker buildx build --platform linux/amd64`. |
| **#R3**| API Gateway routing HTTP 404 | Controllers mapped to `@RequestMapping("api/...")` while gateway routed bare paths. | Added `PrefixPath=/api` filter in Spring Cloud Gateway. |
| **#R4**| Eureka service lookup failure | Gateway used `lb://SHOPNOW-PRODUCT-SERVICE` while Eureka registered `PRODUCT-SERVICE`. | Standardized service IDs to match Eureka registration. |
| **#R5**| Keycloak token validation failure | Backend could not resolve external Keycloak URL. | Configured internal Kubernetes DNS `http://keycloak.shopnow.svc:8080/realms/shopnow`. |
| **#R6**| Browser CORS preflight blocked | Spring Cloud Gateway lacked CORS headers for frontend origin. | Configured global CORS filter in Spring Cloud Gateway. |
| **#R7**| Argo Rollouts CRD rejected by ArgoCD | ArgoCD `AppProject` did not whitelist group `argoproj.io` for CRD `Rollout`. | Added `clusterResourceWhitelist` in `appproject-shopnow.yaml`. |
| **#R8**| Rollout preview traffic bleeding to active users | Service selectors lacked dynamic rollout hash matching. | Configured explicit `activeService` and `previewService` in Rollout spec. |
| **#R9**| Instant traffic disruption during promotion | Pods terminated immediately without drain time. | Added `scaleDownDelaySeconds: 30` to Rollout blueGreen strategy. |

# EKS Core Platform — Technical Documentation

Comprehensive, production-grade technical documentation for the **EKS Core Platform** — running on 2 Amazon EKS clusters inside a shared Virtual Private Cloud (VPC) in the AWS Tokyo region (`ap-northeast-1`).

---

## Documentation Sitemap

The documentation is organized into modular sections by architectural layer and functional domain:

```
docs/
├── README.md                                          # Master documentation index and navigation
├── 00-platform-overview-and-deployment.md             # End-to-end platform summary and overview
├── 01-eks-security.md                                 # Security and compliance index
├── 02-karpenter-autoscaling-nodepools.md              # Karpenter autoscaling index
├── 03-blue-green-deployment-argo-rollouts.md          # Argo Rollouts Blue-Green deployment index
│
├── 00-architecture/                                   # CORE INFRASTRUCTURE & ARCHITECTURE (TERRAFORM)
│   ├── 01-architecture-overview.md                    # 2 EKS clusters, Shared VPC, ownership boundaries
│   ├── 02-organizational-constraints-and-prerequisites.md # SCP <SCP_POLICY_ID>, VPC Flow Logs, Quota & IAM
│   ├── 03-layer-10-network.md                         # VPC 10.20.0.0/16, Subnetting, NAT, Route Tables
│   ├── 04-layer-20-cluster-workload.md                # EKS Workload, Node group infra, ECR, EFS, Pod Identity
│   ├── 05-layer-21-cluster-observability.md           # EKS Observability, S3 Mimir/Loki, Internal ALB SG
│   └── 06-custom-networking-lab-session.md            # Custom Networking canary lab on the existing eks-workload cluster
│
├── 01-platform-addons/                                # PLATFORM ADD-ONS & GITOPS
│   ├── 01-gitops-bootstrap-order.md                   # Add-on deployment sequence, Sync waves, Helm vs ArgoCD
│   ├── 02-aws-load-balancer-controller.md             # LBC Controller, target-type IP, Ingress Grouping
│   ├── 03-cert-manager-and-internal-tls.md            # Internal Private CA, ALB TLS Certificate, ACM Import
│   ├── 04-rancher-multi-cluster.md                    # Rancher v2.14.3, Internal NLB TCP Passthrough
│   └── 05-admin-ingress-and-hardening.md              # admin-ingress.yaml single ALB (ArgoCD, Prometheus, JavaMelody)
│
├── 02-karpenter/                                      # CLUSTER AUTOSCALING (KARPENTER)
│   ├── 01-karpenter-two-halves-architecture.md        # AWS Infra side (Terraform) vs In-cluster side (Helm CRDs)
│   ├── 02-ec2nodeclass-and-nodepools-configuration.md # EC2NodeClass (AL2023), 4 NodePools (ms-od, ms-spot, batch, arm64)
│   ├── 03-on-demand-spot-ratio-and-limits.md          # 1:3 On-Demand:Spot pairing technique, limits.cpu analysis
│   └── 04-disruption-and-spot-interruption.md         # Disruption policy, SQS Interruption queue, 5 EventBridge rules
│
├── 03-observability/                                  # CENTRALIZED OBSERVABILITY PIPELINE
│   ├── 01-observability-architecture-overview.md      # Data flow: Workload -> Internal ALB -> Mimir/Loki -> S3
│   ├── 02-mimir-metrics-pipeline.md                   # Mimir Distributed v6.1.0, Prometheus remote_write, 6 config fixes
│   ├── 03-loki-logging-pipeline.md                    # Loki v7.3.0, Grafana Alloy DaemonSet (River syntax), lab tuning
│   └── 04-grafana-dashboards.md                       # Grafana v10.5.15, multi-tenancy, Datasources & Dashboards
│
├── 04-apps-shopnow/                                   # SHOPNOW MICROSERVICES & ARGO ROLLOUTS
│   ├── 01-shopnow-microservices-architecture.md       # Spring Cloud Stack (Eureka, Config, Product, Cart, User, DB)
│   ├── 02-shopnow-api-gateway.md                      # Spring Cloud Gateway, PrefixPath=/api routing, Keycloak JWT
│   ├── 03-blue-green-argo-rollouts.md                 # Argo Rollouts frontend, activeService vs previewService
│   └── 04-docker-build-multi-arch-and-ci.md           # Docker buildx linux/amd64 on Apple Silicon, build ARG
│
├── 05-security/                                       # SECURITY & ENTERPRISE COMPLIANCE
│   ├── 01-eks-pod-identity.md                         # Pod Identity vs IRSA, Pod Identity Agent, IAM Associations
│   ├── 02-sts-tokens-and-access-entries.md            # STS Bearer Token, TTL, EKS Access Entries replacing aws-auth
│   ├── 03-secrets-management-and-rotation.md          # KMS Envelope Encryption, External Secrets Operator (ESO)
│   └── 04-tls-certificate-lifecycle.md                # cert-manager lifecycle, ACM Private CA vs Manual Re-import
│
├── 06-operations/                                     # OPERATIONS, TROUBLESHOOTING & RUNBOOKS
│   ├── 01-tokyo-region-migration-runbook.md           # Tokyo region migration runbook (ap-northeast-1), 20-21 loop
│   ├── 02-master-incident-catalogue.md                # Comprehensive catalogue of 32 real-world incidents
│   ├── 03-system-verification-and-diagnostics.md      # CLI diagnostics, remote_write testing, log queries, rollouts
│   └── 04-workload-autoscaling-implementation-and-testing.md # HPA/CPA/KEDA step-by-step deploy + load-test runbook
│
├── 07-workload-autoscaling-hpa-cpa-keda.md            # HPA/CPA/KEDA deep-dive: mechanism, gaps, adoption path
└── 08-service-mesh-and-istio.md                       # Service Mesh & Istio research: sidecar vs ambient, platform fit, adoption roadmap
```

---

## Infrastructure Summary

| Feature | Cluster 1 (`eks-workload`) | Cluster 2 (`eks-observability`) |
|---|---|---|
| **Purpose** | ShopNow Microservices & Platform Add-ons | Centralized Metrics, Logs & Dashboard Storage |
| **EKS Version** | `1.34` (platform `eks.31`) | `1.34` (platform `eks.31`) |
| **Base Node Group** | `infra`: 3× `t3.large` (On-Demand, untainted) | `monitoring`: 2× `t3.medium` (On-Demand) |
| **Autoscaler** | Karpenter v1.14.0 (Controller + 4 NodePools) | Fixed Managed Node Group |
| **Node Subnets** | `10.20.16.0/20`, `10.20.32.0/20`, `10.20.48.0/20` | `10.20.64.0/20`, `10.20.80.0/20`, `10.20.96.0/20` |
| **Discovery Tag** | `karpenter.sh/discovery = eks-workload` | `karpenter.sh/discovery = eks-observability` |
| **Storage** | AWS EBS (gp3), AWS EFS Shared Filesystem | AWS S3 (Mimir & Loki Buckets, gp3 PVCs) |
| **IAM Auth Mode** | EKS Pod Identity (EBS, EFS, LBC, Karpenter) | EKS Pod Identity (EBS, LBC, Mimir, Loki) |

---

## Quick Start Guide

1. **Bootstrap Terraform backend**:
   Read [docs/00-architecture/02-organizational-constraints-and-prerequisites.md](00-architecture/02-organizational-constraints-and-prerequisites.md) and execute [scripts/bootstrap-backend.sh](https://github.com/tranvix0910/eks-core-terraform/blob/main/scripts/bootstrap-backend.sh).
2. **Deploy network and EKS clusters**:
   Follow the sequence: [10-network](00-architecture/03-layer-10-network.md) -> [20-cluster-workload](00-architecture/04-layer-20-cluster-workload.md) -> [21-cluster-observability](00-architecture/05-layer-21-cluster-observability.md).
3. **Install Platform Add-ons & Autoscaling**:
   Follow [docs/01-platform-addons/01-gitops-bootstrap-order.md](01-platform-addons/01-gitops-bootstrap-order.md) and [docs/02-karpenter/01-karpenter-two-halves-architecture.md](02-karpenter/01-karpenter-two-halves-architecture.md).
4. **Deploy ShopNow App & Blue-Green Rollout**:
   Follow [docs/04-apps-shopnow/03-blue-green-argo-rollouts.md](04-apps-shopnow/03-blue-green-argo-rollouts.md).

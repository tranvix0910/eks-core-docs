# EKS Core — Master Platform Overview & Architecture

> **Document Status (Updated 2026-08-14)**: This document is written and verified directly from the **active state** via AWS APIs, `kubectl`, and the complete codebase. The entire infrastructure has been successfully migrated to the AWS Tokyo region (`ap-northeast-1`).
>
> 💡 The documentation is organized into modular sections under the [docs/](https://github.com/tranvix0910/eks-core-docs/tree/main/docs) directory.

---

## Table of Contents

- [1. Theory & Core Architecture](#1-theory--core-architecture)
- [2. Organizational Constraints & Prerequisites](#2-organizational-constraints--prerequisites)
- [3. Layer 10: Network](#3-layer-10-network)
- [4. Layer 20: EKS Workload Cluster](#4-layer-20-eks-workload-cluster)
- [5. Layer 21: EKS Observability Cluster](#5-layer-21-eks-observability-cluster)
- [6. GitOps Bootstrap & Add-on Order](#6-gitops-bootstrap--add-on-order)
- [7. Observability Stack & Data Flow](#7-observability-stack--data-flow)
- [8. Rancher Multi-Cluster Management](#8-rancher-multi-cluster-management)
- [9. ShopNow Application & Blue-Green Rollouts](#9-shopnow-application--blue-green-rollouts)
- [10. Access & Security](#10-access--security)
- [11. Master Incident Catalogue](#11-master-incident-catalogue)
- [12. Current Platform Status](#12-current-platform-status)

---

## 1. Theory & Core Architecture

Detailed guide: [docs/00-architecture/01-architecture-overview.md](00-architecture/01-architecture-overview.md)

* **Problem Statement**: Run the e-commerce microservices demo `shopnow` (Spring Cloud backend + React frontend) on Kubernetes, backed by a centralized observability system (Mimir, Loki, Grafana) in AWS account `<AWS_ACCOUNT_ID>`.
* **2 Clusters in 1 Shared VPC (`10.20.0.0/16`)**:
  * `eks-workload`: Runs business workloads and operational platform controllers (ArgoCD, Karpenter, cert-manager, Rancher, Prometheus, Alloy).
  * `eks-observability`: Ingests, stores, and visualizes monitoring data (Mimir TSDB on S3, Loki Logs on S3, Grafana Web UI).
* **Ownership Boundaries**:
  * **Terraform**: Owns all AWS resources (VPC, Subnets, Control Planes, Managed Node Groups `infra`/`monitoring`, IAM, EKS Pod Identity, S3, ECR, EFS, Security Groups).
  * **GitOps (ArgoCD & Helm)**: Owns all in-cluster resources (Karpenter NodePools, Ingresses, Addons, Microservices Deployments & Rollouts).

---

## 2. Organizational Constraints & Prerequisites

Detailed guide: [docs/00-architecture/02-organizational-constraints-and-prerequisites.md](00-architecture/02-organizational-constraints-and-prerequisites.md)

* **SCP `<SCP_POLICY_ID>`**: Explicit Deny on `eks:*` and `elasticfilesystem:*` in all AWS regions EXCEPT `ap-southeast-1`, `ap-southeast-5`, and `ap-northeast-1` (Tokyo).
* **VPC Flow Logs**: Mandatory by AWS Config, deletion explicitly denied by SCP. Use `terraform state rm` when migrating between VPCs.
* **Standard Profile**: `eks-core` with default region `ap-northeast-1`.

---

## 3. Layer 10: Network

Detailed guide: [docs/00-architecture/03-layer-10-network.md](00-architecture/03-layer-10-network.md)

* VPC CIDR: `10.20.0.0/16` (3 AZs: `1a`, `1c`, `1d`).
* Subnets: 3 Public (`/24`), 3 Private Workload (`10.20.16/32/48.0/20`), 3 Private Observability (`10.20.64/80/96.0/20`).
* Single shared NAT Gateway (`single_nat_gateway = true`).
* Separate Karpenter discovery tags: `karpenter.sh/discovery = eks-workload` vs `eks-observability`.

---

## 4. Layer 20: EKS Workload Cluster

Detailed guide: [docs/00-architecture/04-layer-20-cluster-workload.md](00-architecture/04-layer-20-cluster-workload.md)

* EKS K8s 1.34; Managed Node Group `infra` (3× `t3.large`, On-Demand, role=infra, untainted).
* AWS-side Karpenter: IAM Role `Karpenter-eks-workload`, SQS Queue, 5 EventBridge rules, EKS Access Entry.
* EKS Pod Identity Associations: EBS CSI, EFS CSI, AWS LB Controller, Karpenter (`kube-system/karpenter`).
* ECR (6 repositories) & EFS Shared Filesystem.

---

## 5. Layer 21: EKS Observability Cluster

Detailed guide: [docs/00-architecture/05-layer-21-cluster-observability.md](00-architecture/05-layer-21-cluster-observability.md)

* EKS K8s 1.34; Managed Node Group `monitoring` (2× `t3.medium`, On-Demand, role=monitoring).
* 2 S3 Buckets: `eks-observability-mimir-<AWS_ACCOUNT_ID>` and `eks-observability-loki-<AWS_ACCOUNT_ID>` (30-day lifecycle).
* 2-hop Security Group for Internal ALB (Port 9009 Mimir, Port 3100 Loki, Port 8080 Target Pods).
* Route53 Private Hosted Zone `observability.internal` and ACM TLS Certificate import.

---

## 6. GitOps Bootstrap & Add-on Order

Detailed guide: [docs/01-platform-addons/01-gitops-bootstrap-order.md](01-platform-addons/01-gitops-bootstrap-order.md)

Standard deployment sequence on `eks-workload`:
1. AWS Load Balancer Controller.
2. Karpenter Controller v1.14.0 (namespace `kube-system`) -> Apply `EC2NodeClass` & 4 `NodePools`.
3. cert-manager v1.21.1 -> Initialize internal CA and TLS certificate.
4. ArgoCD v10.3.0 (with Rollouts UI Extension) + Argo Rollouts v1.9.0 Controller.
5. Rancher v2.14.3 + Internal NLB Service (TCP passthrough).
6. Prometheus Agent & Grafana Alloy DaemonSet.
7. Admin Ingress single Public ALB ([admin-ingress.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/ingress/admin-ingress.yaml)).

---

## 7. Observability Stack & Data Flow

Detailed guide: [docs/03-observability/01-observability-architecture-overview.md](03-observability/01-observability-architecture-overview.md)

* Prometheus Agent `remote_write` -> `https://mimir.observability.internal:9009` (Header `X-Scope-OrgID: eks-workload`) -> Mimir Gateway -> Ingester -> S3.
* Grafana Alloy (River config `//`) -> `https://loki.observability.internal:3100` -> Loki Gateway -> Ingester -> S3.
* Grafana UI (Port 80 Public ALB) queries Mimir and Loki via internal K8s Services.

---

## 8. Rancher Multi-Cluster Management

Detailed guide: [docs/01-platform-addons/04-rancher-multi-cluster.md](01-platform-addons/04-rancher-multi-cluster.md)

* Uses **Internal NLB TCP Passthrough** (`rancher-internal-nlb`) to preserve raw TLS handshake and validate `--ca-checksum` for `cattle-cluster-agent`.
* Human Web UI access via `kubectl port-forward -n cattle-system svc/rancher 8443:443` to ensure `Secure` session cookies work properly.

---

## 9. ShopNow Application & Blue-Green Rollouts

Detailed guide: [docs/04-apps-shopnow/01-shopnow-microservices-architecture.md](04-apps-shopnow/01-shopnow-microservices-architecture.md)

* **ShopNow API Gateway** (Port 5860): Spring Cloud Gateway routing `/product/**`, `/shopping-cart/**`, `/user/**` with `PrefixPath=/api`, integrated with Eureka and Keycloak JWT.
* **ShopNow Frontend** (Port 8082): Deployed as **Argo Rollouts Blue-Green** with `activeService` and `previewService`. Dockerfile build argument `REACT_APP_BASE_API_URL` solves React home crash.

---

## 10. Access & Security

Detailed guide: [docs/05-security/01-eks-pod-identity.md](05-security/01-eks-pod-identity.md) & [docs/01-platform-addons/05-admin-ingress-and-hardening.md](01-platform-addons/05-admin-ingress-and-hardening.md)

* All ServiceAccounts use **EKS Pod Identity**.
* API Server auth via **EKS Access Entries**.
* Admin Ingress aggregates ArgoCD (80), Prometheus (9090), Alertmanager (9093), JavaMelody (8081) on 1 Public ALB (lab tradeoff `0.0.0.0/0`).

---

## 11. Master Incident Catalogue

All 32 verified real-world incidents are documented in:
[docs/06-operations/02-master-incident-catalogue.md](06-operations/02-master-incident-catalogue.md)

---

## 12. Current Platform Status

| Layer / Component | Status | Notes |
|---|---|---|
| **Layer 10: Network** | ✅ Complete | VPC `<VPC_ID>` in Tokyo (`ap-northeast-1`). |
| **Layer 20: Workload Cluster** | ✅ Complete | `eks-workload` Active, 3 `infra` nodes Ready, ECR & EFS ready. |
| **Layer 21: Observability Cluster** | ✅ Complete | `eks-observability` Active, 2 `monitoring` nodes Ready, S3 Buckets ready. |
| **Karpenter Autoscaling** | ✅ Complete | Controller v1.14.0 in `kube-system`, EC2NodeClass & 4 NodePools ready. |
| **GitOps & Core Add-ons** | ✅ Complete | AWS LB Controller, cert-manager, ArgoCD + Rollouts Extension, Rancher NLB active. |
| **Observability Pipeline** | ✅ Complete | Mimir, Loki, Alloy, Grafana configured and tuned for lab scale. |
| **ShopNow Microservices** | ✅ Complete | Databases, API Gateway (5860), 5 Spring services, Frontend Blue-Green Rollout operational. |

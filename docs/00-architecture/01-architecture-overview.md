# Overall Architecture — EKS Core Platform

This document describes the high-level architecture of the **EKS Core Platform**, the rationale behind every major infrastructure decision, the data flow topology, and the ownership boundaries between Terraform and GitOps.

---

## 1. Problem Statement & Objectives

The platform hosts an e-commerce microservices demo (**ShopNow**, consisting of 6 Spring Cloud / Spring Boot backend services and a React web frontend) alongside a centralized observability system (**Mimir, Loki, Grafana**).

* **AWS Account**: `<AWS_ACCOUNT_ID>`
* **Target Region**: `ap-northeast-1` (Tokyo, across 3 Availability Zones: `1a`, `1c`, `1d`).
* **Core Foundation**: 2 Amazon EKS clusters (Kubernetes v1.34) in a shared Virtual Private Cloud (VPC).

---

## 2. Core Architectural Decisions

### 2.1 — Why Two Clusters (`eks-workload` vs `eks-observability`)
* **`eks-workload`**: Runs all business microservices (`shopnow`) and operational controllers (ArgoCD, Argo Rollouts, Karpenter, Rancher, cert-manager, Prometheus Agent, Grafana Alloy).
* **`eks-observability`**: Dedicated strictly to receiving, storing, and visualizing telemetry data (Grafana Mimir, Grafana Loki, Grafana Dashboards).
* **Isolation Principle**: If observability runs in the same cluster as the workload, a major cluster failure (node exhaustion, catastrophic OOM loops, control plane degradation, or accidental namespace deletion) destroys the telemetry system itself — **losing visibility exactly when it is needed most**. Isolating observability into a dedicated cluster ensures Mimir, Loki, and Grafana survive independently of any incident on Cluster 1.

### 2.2 — Why One Shared VPC (`10.20.0.0/16`) Instead of Two
* **Cost & Resource Optimization**: Shares **1 NAT Gateway** (or 3 in HA) and Elastic IPs across both clusters instead of doubling NAT Gateway costs (~$65/month savings in lab environments).
* **Simple In-VPC Communication**: No VPC Peering, Transit Gateway, or PrivateLink overhead. Metric `remote_write` and log `push` streams travel directly over internal Security Group rules to the Internal Application Load Balancer (ALB).
* **Network Segmentation**: Despite sharing a VPC, the two clusters operate on distinct subnets (`10.20.16-48.0/20` for Workload and `10.20.64-96.0/20` for Observability) with independent route tables.

### 2.3 — Why NO Secondary Pod CIDR (`100.64.0.0/10`)
* An earlier draft proposed VPC CNI Custom Networking (`AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG` + per-AZ `ENIConfig`).
* **Why it was dropped**: Custom networking costs the primary ENI of each EC2 node for routing instead of assigning Pod IPs — resulting in ~30% fewer Pods per Node. Meanwhile, each node subnet is already a `/20` (4,091 usable IPs). Combined with **VPC CNI Prefix Delegation**, IP capacity is vastly sufficient. Secondary CIDRs can be attached to a running VPC non-disruptively at any time if ever needed.

### 2.4 — Why Karpenter Over Cluster Autoscaler
* Karpenter selects instances dynamically based on Pod hardware constraints (CPU, memory, architecture, category) rather than predefined Auto Scaling Groups (ASGs).
* Rapid node provisioning and intelligent bin-packing / consolidation (seconds instead of minutes).
* Enables sophisticated multi-pool strategies combining On-Demand and Spot instances.

### 2.5 — Why EKS Pod Identity Over IRSA
* **EKS Pod Identity** is the modern AWS standard replacing IRSA (IAM Roles for Service Accounts):
  * No OIDC Identity Provider setup required.
  * No complex OIDC trust policy conditions based on ServiceAccount ARNs.
  * Single declarative mapping (`aws_eks_pod_identity_association`).
  * Injected seamlessly into Pods via the `eks-pod-identity-agent` DaemonSet.

---

## 3. Ownership Boundary: Terraform vs GitOps / ArgoCD

The project enforces strict ownership boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TERRAFORM (AWS Infrastructure & Cloud Resources)                       │
│  - VPC, Subnets, Route Tables, NAT Gateway, Internet Gateway           │
│  - EKS Control Planes (Workload & Observability v1.34)                 │
│  - Base Managed Node Groups (infra & monitoring)                       │
│  - IAM Roles, Policies, EKS Pod Identity Associations                  │
│  - S3 Buckets (Mimir, Loki), EFS Filesystem, ECR Repositories          │
│  - Security Groups, Route53 Private Hosted Zone, ACM Certificates      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Hands over clean EKS clusters
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GITOPS / ARGOCD & HELM (In-Cluster Kubernetes Resources)               │
│  - Karpenter Controller, CRDs, EC2NodeClass & 4 NodePools              │
│  - Platform Add-ons: AWS LB Controller, cert-manager, Rancher, ESO     │
│  - Observability Agents & Stack: Prometheus, Alloy, Mimir, Loki        │
│  - Ingress Manifests & StorageClasses                                  │
│  - Microservices (ShopNow Backend & Frontend Argo Rollouts)            │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **Strict Rule**: Do not use Terraform's `kubernetes` or `kubectl` providers to apply bulk manifests or Helm releases. These providers depend on cluster credentials while Terraform is still creating the cluster, breaking `terraform plan` before the cluster exists and causing `Provider configuration not present` errors on `destroy`.

---

## 4. End-to-End Architecture Diagram

```
                      VPC eks-lab (10.20.0.0/16, ap-northeast-1)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                                                                              │
 │  ┌──────────────────────────────┐          ┌──────────────────────────────┐  │
 │  │ Cluster: eks-workload        │          │ Cluster: eks-observability   │  │
 │  │ (Subnets: 10.20.16-48.0/20)  │          │ (Subnets: 10.20.64-96.0/20)  │  │
 │  │                              │          │                              │  │
 │  │  [Node Group: infra (3)]     │          │  [Node Group: monitoring (2)]│  │
 │  │  - ArgoCD / Rollouts         │          │  - Mimir (StatefulSets)      │  │
 │  │  - cert-manager              │          │  - Loki (StatefulSets)       │  │
 │  │  - Karpenter Controller      │          │  - Grafana (Public Web UI)   │  │
 │  │  - Rancher v2.14.3           │          │                              │  │
 │  │  - Prometheus Agent          │          │  [Storage]                   │  │
 │  │  - Grafana Alloy             │          │  - S3 Mimir Bucket (30d)     │  │
 │  │                              │          │  - S3 Loki Bucket (30d)      │  │
 │  │  [Karpenter Dynamic Nodes]   │          │                              │  │
 │  │  - shopnow-backend (6 svcs)  │          │  [Internal ALB]              │  │
 │  │  - shopnow-frontend (Rollout)│          │  - Port 9009 (Mimir)         │  │
 │  │  - shopnow-api-gateway       │          │  - Port 3100 (Loki)          │  │
 │  └──────────────┬───────────────┘          └──────────────┬───────────────┘  │
 │                 │                                         │                  │
 │                 │ HTTPS remote_write / log push           │                  │
 │                 └─────────────────────────────────────────┘                  │
 │                                                                              │
 │  [Shared Network Services]                                                   │
 │  - 1 NAT Gateway (Public Subnet 10.20.0.0/24)                                │
 │  - Route53 Private Zone: observability.internal                              │
 └──────────────────────────────────────────────────────────────────────────────┘
```

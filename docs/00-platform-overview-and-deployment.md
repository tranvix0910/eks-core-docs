---
title: "Workshop roadmap"
sidebar_label: "Roadmap and requirements"
---

# Workshop roadmap

This page lists **what the workshop asks for**, **where each requirement is implemented**, and **the order of the steps**. Read it once, then follow the steps from top to bottom.

## The assignment

**Cluster 1 — Workload**

1. A **Managed Node Group** runs the infrastructure tools: Prometheus, JavaMelody, Karpenter, ArgoCD.
2. **Three Karpenter node pools**:
   - Pool 1 — Spot instances
   - Pool 2 — mixed On-Demand and Spot, ratio **1:3**
   - Pool 3 — ARM64
3. The microservices run on **pool 2**.
4. The microservices use **persistent volumes from EFS**.
5. Containers are **spread evenly across worker nodes** (Pod Topology Spread Constraints / Pod Anti-Affinity).
6. A **PodDisruptionBudget** protects availability.
7. The microservices are deployed **through ArgoCD**.

**Cluster 2 — Observability**

8. Centralized observability: Prometheus-compatible metrics, Grafana, Loki.
9. Metrics and logs from cluster 1 are **shipped to cluster 2**.

## How each requirement is implemented

| # | Requirement | Implementation | Step that builds it | How you prove it |
|---|---|---|---|---|
| 1 | Infra Managed Node Group | EKS Managed Node Group `infra` (label `role=infra`, taint `CriticalAddonsOnly`); every platform chart uses `nodeSelector: role=infra` plus the matching toleration, so application Pods cannot land there | [1.2](architecture/layer-20-cluster-workload), [2.1](platform-addons/gitops-bootstrap-order) | Prometheus, JavaMelody, Karpenter and ArgoCD Pods all run on `role=infra` nodes |
| 2 | Spot pool | NodePool `batch-spot` (`capacity-type=spot`) | [2.2](karpenter/ec2nodeclass-and-nodepools-configuration) | A test Pod lands on a Spot node from `batch-spot` |
| 2 | Mixed pool 1:3 | NodePools `ms-od` (On-Demand, 24 vCPU, weight 100) + `ms-spot` (Spot, 72 vCPU, weight 10) sharing one label and taint | [2.2](karpenter/ec2nodeclass-and-nodepools-configuration), [2.3](karpenter/on-demand-spot-ratio-and-limits) | Capacity report shows On-Demand vs Spot nodes and vCPU |
| 2 | ARM64 pool | NodePool `arm64` (`kubernetes.io/arch=arm64`) | [2.4](karpenter/arm64-validation) | `uname -m` returns `aarch64` on an `arm64` node |
| 3 | Microservices on pool 2 | Backend and frontend values: `nodeSelector: workload=microservices` + matching toleration | [3.2](apps-shopnow/shopnow-end-to-end-deployment-guide) | Every backend and frontend Pod is on an `ms-od` or `ms-spot` node |
| 4 | EFS persistent volumes | EFS file system + EFS CSI driver + StorageClass `efs-sc`; one `ReadWriteMany` PVC per service mounted at `/data` | [1.2](architecture/layer-20-cluster-workload), [3.3](apps-shopnow/efs-persistent-volumes) | Two replicas read the same file; the file survives Pod replacement |
| 5 | Even distribution | `topologySpreadConstraints` on zone and hostname, `maxSkew: 1` | [3.4](apps-shopnow/pod-placement) | Pod → node → zone table with skew ≤ 1 |
| 6 | PodDisruptionBudget | `maxUnavailable: 1` for every service with two replicas (API gateway, config server, product, cart, user); a 2-of-3 PDB on the proof workload. `discovery-server` and the frontend run one replica, so they have no PDB and no spread | [3.5](apps-shopnow/availability-and-pdb) | An eviction is refused when the budget is 0 and allowed when it is 1 |
| 7 | Deploy through ArgoCD | One ArgoCD Application per service, reading Helm charts from `eks-core-gitops` | [3.2](apps-shopnow/shopnow-end-to-end-deployment-guide) | Every Application is `Synced` and `Healthy` |
| 8 | Centralized observability | Cluster 2 runs Mimir, Loki and Grafana on S3 storage | [1.3](architecture/layer-21-cluster-observability) | Receiver Pods Ready, Grafana reachable |
| 9 | Ship telemetry 1 → 2 | Prometheus `remote_write` → Mimir; Alloy DaemonSet → Loki; over an internal ALB with private DNS and TLS | [4.1–4.4](observability/observability-architecture-overview) | A new cluster 1 metric and log line are queryable in cluster 2 Grafana |

## Steps

| Step | What you do | Result |
|---|---|---|
| **0.1** [Prerequisites and setup](architecture/organizational-constraints-and-prerequisites) | Install tools, clone the repos, set variables, create the state bucket | You can run Terraform against your account |
| **0.2** [Architecture](architecture/architecture-overview) | Read the target design | You know what runs where |
| **1.0** [Terraform workflow](architecture/terraform-workflow) | Learn the layer order and the plan/apply loop | — |
| **1.1** [Network](architecture/layer-10-network) | `terraform apply` layer `10-network` | VPC and subnets for both clusters |
| **1.2** [Cluster 1](architecture/layer-20-cluster-workload) | Apply layer `20-cluster-workload` (foundation) | `eks-workload`, infra nodes, EFS, ECR |
| **1.3** [Cluster 2](architecture/layer-21-cluster-observability) | Apply layer `21-cluster-observability`, then finish layer 20 | `eks-observability`, Mimir, Loki, Grafana; cluster 1 add-ons |
| **2.1** [Platform add-ons](platform-addons/gitops-bootstrap-order) | Verify Terraform-installed tools, add cert-manager and JavaMelody | All infra tools on the Managed Node Group |
| **2.2** [Three node pools](karpenter/ec2nodeclass-and-nodepools-configuration) | Apply EC2NodeClass and NodePools, test Spot | Spot, mixed and ARM64 pools ready |
| **2.3** [Mixed pool 1:3](karpenter/on-demand-spot-ratio-and-limits) | Measure the On-Demand:Spot ratio | Ratio report |
| **2.4** [ARM64](karpenter/arm64-validation) | Run an ARM64 container | Proof of ARM64 capacity |
| **2.5** [Kite dashboard](platform-addons/kite-dashboard) | Open the cluster dashboard, optionally through the admin ALB | A web UI for cluster 1 |
| **3.1** [Build images](apps-shopnow/docker-build-multi-arch-and-ci) | Build and push seven images | Images in ECR |
| **3.2** [Deploy with ArgoCD](apps-shopnow/shopnow-end-to-end-deployment-guide) | Create the ArgoCD Applications | Microservices running on pool 2 |
| **3.3** [EFS](apps-shopnow/efs-persistent-volumes) | Write and read a shared file | Storage proof |
| **3.4** [Even distribution](apps-shopnow/pod-placement) | Check spreading per service | Placement table |
| **3.5** [PDB](apps-shopnow/availability-and-pdb) | Test evictions against the budget | Availability proof |
| **4.1** [TLS and private DNS](platform-addons/cert-manager-and-internal-tls) | Connect the clusters privately | Internal endpoint for Mimir and Loki |
| **4.2** [Metrics → Mimir](observability/mimir-metrics-pipeline) | Verify remote_write | Cluster 1 metrics in cluster 2 |
| **4.3** [Logs → Loki](observability/loki-logging-pipeline) | Install Alloy | Cluster 1 logs in cluster 2 |
| **4.4** [Grafana](observability/grafana-dashboards) | Query both datasources | One place to observe cluster 1 |
| **5.1** [Acceptance](operations/workshop-acceptance) | Fill the checklist | Requirement-by-requirement evidence |
| **5.2** [Day-2 and cleanup](operations/lifecycle-and-cleanup) | Make a change, roll back, destroy | You can operate and remove the platform |

Plan for a full working day for the first run. Most of the waiting is EKS cluster creation (about 15 minutes per cluster) and Karpenter launching nodes.

## Cost {#cost}

Estimated On-Demand prices in `ap-northeast-1` (Tokyo), before tax and free credits:

| Resource | Quantity | USD per hour |
|---|---|---|
| EKS control plane ($0.10/h) | 2 clusters | 0.20 |
| Infra node group, `t3.large` ($0.1088/h) | 3 nodes | 0.33 |
| Observability node group, `t3.medium` ($0.0544/h) | 2 nodes | 0.11 |
| NAT gateway ($0.062/h + $0.062/GB) | 1 | 0.06 |
| Application Load Balancer ($0.0243/h + LCU) | 2 (admin, internal) | 0.05 |
| Public IPv4 addresses ($0.005/h) | about 4 | 0.02 |
| **Baseline once Terraform is applied** | | **≈ 0.77** |
| Karpenter nodes for the labs and the application (Spot is cheaper) | 3–5 nodes | ≈ 0.3–0.6 |

EBS, EFS, S3, ECR and data transfer add a few cents per hour at workshop scale. **One working day (about 8 hours) costs roughly USD 10–15.** Left running, the baseline alone is about USD 18 per day, so run [cleanup](operations/lifecycle-and-cleanup) the same day.

:::note
These are estimates from the AWS price list; check the [AWS Pricing Calculator](https://calculator.aws/) for your region and account. Credits or the Free Tier lower the bill.
:::

## Conventions used in every step

- Each page starts with a box showing the **goal**, the **requirement** it covers, and **which repository** the commands run from.
- Commands are Bash. Every `kubectl` command passes `--context eks-workload` or `--context eks-observability`, so you never act on the wrong cluster.
- Paths use the variables from [step 0.1](architecture/organizational-constraints-and-prerequisites): `$TF_DIR`, `$GITOPS_DIR`, `$APPS_DIR`, `$PLAN_DIR`, `$EVIDENCE_DIR`.
- A **Verify** section closes every step. Do not move on until it passes.

:::warning Cost
The workshop creates billable resources: two EKS control planes, EC2 nodes, a NAT gateway, EFS, load balancers and S3. Follow [cleanup](operations/lifecycle-and-cleanup) when you are done.
:::

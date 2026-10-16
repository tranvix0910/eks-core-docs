# EKS Workshop — documentation sources

The published site is **https://tranvix0910.github.io/eks-core-docs/**. Start there.

The workshop builds two EKS clusters with Terraform: a workload cluster with an infra Managed Node Group, three Karpenter pools (Spot, mixed On-Demand/Spot 1:3, ARM64) and ArgoCD-deployed microservices on EFS with topology spread and PodDisruptionBudgets; and an observability cluster that receives its metrics (Mimir) and logs (Loki) and shows them in Grafana.

| Module | Pages |
|---|---|
| 0 · Before you start | `00-platform-overview-and-deployment.md`, `00-architecture/02-…prerequisites.md`, `00-architecture/01-architecture-overview.md` |
| 1 · Infrastructure with Terraform | `00-architecture/00-terraform-workflow.md`, `03-layer-10-network.md`, `04-layer-20-cluster-workload.md`, `05-layer-21-cluster-observability.md` |
| 2 · Platform on cluster 1 | `01-platform-addons/01-gitops-bootstrap-order.md`, `02-karpenter/02…`, `03…`, `05…` |
| 3 · Microservices | `04-apps-shopnow/04…`, `00…`, `05…`, `06…`, `07…` |
| 4 · Centralized observability | `03-observability/01…`, `01-platform-addons/03…`, `03-observability/02…`, `03…`, `04…` |
| 5 · Accept and operate | `06-operations/06-workshop-acceptance.md`, `05-lifecycle-and-cleanup.md`, `02-master-incident-catalogue.md` |

Everything else is an optional extension or reference page. The sidebar order is defined in `../sidebars.js`.

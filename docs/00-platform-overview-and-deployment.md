---
title: "Start the workshop: build and operate a microservices platform"
---

# What will you build?

:::info Where the files live
The platform is split across four repositories. Paths in these guides are relative to the root of the repository that owns them:

| Paths | Repository |
|---|---|
| `10-network/`, `20-cluster-workload/`, `21-cluster-observability/`, `scripts/bootstrap-backend.sh` | [eks-core-terraform](https://github.com/tranvix0910/eks-core-terraform) |
| `platform/`, `apps/*-config/`, `examples/workshop/`, `labs/` | [eks-core-gitops](https://github.com/tranvix0910/eks-core-gitops) |
| `shopnow-*/` service source, `scripts/build-images.sh` | [eks-core-apps](https://github.com/tranvix0910/eks-core-apps) |
| `docs/` | [eks-core-docs](https://github.com/tranvix0910/eks-core-docs) |

Clone them side by side (for example under `~/eks-core/`); the Terraform layers read Helm values from `../eks-core-gitops`.
:::

This workshop walks you through building an environment for microservices on Amazon EKS and proving that it meets deployment, storage, availability, and monitoring requirements. You start with Terraform, deploy applications through ArgoCD, create workloads that trigger Karpenter provisioning, verify EFS data after replacing a Pod, and find the resulting metrics and logs in the monitoring cluster.

The deliverable is **a reproducible system backed by test evidence**, beyond two clusters reporting `ACTIVE`.

## Requirements and acceptance evidence

| Requirement | Workshop implementation | Evidence to collect |
|---|---|---|
| Two EKS clusters | `eks-workload` and `eks-observability` | AWS descriptions of both clusters; Ready nodes in each context |
| Managed Node Group for infrastructure | `infra` group; controllers select `role=infra` | ArgoCD, Prometheus, JavaMelody, and Karpenter run on infra nodes |
| Group 1 uses Spot only | `batch-spot` NodePool | Test Pod runs on a node labeled capacity-type `spot` |
| Group 2 mixes On-Demand and Spot | `ms-od` and `ms-spot` NodePools share `workload=microservices` | Classify actual capacity and report node/vCPU ratios |
| Group 3 uses ARM64 | `arm64` NodePool | Container runs successfully; node architecture is `arm64` |
| Microservices run on group 2 | Backend chart `nodeSelector` and toleration | Pods stay off infra, batch, and ARM64 nodes |
| Microservices use EFS-backed PVs | EFS CSI, `efs-sc`, and `ReadWriteMany` PVCs | Two replicas read a shared file; file survives Pod replacement |
| Replica distribution | Topology Spread across zones and hostnames | Pod → node → zone table; check distribution skew |
| Availability during maintenance | Multiple replicas, PDB, and readiness | Eviction respects the budget; application remains responsive |
| GitOps | ArgoCD reads charts and values from Git | Application `Synced`/`Healthy`; changes delivered through commits |
| Centralized monitoring | Prometheus/Alloy in cluster 1 send to Mimir/Loki in cluster 2; Grafana queries centrally | Query returns `cluster="eks-workload"` and a new log marker |

**The three node groups describe three workload purposes, rather than three fixed EC2 instances.** The mixed group is split into two objects, so the repository contains four `NodePool` resources. The 24/72 vCPU limits express a 1:3 maximum capacity budget; they do not force a constant 1:3 node count. The [ratio lab](02-karpenter/03-on-demand-spot-ratio-and-limits.md) includes a separate test to distinguish these meanings.

## Learning path

Follow the sequence on your first deployment. Each lab has a completion gate; resolve a failed gate before continuing.

| Step | Lab | Output |
|---|---|---|
| 0 | [Prepare](00-architecture/02-organizational-constraints-and-prerequisites.md) | Tools, AWS identity, state backend, environment variables |
| 1 | [Create the network](00-architecture/03-layer-10-network.md) | VPC, subnets, NAT, endpoint, discovery tags |
| 2 | [Create the workload cluster](00-architecture/04-layer-20-cluster-workload.md) | EKS, infra nodes, IAM, EFS, ECR |
| 3 | [Create the observability cluster](00-architecture/05-layer-21-cluster-observability.md) | EKS, monitoring nodes, S3, receiver services |
| 4 | [Bootstrap the platform](01-platform-addons/01-gitops-bootstrap-order.md) | Controllers, StorageClasses, JavaMelody, clear ownership |
| 5 | [Configure node groups](02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md) | EC2NodeClass, Spot, mixed, ARM64 |
| 6 | [Build images](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md) → [ArgoCD](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md) | ShopNow running on the mixed pool |
| 7 | [EFS](04-apps-shopnow/05-efs-persistent-volumes.md) → [Pod placement](04-apps-shopnow/06-pod-placement.md) → [PDB](04-apps-shopnow/07-availability-and-pdb.md) | Storage and availability evidence |
| 8 | [TLS and telemetry](01-platform-addons/03-cert-manager-and-internal-tls.md) → [Centralized monitoring](03-observability/01-observability-architecture-overview.md) | Cluster 1 metrics and logs accessible in cluster 2 |
| 9 | [Acceptance](06-operations/06-workshop-acceptance.md) → [Management and cleanup](06-operations/05-lifecycle-and-cleanup.md) | Results report and managed resources |

## Reading and running commands

Commands start at the repository root and use Bash. If your default terminal shell is Zsh, start `bash` and set the variables from the preparation lab. Kubernetes commands specify `--context` to avoid targeting the wrong cluster. Terraform commands use `-chdir` so the current directory does not determine which layer runs.

Account, region, CIDR, and node sizes are **environment settings**. Update them in tfvars and values; they are not prerequisites for understanding the workshop goal. The S3 backend can reside in a different region from the resources.

Distinguish three types of information:

- **Existing code:** what this checkout declares; it does not prove resources exist in AWS.
- **Required changes:** tfvars, values, or manifest edits needed to meet the assignment.
- **Expected results:** mark these complete only after testing in your account.

## Issues to address in this checkout

1. Layer 20 has `efs_create=false` and an empty ECR list: enable them as described in the workload cluster lab before deploying applications.
2. Only the product chart enables persistence by default: add the workshop values to all six backend services.
3. Terraform manages several Helm releases and StorageClasses. Do not install those resources again through Helm CLI or ArgoCD.
4. `try()` around Layer 21 outputs cannot handle a missing remote state. A fresh deployment needs the two-stage foundation procedure in the Layer 20/21 labs.
5. Hostname spread currently uses `ScheduleAnyway`, which is a preference. The placement lab supplies mandatory constraints for acceptance testing when required.
6. The frontend is a React SPA, not Next.js. Blue-green, Rancher, load-based autoscaling, custom networking, and Istio remain extension labs.
7. Some manifests contain endpoints, ARNs, buckets, and role names from the previous environment. Compare them with Terraform outputs before use.

Do not treat numbers, passwords, or URLs recorded in older documentation as current state. This documentation explains how to retrieve them from the running environment.

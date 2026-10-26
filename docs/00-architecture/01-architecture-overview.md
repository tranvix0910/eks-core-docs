---
title: "Step 0.2 — Architecture"
sidebar_label: "0.2 Architecture"
---

# Step 0.2 — Architecture

:::info Step summary
**Goal:** understand what you will build and which tool owns each piece, before running any command.
**Time:** about 10 minutes of reading.
:::

## Kubernetes and EKS at a glance

**Inside a Kubernetes cluster.** Every arrow goes through `kube-apiserver`: the scheduler, controllers and kubelets do not call each other, they read and write state through the API server, and only the API server talks to etcd. `cloud-controller-manager` is the part that calls the cloud provider's APIs.

```mermaid
flowchart TB
  Admin(["Admin · kubectl"])
  AWS(["AWS APIs<br/>EC2 · ELB · EBS"])

  subgraph CP["Control plane"]
    direction LR
    SCH["kube-scheduler"]
    CM["kube-controller-manager"]
    API["kube-apiserver"]
    ETCD[("etcd")]
    CCM["cloud-controller-manager"]
  end

  subgraph DP["Data plane · worker nodes"]
    direction LR
    subgraph N1["Worker node 1"]
      direction TB
      K1["kubelet"]
      X1["kube-proxy"]
      subgraph R1["Container runtime (CRI)"]
        P1a["Pod"]
        P1b["Pod"]
      end
    end
    subgraph N2["Worker node 2"]
      direction TB
      K2["kubelet"]
      X2["kube-proxy"]
      subgraph R2["Container runtime (CRI)"]
        P2a["Pod"]
        P2b["Pod"]
      end
    end
  end

  Admin -.-> API
  SCH <-.-> API
  CM <-.-> API
  API <-.-> ETCD
  CCM <-.-> API
  CCM -.-> AWS
  API <-.-> K1
  API <-.-> K2
  K1 -.-> R1
  K2 -.-> R2
```

**How the main objects fit together.** An Ingress becomes an ALB, the ALB sends traffic to a Service, the Service spreads it over the Pods a Deployment manages, and the Pods read ConfigMaps and Secrets and keep data on volumes through PVCs.

```mermaid
flowchart LR
  User(["Browser"]) --> ALB["ALB<br/>created from an Ingress"]
  ALB --> SVC["Service<br/>stable name and IP"]

  subgraph DEP["Deployment · replicas: 2"]
    RS["ReplicaSet"] --> PodA["Pod"]
    RS --> PodB["Pod"]
  end

  SVC --> PodA
  SVC --> PodB
  CFG["ConfigMap · Secret"] -.-> PodA
  CFG -.-> PodB
  PodA --> PVC[("PVC → PV<br/>EFS or EBS")]
  PodB --> PVC
```

**What happens when you deploy.** The desired state is stored first; controllers, the scheduler, Karpenter and the kubelet then make it real.

```mermaid
sequenceDiagram
  autonumber
  participant Argo as ArgoCD
  participant API as kube-apiserver
  participant ETCD as etcd
  participant CTRL as Deployment and ReplicaSet controllers
  participant SCH as kube-scheduler
  participant KAR as Karpenter
  participant KL as kubelet

  Argo->>API: apply Deployment (replicas: 2)
  API->>ETCD: store the desired state
  CTRL->>API: see the Deployment, create 2 Pods (Pending)
  SCH->>API: see the Pending Pods
  alt a node has room
    SCH->>API: bind each Pod to a node
  else no node fits
    KAR->>API: see the unschedulable Pods
    KAR->>KAR: launch an EC2 instance in a matching NodePool
    SCH->>API: bind the Pods to the new node
  end
  KL->>API: see Pods bound to this node
  KL->>KL: pull the image from ECR, start the containers
  KL->>API: report Running
```

**What EKS runs for you.** AWS runs the control plane; the nodes, Pod networking and add-ons live in your VPC.

```mermaid
flowchart LR
  Dev(["kubectl · ArgoCD · Terraform"])

  subgraph AWSSIDE["Run by AWS · EKS"]
    CP["Control plane<br/>kube-apiserver · etcd · scheduler · controllers<br/>across 3 Availability Zones"]
  end

  subgraph YOURS["Your AWS account · VPC"]
    subgraph MNG["Managed Node Group: infra"]
      N1["EC2 nodes<br/>platform tools"]
    end
    subgraph KP["Karpenter NodePools"]
      N2["EC2 nodes<br/>Spot · On-Demand · ARM64"]
    end
    CNI["VPC CNI<br/>Pod IPs from your subnets"]
    ADD["Add-ons<br/>Load Balancer Controller · EBS CSI · EFS CSI"]
  end

  Dev -->|"EKS API endpoint<br/>IAM authentication"| CP
  CP <-->|"ENIs in your subnets"| N1
  CP <--> N2
  N1 --- CNI
  N2 --- CNI
  ADD -.-> N1
```

## The big picture

[![Architecture overview](/img/architecture/01-overview.png)](/img/architecture/01-overview.png)

Nine detailed views — network, each cluster, Karpenter, telemetry, microservices, delivery, Terraform — are on [Architecture diagrams](07-architecture-diagrams.md). The logical view:

```mermaid
flowchart LR
  Git[(eks-core-gitops)] --> Argo
  subgraph C1["Cluster 1 · eks-workload"]
    direction TB
    subgraph MNG["Managed Node Group: infra (role=infra)"]
      Argo[ArgoCD]
      K[Karpenter]
      P[Prometheus]
      J[JavaMelody]
    end
    subgraph Pools["Karpenter node pools"]
      B["Pool 1 · batch-spot<br/>Spot"]
      M["Pool 2 · ms-od + ms-spot<br/>On-Demand : Spot = 1 : 3"]
      A["Pool 3 · arm64<br/>Graviton"]
    end
    App["Microservices"]
    Alloy["Alloy (DaemonSet, every node)"]
    Argo -- deploys --> App
    App -- runs on --> M
    K -- provisions --> Pools
  end
  App --> EFS[("Amazon EFS<br/>ReadWriteMany PVs")]
  P -- "metrics · remote_write" --> ALB
  Alloy -- "logs · push" --> ALB
  subgraph C2["Cluster 2 · eks-observability"]
    ALB["Internal ALB<br/>mimir / loki .observability.internal"]
    Mimir --> S3[(S3)]
    Loki --> S3
    G[Grafana] --> Mimir
    G --> Loki
  end
  ALB --> Mimir
  ALB --> Loki
```

Both clusters live in **one VPC** with separate subnets and security groups. Telemetry crosses an **internal** ALB over HTTPS; nothing is exposed to the Internet.

## Cluster 1 — `eks-workload`

| Component | Runs on | Purpose |
|---|---|---|
| Managed Node Group `infra` (3 × t3.large, On-Demand) | — | Stable capacity for the platform tools, independent of Karpenter |
| ArgoCD, Karpenter, Prometheus, JavaMelody, AWS Load Balancer Controller, Metrics Server | `infra` nodes | Platform tools (requirement 1) |
| NodePool `batch-spot` | Spot EC2 | Pool 1 — Spot workloads |
| NodePools `ms-od` + `ms-spot` | On-Demand + Spot EC2 | Pool 2 — microservices, 1:3 |
| NodePool `arm64` | Graviton EC2 | Pool 3 — ARM64 workloads |
| Microservices (6 backends + frontend) | Pool 2 | The application used in the labs |
| EFS + EFS CSI driver + StorageClass `efs-sc` | — | Shared persistent volumes |
| Alloy | every node | Collects Pod logs |

## Cluster 2 — `eks-observability`

| Component | Purpose |
|---|---|
| Managed Node Group `monitoring` (2 × t3.medium) | Capacity for the observability stack |
| Mimir (distributed) | Stores metrics received from cluster 1 |
| Loki (single binary) | Stores logs received from cluster 1 |
| Grafana | One UI for both |
| S3 buckets `eks-observability-mimir-<account>`, `-loki-<account>` | Long-term storage |
| Internal ALB + private Route 53 zone `observability.internal` | The private entry point for cluster 1 senders |

## Who owns what

Every resource has exactly one owner. Change it only through that owner, otherwise the next apply or sync reverts your change.

| Resource | Owner | How you change it |
|---|---|---|
| VPC, EKS, node groups, IAM, EFS, ECR, S3, DNS | Terraform (`eks-core-terraform`) | edit → `plan` → review → `apply` |
| LBC, Karpenter, ArgoCD, Prometheus, Metrics Server (cluster 1); Mimir, Loki, Grafana (cluster 2) | Terraform `helm_releases.tf`, values from `eks-core-gitops` | edit values → `plan` → `apply` |
| StorageClasses `gp3`, `efs-sc` | Terraform | `apply` |
| EC2NodeClass and NodePools | Manifests in `eks-core-gitops/platform/nodepools` | `kubectl apply` |
| Application Deployments, PVCs, PDBs, Services | ArgoCD, from `eks-core-gitops/apps` | commit → ArgoCD sync |
| cert-manager, Alloy, JavaMelody | Helm / manifests applied in the steps | `helm upgrade` / `kubectl apply` |

## Design decisions

- **The Managed Node Group exists so the platform does not depend on itself.** Karpenter and ArgoCD must keep running even when every Karpenter pool is empty.
- **Pool 2 is two NodePools.** Karpenter has no ratio setting inside one pool, so On-Demand and Spot are separate pools sharing a label and taint. Their CPU limits (24 and 72) set the 1:3 budget. See [step 2.3](../karpenter/on-demand-spot-ratio-and-limits).
- **EFS is for the microservices; databases use EBS.** PostgreSQL and MySQL stay on `gp3` volumes, which suit single-writer databases.
- **Telemetry goes to a separate cluster** so metrics and logs survive the loss of any workload node or of cluster 1 itself.

**Next:** [0.3 Architecture diagrams](07-architecture-diagrams.md), then [1.0 Terraform workflow](00-terraform-workflow.md)

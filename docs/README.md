# EKS Workshop documentation

These guides explain how to **implement and verify** each requirement: create two clusters, configure capacity groups, deploy microservices through GitOps, attach EFS, spread replicas, apply PDBs, and centralize telemetry.

## Follow this sequence

1. [Start with the requirements and learning path](00-platform-overview-and-deployment.md).
2. [Prepare your environment](00-architecture/02-organizational-constraints-and-prerequisites.md).
3. Create the [network](00-architecture/03-layer-10-network.md), [workload cluster](00-architecture/04-layer-20-cluster-workload.md), and [observability cluster](00-architecture/05-layer-21-cluster-observability.md).
4. [Bootstrap controllers](01-platform-addons/01-gitops-bootstrap-order.md) and configure [three capacity groups](02-karpenter-autoscaling-nodepools.md).
5. [Build images](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md) and [deploy through ArgoCD](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md).
6. Verify [EFS](04-apps-shopnow/05-efs-persistent-volumes.md), [Pod placement](04-apps-shopnow/06-pod-placement.md), and [PDBs](04-apps-shopnow/07-availability-and-pdb.md).
7. Configure [TLS](01-platform-addons/03-cert-manager-and-internal-tls.md), [metrics and logs](03-observability/01-observability-architecture-overview.md), and [Grafana](03-observability/04-grafana-dashboards.md).
8. Complete [acceptance](06-operations/06-workshop-acceptance.md), then follow [operations and cleanup](06-operations/05-lifecycle-and-cleanup.md).

## Reference guides

[Architecture](00-architecture/01-architecture-overview.md), [security](01-eks-security.md), [diagnostics](06-operations/03-system-verification-and-diagnostics.md), [incident catalogue](06-operations/02-master-incident-catalogue.md), and [environment migration](06-operations/01-tokyo-region-migration-runbook.md).

## Extensions after completing the core exercises

[Blue-green deployments](04-apps-shopnow/03-blue-green-argo-rollouts.md), [autoscaling](07-workload-autoscaling-hpa-cpa-keda.md), [Rancher](01-platform-addons/04-rancher-multi-cluster.md), [Custom Networking](00-architecture/06-custom-networking-lab-session.md), and [service mesh](08-service-mesh-and-istio.md).

Extensions do not replace EFS, Pod placement, PDB, or telemetry verification. Collect evidence from your own deployment rather than reusing success claims from an earlier environment.

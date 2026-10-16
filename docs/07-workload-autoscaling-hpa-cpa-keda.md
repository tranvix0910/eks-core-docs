---
title: "Extension: choose the right autoscaling mechanism"
---

# Separate replica scaling from node provisioning

Karpenter provisions EC2 capacity. HPA, CPA, and KEDA control replica counts. Increasing replicas does not require new nodes when existing nodes have sufficient resources.

| Mechanism | Input | Target | Suitable use |
|---|---|---|---|
| HPA | CPU, memory, or metrics exposed through an adapter | Deployment or Rollout with a scale subresource | Services with variable load |
| CPA | Node or core count | Platform Deployment | CoreDNS as cluster size grows |
| KEDA | Cron, queues, Prometheus, and other scalers | A KEDA-managed HPA; supports scaling from and to zero | Event-driven workloads or operating schedules |
| Karpenter | Pod constraints and resource requests | EC2 NodeClaims | Provisioning capacity for Pending Pods |

## Current implementation

- Metrics Server has a Terraform-managed Helm release; the directory is no longer empty as older documentation suggested.
- Backend HPA templates exist and are disabled by default. Fix their target name before enabling them.
- CPA manifests and KEDA ScaledObjects exist. Files alone do not prove deployment.
- The current KEDA configuration combines cron with Prometheus CPU usage queries. It does not query HTTP RPS from Mimir as some earlier guides described.

## Choose a mechanism for the workshop

Complete the core exercises with stable replica counts first. Then test CPU-based HPA on one service and observe both replicas and nodes. For operating schedules or an independent event source that wakes a service from zero, use KEDA with a suitable event source. Consider CPA when DNS capacity must follow cluster size, ensuring it does not conflict with existing autoscaling.

Do not attach a plain HPA and KEDA to the same target. Configure ArgoCD so it does not repeatedly reconcile `/spec/replicas` while a scaler owns that field. Keep at least two Ready replicas for services being evaluated in the availability exercise.

Follow the [autoscaling runbook](06-operations/04-workload-autoscaling-implementation-and-testing.md). Record measurements before and during load, rather than relying on a ScaledObject screenshot.

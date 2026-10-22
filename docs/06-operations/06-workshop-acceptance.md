---
title: "Step 5.1 — Acceptance checklist"
sidebar_label: "5.1 Acceptance checklist"
---

# Step 5.1 — Acceptance checklist

:::info Step summary
**Goal:** one table that shows each requirement is met, backed by the evidence files you saved in `$EVIDENCE_DIR`.
**Time:** about 20 minutes.
:::

Mark each row **Pass**, **Fail** or **Not tested**. A configuration file alone is not evidence; the row needs the command output.

| # | Requirement | Check (command or step) | Pass when | Evidence |
|---|---|---|---|---|
| — | Two EKS clusters | `aws eks list-clusters` | `eks-workload` and `eks-observability` are listed and `ACTIVE` | output |
| 1 | Infra tools on the Managed Node Group | [Step 2.1 verify](../platform-addons/gitops-bootstrap-order#verify--every-tool-is-on-an-infra-node) | Prometheus, JavaMelody, Karpenter, ArgoCD all on `role=infra` | `infra-placement.txt` |
| 2a | Pool 1 — Spot | [Step 2.2 verify](../karpenter/ec2nodeclass-and-nodepools-configuration#verify) | Test Pod on `batch-spot`, `capacity-type=spot` | `pool1-spot.txt` |
| 2b | Pool 2 — 1 : 3 | [Step 2.3 verify](../karpenter/on-demand-spot-ratio-and-limits#verify) | 1 On-Demand + 3 Spot nodes in the controlled test; limits 24 / 72 restored | `pool2-ratio-test.txt`, `pool2-capacity.txt` |
| 2c | Pool 3 — ARM64 | [Step 2.4 verify](../karpenter/arm64-validation#verify) | Pod on `arm64` node, log shows `aarch64` | `pool3-arm64.txt` |
| 3 | Microservices on pool 2 | [Step 3.2 verify](../apps-shopnow/shopnow-end-to-end-deployment-guide#verify--microservices-on-pool-2-requirement-3) | Every backend Pod on `ms-od` or `ms-spot` | `pool2-placement.txt` |
| 4 | EFS persistent volumes | [Step 3.3](../apps-shopnow/efs-persistent-volumes) | RWX PVCs Bound; file shared by two replicas; survives Pod replacement | `efs-persistence.txt` |
| 5 | Even distribution | [Step 3.4](../apps-shopnow/pod-placement) | Every two-replica service has `max-per-node=1` and two zones | `placement.txt` |
| 6 | PodDisruptionBudget | [Step 3.5](../apps-shopnow/availability-and-pdb) | Eviction refused at budget 0, allowed at budget 1; API answers during an eviction | `pdb-refused.txt`, `pdb-allowed.txt`, `availability.txt` |
| 7 | Deployed with ArgoCD | [Step 3.2 verify](../apps-shopnow/shopnow-end-to-end-deployment-guide#verify--argocd-requirement-7) | All Applications `Synced` + `Healthy` | `argocd-apps.txt` |
| 8 | Centralized observability | [Step 1.3](../architecture/layer-21-cluster-observability) | Mimir, Loki, Grafana Ready in cluster 2 | screenshot |
| 9a | Metrics shipped to cluster 2 | [Step 4.2 verify](../observability/mimir-metrics-pipeline#verify--query-mimir-directly) | Mimir returns `cluster="eks-workload"` series | `mimir-query.txt` |
| 9b | Logs shipped to cluster 2 | [Step 4.3 verify](../observability/loki-logging-pipeline#verify--query-loki-directly) | Loki returns new `workshop-proof` lines | `loki-query.txt` |

## Demo script (15 minutes)

1. Show the architecture diagram: two clusters, infra node group, three pools.
2. `kubectl get nodes -L role,karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch` — infra nodes and Karpenter nodes side by side.
3. ArgoCD UI: every application Synced and Healthy.
4. EFS: write a file in one Pod, read it in another.
5. Placement table: replicas on different nodes and zones.
6. PDB: an eviction refused, then allowed.
7. Grafana in cluster 2: a cluster 1 metric and a fresh log line.

## Known limits to state

- The 1:3 ratio is a capacity budget (24 : 72 vCPU); at low load all capacity can be On-Demand.
- Eureka and the databases run one replica each; they have no PDB.
- Mimir and Loki run one replica per component; they are not highly available.
- Admin tools are reached through port-forwarding and demo credentials.

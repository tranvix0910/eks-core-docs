---
title: "Accept the workshop against each requirement"
---

# Report measured results, not configuration screenshots alone

Complete the table using earlier tests. Mark unexecuted items **Not tested**, failures **Not passed**, with evidence and follow-up actions. This documentation does not premark an environment as complete.

| Item | Pass condition | Evidence |
|---|---|---|
| Two clusters | Both ACTIVE, Ready nodes in correct contexts | Cluster descriptions, node listings |
| Infra MNG | Karpenter, ArgoCD, Prometheus, JavaMelody on `role=infra` | Pod → node → labels |
| Spot pool | Test Pod on `batch-spot`/Spot | Pod/node/log output |
| Mixed pool | ShopNow backends only on `ms-od`/`ms-spot` | Node labels for each backend |
| 1:3 ratio | Explicit node/vCPU metric; 1+3 fixture passes if used | Capacity report, timestamp, implementation limits |
| ARM64 | Running Pod, ARM64 node, aarch64 `uname` | Image platforms, node, logs |
| Backend EFS | All six backends mount EFS; RWX PVCs Bound | Rendered manifests, PVC/PV/volumeHandle |
| Shared persistence | Two replicas share marker; marker survives replacement | Writer/reader nodes and file output |
| Replica distribution | Correct pool and effective constraints; permitted skew | Node/AZ table including zero-replica domains |
| PDB | Eviction denied at budget zero, permitted after restore | PDB status and API responses |
| API availability | Requests recorded while evicting a product Pod | Success/error count and recovery time |
| ArgoCD | Correct repo/revision, synced, healthy or intentionally paused | Application status, commit, image digest |
| Centralized metrics | Receiver query returns new cluster 1 metrics | PromQL, timestamp, tenant, result |
| Centralized logs | New marker readable from cluster 2 Loki | LogQL, timestamp, labels, log line |
| Lifecycle | Known owners, update/rollback, teardown dependencies | Owner table and cleanup checklist |

## Per-test report template

```text
Test item:
Account / cluster:
Commit / image tag or digest:
Start and finish timestamps:
Preconditions:
Commands or actions performed:
Expected result:
Observed result:
Passed / Not passed / Not tested:
Evidence file or screenshot:
Limitations and follow-up actions:
Test changes restored or resources removed:
```

## Suggested demonstration sequence

1. Explain the two clusters and three capacity groups using the diagram.
2. Show Terraform layers/state and a reviewed plan for a small change.
3. Show ArgoCD's commit/image and backends on the mixed pool.
4. Perform the EFS marker and Pod replacement test.
5. Show node/AZ distribution and PDB eviction behavior.
6. Run Spot/ARM64 proof workloads and present mixed-ratio measurements.
7. Find new metrics/logs in cluster 2 Grafana.
8. State limitations: capacity budget does not guarantee node ratio; singleton Eureka/databases; single-replica telemetry components; demo authentication.

## After the session

Save sanitized evidence. Restore readiness-hold files, load generators, test pool limits, cron/HPA settings, and port-forwards. If retaining the environment, record the cost owner and cleanup date. Otherwise follow the lifecycle runbook rather than deleting the VPC first.

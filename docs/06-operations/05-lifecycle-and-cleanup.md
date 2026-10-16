---
title: "Step 9 - Manage, maintain, and clean up resources"
---

# Manage the environment after initial deployment

## 1. Routine change procedure

| Change | Procedure |
|---|---|
| Network/EKS/IAM/EFS or Terraform-managed charts | Edit → fmt/validate → saved plan → review → apply → verify |
| ShopNow image/config/PDB/placement | Edit Git → render → commit/push → ArgoCD diff/sync → smoke test |
| Operator-bootstrapped NodePool | Edit manifest → review NodeClaim/drift impact → apply → verify |
| CA/certificate | Check expiry → issue/import → trust/reload → query telemetry |

Do not apply the same state concurrently. S3 locking prevents concurrent writes but does not replace review. Do not `force-unlock` until the process holding the lock has been confirmed stopped.

## 2. Pause and resume

To stop a service temporarily, change desired replicas through Git or use the managed autoscaler configuration. A plain `kubectl scale` can be immediately undone by selfHeal/KEDA.

Before scaling to zero, record desired settings and inspect PDBs, data writers, Eureka/Keycloak/database dependencies. Stopping writers does not delete EFS data. EKS control planes, Managed Node Groups, NAT, EFS, and volumes can continue charging; zero Pods does not mean a stopped environment.

Resume by restoring previous values/cron/ownership, syncing, and waiting for readiness. Do not promise recovery within a fixed number of seconds.

## 3. Back up before teardown or major maintenance

Back up PostgreSQL and MySQL/Keycloak using database tools, EFS using a configured backup mechanism, and telemetry history according to retention needs. The EFS module currently disables automatic backup policy. A PVC or S3 versioning is not a substitute for a successful restore test.

Record filesystem/bucket/volume IDs, owner, and retention. Deleting a PVC with reclaim policy Delete can remove its Access Point or EBS volume; inspect PVs before deleting the database Application.

## 4. Remove applications before infrastructure

Proceed only after accepting synthetic-data loss or verifying backups. Inspect ArgoCD Applications for the correct cluster/repository. Delete with explicit cascading in this order:

```bash
for workshop_app in workshop-proof shopnow-frontend shopnow-api-gateway \
  shopnow-user-service shopnow-cart-service shopnow-product-service \
  shopnow-config-server shopnow-discovery-server; do
  argocd app delete "$workshop_app" --cascade --yes
done
argocd app delete shopnow-database-services --cascade --yes
```

If an Application does not exist, inspect and skip it; do not delete the namespace to hide remaining resources. Original bootstrap Application YAML lacks finalizers, so use cascading deliberately and verify child resources are removed.

Remove leftover Spot/ARM64/ratio test workloads, manually created ingress/NLB resources, and manually installed releases before deleting clusters. Retain cert-manager until required certificate export/backups are complete. Wait for AWS load balancer/ENI cleanup while controllers still run.

## 5. Break circular dependencies before destroy

Do not destroy clusters in an arbitrary order and assume remote state remains readable. While both still exist:

1. Set Layer 21 `internal_observability_alb_name=null`, then plan/full apply to remove aliases/data lookups for the ALB about to be deleted.
2. Prepare a Layer 20 decommissioning change: remove the `cluster_observability` data source from `data.tf` and set local `observability_node_security_group_id=null`. The conditional Rancher SG ingress becomes empty. Plan/full apply while Layer 21 exists; verify no unintended cluster/node changes.
3. Check Layer 20 no longer references Layer 21. Save the decommission commit/diff explaining the change.
4. Delete cluster 2's manual internal/public ingress and wait for load balancer cleanup.

This is an infrastructure decommissioning change, not an operation for an active application lab. A long-term architecture should remove the circular dependency rather than retain complex teardown procedures.

## 6. Destroy through saved plans

Objects in Mimir/Loki buckets can block destroy. Explicitly decide whether to retain or delete data; inventory versions/delete markers if versioning was ever enabled. Do not enable force-destroy just to bypass data review.

```bash
terraform -chdir=21-cluster-observability plan -destroy \
  -out="$REPO_ROOT/.workshop/plans/destroy-observability.tfplan"
terraform -chdir=21-cluster-observability show "$REPO_ROOT/.workshop/plans/destroy-observability.tfplan"
terraform -chdir=21-cluster-observability apply "$REPO_ROOT/.workshop/plans/destroy-observability.tfplan"
terraform -chdir=20-cluster-workload plan -destroy \
  -out="$REPO_ROOT/.workshop/plans/destroy-workload.tfplan"
terraform -chdir=20-cluster-workload show "$REPO_ROOT/.workshop/plans/destroy-workload.tfplan"
terraform -chdir=20-cluster-workload apply "$REPO_ROOT/.workshop/plans/destroy-workload.tfplan"
terraform -chdir=10-network plan -destroy \
  -out="$REPO_ROOT/.workshop/plans/destroy-network.tfplan"
terraform -chdir=10-network show "$REPO_ROOT/.workshop/plans/destroy-network.tfplan"
terraform -chdir=10-network apply "$REPO_ROOT/.workshop/plans/destroy-network.tfplan"
```

Execute each plan/review/apply stage separately; do not run the entire sequence while skipping review or blockers. If Helm/Kubernetes providers cannot reach a cluster, investigate ownership/state with evidence rather than creating a same-name cluster to repair destroy.

## 7. Check remaining resources

Review EKS clusters, Karpenter EC2 instances, ALB/NLB/target groups, EBS snapshots/volumes, EFS, EIPs/NAT, S3 objects, CLI-imported ACM certificates, private DNS, log groups, and the state backend. The three stacks do not delete the backend itself; retain it according to audit/recovery policy.

For SCP-protected Flow Logs, record remaining resources and their responsible owner. `terraform state rm` stops management without deleting AWS resources, so it is not proof of complete cleanup.

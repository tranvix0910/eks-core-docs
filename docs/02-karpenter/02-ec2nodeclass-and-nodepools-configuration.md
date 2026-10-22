---
title: "Step 2.2 — Create the three Karpenter node pools"
sidebar_label: "2.2 Three node pools"
---

# Step 2.2 — Create the three Karpenter node pools

:::info Step summary
**Goal:** pool 1 (Spot), pool 2 (mixed On-Demand/Spot), pool 3 (ARM64), and a Spot test that proves pool 1 works.
**Requirement:** 2. **Time:** about 15 minutes. **Run from:** `$GITOPS_DIR`.
:::

## How Karpenter works here

Karpenter watches for Pods that cannot be scheduled. It picks a **NodePool** whose rules match the Pod (labels, taints, architecture, capacity type), launches the cheapest fitting EC2 instance, and removes the node again when it is empty or underused. You never create nodes by hand; you create a Pod that needs one.

| Object | File | What it defines |
|---|---|---|
| `EC2NodeClass default` | `platform/nodepools/ec2nodeclass.yaml` | Node IAM role, subnets and security groups (found by tag `karpenter.sh/discovery=eks-workload`), AMI `al2023`, IMDSv2, 30 GiB encrypted gp3 root disk |
| `NodePool batch-spot` | `nodepool-1-spot.yaml` | **Pool 1** |
| `NodePool ms-od` + `NodePool ms-spot` | `nodepool-2-ondemand.yaml`, `nodepool-2-spot.yaml` | **Pool 2** |
| `NodePool arm64` | `nodepool-3-arm64.yaml` | **Pool 3** |

## The three pools

| | Pool 1 `batch-spot` | Pool 2 `ms-od` | Pool 2 `ms-spot` | Pool 3 `arm64` |
|---|---|---|---|---|
| Capacity type | Spot | On-Demand | Spot | On-Demand or Spot |
| Architecture | amd64, arm64 | amd64 | amd64 | arm64 |
| Node label | `workload=batch` | `workload=microservices` | `workload=microservices` | `arch=arm64` |
| Taint | `workload=batch:NoSchedule` | `workload=microservices:NoSchedule` | same as `ms-od` | `arch=arm64:NoSchedule` |
| CPU limit | 48 | **24** | **72** | 48 |
| Weight | 50 | **100** | **10** | 50 |

All pools use the `m`, `c` and `r` families, generation 6 or newer, and exclude `nano`, `micro` and `small` sizes. Every pool consolidates empty or under-used nodes and replaces nodes after 30 days (`expireAfter: 720h`).

**Why pool 2 is two NodePools:** Karpenter has no On-Demand/Spot ratio inside one pool. `ms-od` and `ms-spot` share the same label and taint, so a microservice Pod fits either. Karpenter fills the higher-weight `ms-od` first; once it reaches **24 vCPU**, new capacity comes from `ms-spot`, up to **72 vCPU**. 24 : 72 = **1 : 3**. [Step 2.3](on-demand-spot-ratio-and-limits) shows how to measure it.

**Taints keep pools clean:** a Pod lands on a pool only if it both **selects** the label and **tolerates** the taint. Nothing drifts onto Spot or ARM64 nodes by accident.

## 1. Check the node role and AMI

```bash
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name; echo
grep -E 'role:|alias:' "$GITOPS_DIR/platform/nodepools/ec2nodeclass.yaml"
```

The `role` in `ec2nodeclass.yaml` must equal the Terraform output (`Karpenter-eks-workload`).

## 2. Apply the EC2NodeClass and NodePools

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/nodepools/ec2nodeclass.yaml"
kubectl --context eks-workload wait ec2nodeclass/default --for=condition=Ready --timeout=5m

for f in nodepool-1-spot nodepool-2-ondemand nodepool-2-spot nodepool-3-arm64; do
  kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/nodepools/$f.yaml"
done
kubectl --context eks-workload get ec2nodeclass,nodepools
```

**Expected:** `default` is `Ready=True`; the four NodePools exist. No new nodes appear yet — pools only create nodes for Pods that need them.

If the EC2NodeClass is not Ready, run `kubectl --context eks-workload describe ec2nodeclass default`. The usual causes are an AMI alias that does not exist in your region or subnets/security groups missing the discovery tag.

## 3. Test pool 1 with a Spot workload

`examples/workshop/spot-proof.yaml` is a small Deployment that selects `workload=batch`, tolerates its taint and requires `amd64`.

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w          # Ctrl+C once a NodeClaim is Ready
kubectl --context eks-workload rollout status deployment/workshop-spot --timeout=10m
```

## Verify

```bash
kubectl --context eks-workload get pods -l app=workshop-spot -o wide
kubectl --context eks-workload get nodes -l karpenter.sh/nodepool=batch-spot \
  -L karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch,node.kubernetes.io/instance-type \
  | tee "$EVIDENCE_DIR/pool1-spot.txt"
```

**Expected:** the Pod is `Running` on a node with `nodepool=batch-spot`, `capacity-type=spot`, `arch=amd64`.

Remove the test; Karpenter deletes the empty node about 30 seconds later:

```bash
kubectl --context eks-workload delete -f "$GITOPS_DIR/examples/workshop/spot-proof.yaml"
kubectl --context eks-workload get nodeclaims -w
```

| Symptom | Check |
|---|---|
| Pod `Pending`, no NodeClaim | `kubectl describe pod` — selector/toleration mismatch; Karpenter logs: `kubectl -n kube-system logs deploy/karpenter` |
| NodeClaim created but node never joins | Node IAM role and EKS access entry; subnet routing |
| `InsufficientInstanceCapacity` for Spot | Spot capacity in that AZ; widen instance families — do not switch the pool to On-Demand |

Pool 2 is tested when the microservices are deployed ([step 3.2](../apps-shopnow/shopnow-end-to-end-deployment-guide)) and measured in [step 2.3](on-demand-spot-ratio-and-limits). Pool 3 is tested in [step 2.4](arm64-validation).

**Next:** [2.3 Mixed pool 1:3](on-demand-spot-ratio-and-limits)

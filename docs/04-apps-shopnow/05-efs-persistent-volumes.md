---
title: "Step 7a - EFS, PV/PVC, and data across Pod replacement"
---

# Prove microservices use shared storage

## 1. Verify EFS infrastructure

```bash
export WORKSHOP_EFS_ID=$(terraform -chdir=20-cluster-workload output -raw efs_file_system_id)
aws efs describe-mount-targets --file-system-id "$WORKSHOP_EFS_ID" --output table
kubectl --context eks-workload -n kube-system get pods -l app=efs-csi-controller
kubectl --context eks-workload get storageclass efs-sc -o yaml
```

If the controller label differs, list `kube-system` Pods and locate EFS CSI. The StorageClass must use provisioner `efs.csi.aws.com`, `efs-ap`, and the correct filesystem ID. IAM must associate `kube-system/efs-csi-controller-sa`. TCP 2049 must reach mount targets from worker SGs.

## 2. Inspect microservice PVCs

```bash
kubectl --context eks-workload -n shopnow get pvc
kubectl --context eks-workload get pv
kubectl --context eks-workload -n shopnow get deployment shopnow-product-service-deployment -o yaml
```

Backend PVCs are named `<appName>-efs`, use RWX, and mount `/data` through workshop values. Replicas of the same service share a claim. `requests.storage=5Gi` is not an EFS capacity quota. Database gp3 PVCs are intentionally separate.

Backend images run as UID/GID 10001; the StorageClass creates matching Access Points and Pods use `fsGroup=10001`. If mounting works but writes fail, check POSIX ownership/permissions before changing IAM.

## 3. Read one file from two product replicas

```bash
export WORKSHOP_PRODUCT_PODS=$(kubectl --context eks-workload -n shopnow get pods \
  -l app=shopnow-product-service -o json | jq -r '.items[] | select(.status.phase=="Running") | .metadata.name')
export WORKSHOP_WRITER=$(printf '%s\n' "$WORKSHOP_PRODUCT_PODS" | head -n 1)
export WORKSHOP_READER=$(printf '%s\n' "$WORKSHOP_PRODUCT_PODS" | tail -n 1)
test "$WORKSHOP_WRITER" != "$WORKSHOP_READER"
kubectl --context eks-workload -n shopnow exec "$WORKSHOP_WRITER" -- \
  sh -c 'printf "efs-workshop-marker\n" > /data/workshop-marker.txt; sync'
kubectl --context eks-workload -n shopnow exec "$WORKSHOP_READER" -- cat /data/workshop-marker.txt
```

Require two distinct Ready Pods, preferably on different nodes as verified in the placement lab. Pass when the reader returns the correct marker. Do not test against real business files.

## 4. Verify data survives Pod replacement

```bash
kubectl --context eks-workload -n shopnow delete pod "$WORKSHOP_WRITER"
kubectl --context eks-workload -n shopnow rollout status deployment/shopnow-product-service-deployment --timeout=10m
export WORKSHOP_NEW_READER=$(kubectl --context eks-workload -n shopnow get pods \
  -l app=shopnow-product-service -o jsonpath='{.items[0].metadata.name}')
kubectl --context eks-workload -n shopnow exec "$WORKSHOP_NEW_READER" -- cat /data/workshop-marker.txt
```

Deleting the Pod is an intentional persistence test. It **does not test the PDB**, because direct deletion bypasses eviction. Remove only your own marker file after completing the test.

## 5. Independent proof workload

```bash
kubectl --context eks-workload apply -f .workshop/applications/workshop-proof.json
argocd app wait workshop-proof --sync --health --timeout 900
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof -o wide
```

This Application uses EFS, mandatory hostname spread, and a 2-of-3 PDB so availability tests do not alter business-service readiness. Each Pod writes its own file to one shared claim and emits markers for the Loki lab.

| Failure | Check |
|---|---|
| PVC Pending | `describe pvc`, CSI events, Pod Identity, correct StorageClass |
| Mount timeout | NFS 2049 SG rules, mount target/AZ, EFS DNS |
| Permission denied | uid/gid, Access Point, directoryPerms |
| File missing after recreate | Actual write path `/data`, correct claim/Access Point |

Reference: [Amazon EFS CSI on EKS](https://docs.aws.amazon.com/eks/latest/userguide/efs-csi.html).

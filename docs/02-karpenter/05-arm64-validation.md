---
title: "Verify a container runs on ARM64"
---

# Run a real ARM64 workload

A NodePool object does not prove image compatibility. This lab uses a small multi-architecture image without moving all ShopNow services to ARM64.

```bash
docker buildx imagetools inspect public.ecr.aws/docker/library/busybox:1.37.0
kubectl --context eks-workload apply -f examples/workshop/arm64-proof.yaml
kubectl --context eks-workload rollout status deployment/workshop-arm64 --timeout=10m
kubectl --context eks-workload get pods -l app=workshop-arm64 -o wide
kubectl --context eks-workload get nodes -l arch=arm64 -L kubernetes.io/arch,karpenter.sh/nodepool
kubectl --context eks-workload logs deployment/workshop-arm64
```

**Pass:** the image manifest includes Linux ARM64, the Pod runs on NodePool `arm64`, the node architecture is `arm64`, and `uname -m` inside the container returns `aarch64`.

For `exec format error`, inspect the image manifest; a selector cannot convert an amd64 image into ARM64. For Pending Pods, check tolerations, requirements, and Spot/On-Demand capacity. If `EC2NodeClass` is NotReady, resolve AMI selection first.

Save Pod/node/log output as evidence. Remove the test Deployment afterward:

```bash
kubectl --context eks-workload delete -f examples/workshop/arm64-proof.yaml
```

To test a real backend, build with `WORKSHOP_PLATFORMS=linux/amd64,linux/arm64`, inspect the manifest list, and create a separate test Application with ARM64 selectors/tolerations and a namespace allowed by its AppProject. Keep core ShopNow on the mixed group as required by the assignment.

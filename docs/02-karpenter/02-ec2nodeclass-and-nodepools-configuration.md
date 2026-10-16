---
title: "Step 5 - Configure Spot, mixed, and ARM64 capacity"
---

# Create the three capacity groups

## 1. Prepare EC2NodeClass

`platform/nodepools/ec2nodeclass.yaml` selects subnets/SGs through discovery tags and defines AL2023 AMIs, IMDSv2, and EBS root storage. Confirm `spec.role` matches Terraform output and that the AMI alias exists in the target region.

```bash
terraform -chdir=20-cluster-workload output -raw karpenter_node_iam_role_name
aws ssm get-parameters-by-path \
  --path /aws/service/eks/optimized-ami/1.34/amazon-linux-2023/ --recursive \
  --query 'Parameters[].Name' --output table
```

The SSM listing helps inspect AMI families; it does not prove a dated alias resolves. NodeClass readiness and resolved AMIs after apply are the gate. If an old pin cannot find an image, choose an available pin compatible with the Kubernetes version and review drift before applying it to application nodes.

## 2. Apply manifests

```bash
kubectl --context eks-workload apply -f platform/nodepools/ec2nodeclass.yaml
kubectl --context eks-workload wait ec2nodeclass/default --for=condition=Ready --timeout=5m
kubectl --context eks-workload apply -f platform/nodepools/nodepool-1-spot.yaml
kubectl --context eks-workload apply -f platform/nodepools/nodepool-2-ondemand.yaml
kubectl --context eks-workload apply -f platform/nodepools/nodepool-2-spot.yaml
kubectl --context eks-workload apply -f platform/nodepools/nodepool-3-arm64.yaml
kubectl --context eks-workload get nodepools,ec2nodeclasses
kubectl --context eks-workload describe ec2nodeclass default
```

Creating a pool alone does not create EC2 instances. Nodes appear when compatible Pods need capacity.

## 3. Understand labels and taints

| Pool | Pod selector | Required toleration | Capacity |
|---|---|---|---|
| `batch-spot` | `workload=batch` | `workload=batch:NoSchedule` | Spot |
| `ms-od` | `workload=microservices` | `workload=microservices:NoSchedule` | On-Demand |
| `ms-spot` | `workload=microservices` | Same taint as ms-od | Spot |
| `arm64` | `arch=arm64`, architecture arm64 | `arch=arm64:NoSchedule` | Spot or On-Demand |

A toleration permits placement; a selector constrains placement. `capacity=on-demand` is a repository-specific label. Use the standard `karpenter.sh/capacity-type` label to measure EC2 purchase type.

Microservices do not select a specific `capacity` so both mixed pools are eligible. Databases additionally select On-Demand because they use EBS and a single replica. The batch pool permits amd64/arm64, so an amd64-only image needs an architecture selector, as in the example.

## 4. Test the Spot pool with a real workload

```bash
kubectl --context eks-workload apply -f examples/workshop/spot-proof.yaml
kubectl --context eks-workload -n default rollout status deployment/workshop-spot --timeout=10m
kubectl --context eks-workload -n default get pods -l app=workshop-spot -o wide
kubectl --context eks-workload get nodes -L karpenter.sh/nodepool,karpenter.sh/capacity-type,kubernetes.io/arch
kubectl --context eks-workload -n default logs deployment/workshop-spot
```

Pass when the Pod runs on `batch-spot`, capacity-type `spot`, architecture `amd64`. If Spot capacity is unavailable, record a failed gate and carefully broaden eligibility; switching to On-Demand does not constitute a successful Spot test.

```bash
kubectl --context eks-workload delete -f examples/workshop/spot-proof.yaml
```

Current pools exclude nano/micro/small sizes, not `medium`. Earlier documentation claiming medium was excluded does not match the manifests. If a test needs at least 4 vCPUs, add `karpenter.k8s.aws/instance-cpu`; do not infer CPU count solely from an instance size suffix.

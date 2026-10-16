---
title: "Karpenter: AWS foundation and in-cluster controller"
---

# Verify both halves before provisioning nodes

## Half 1: Terraform creates AWS resources

`20-cluster-workload/karpenter.tf` uses the Karpenter module for node/controller IAM, the interruption queue, EventBridge, and EKS access for the node role. A Pod Identity association connects the controller to its ServiceAccount. These resources are not the process watching Pods.

## Half 2: Helm installs the controller and CRDs

`helm_releases.tf` installs the `karpenter` release in `kube-system`, reads `platform/addons/karpenter/values.yaml`, and overrides cluster/queue settings from outputs. Terraform owns this release.

```bash
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_node_iam_role_name
terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_queue_name
kubectl --context eks-workload get crd nodepools.karpenter.sh ec2nodeclasses.karpenter.k8s.aws
kubectl --context eks-workload -n kube-system get pods -l app.kubernetes.io/name=karpenter -o wide
kubectl --context eks-workload -n kube-system logs deployment/karpenter --tail=100
```

The controller runs on `role=infra`; its ServiceAccount and namespace must match the association. Placing it in a pool it can remove creates an unnecessary dependency.

## When a Pod is Pending

1. The scheduler records why placement failed: resources, selector, taint, topology, or PVC.
2. Karpenter finds a NodePool satisfying both Pod and pool constraints.
3. A NodeClaim is created, EC2 launches, and the node registers with EKS.
4. CSI/CNI and DaemonSets initialize; kube-scheduler can then place the Pod.

No NodeClaim: inspect scheduling constraints. EC2 exists but the node does not join: inspect IAM/access entries, bootstrap, and networking. Node Ready but Pod still unavailable: inspect the Pod/PVC instead of continuing to change controller IAM.

## Completion gate

Controller Available, CRDs present, correct Pod Identity and node role. Next: [apply the node groups](02-ec2nodeclass-and-nodepools-configuration.md).

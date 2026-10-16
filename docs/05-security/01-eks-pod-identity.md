---
title: "Pod Identity - Authorize controllers to call AWS APIs"
---

# Associate AWS permissions with the correct ServiceAccount

Terraform creates IAM roles/policies and associations. Pod Identity Agent supplies credentials to SDKs inside Pods. Attaching policies to node roles is not the default substitute for repairing an incorrect association.

## 1. Compare mappings

| Cluster | Namespace/ServiceAccount | Required permissions |
|---|---|---|
| Workload | `kube-system/karpenter` | EC2 provisioning and interruption queue access through the module |
| Workload | `kube-system/aws-load-balancer-controller` | ELB/EC2 networking required by the controller |
| Workload | `kube-system/ebs-csi-controller-sa` | EBS provisioning |
| Workload | `kube-system/efs-csi-controller-sa` | EFS Access Point provisioning |
| Observability | `kube-system/ebs-csi-controller-sa` | EBS provisioning |
| Observability | `kube-system/aws-load-balancer-controller` | Load balancing |
| Observability | `monitoring/mimir` | Access to the correct Mimir bucket |
| Observability | `monitoring/loki` | Access to the correct Loki bucket |

## 2. Verify AWS and Kubernetes

```bash
aws eks list-pod-identity-associations --cluster-name eks-workload
aws eks list-pod-identity-associations --cluster-name eks-observability
kubectl --context eks-workload -n kube-system get daemonset eks-pod-identity-agent
kubectl --context eks-observability -n monitoring get serviceaccount mimir loki
```

Select an association ID from the listing, set the variable below, and inspect its role/namespace/ServiceAccount in a personal terminal:

```bash
: "${WORKSHOP_ASSOCIATION_ID:?Set an association ID from the list above}"
aws eks describe-pod-identity-association --cluster-name eks-workload \
  --association-id "$WORKSHOP_ASSOCIATION_ID"
```

For cluster 2, use the cluster name owning that association. Do not copy another account's ARN.

## 3. Diagnose AccessDenied

1. Confirm the Pod's `serviceAccountName`.
2. Check the association's cluster, namespace, and ServiceAccount.
3. Confirm the agent is Ready on that node, networking works, and the SDK supports the credential chain.
4. Verify policy actions/resources and bucket region/name.
5. Inspect explicit denies in SCPs/bucket policies once identity is correct.

Do not add static AWS keys to Helm values to bypass IAM failures. After association changes, check new Pods and actual logs; do not print full environment credentials for debugging.

Reference: [AWS EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html).

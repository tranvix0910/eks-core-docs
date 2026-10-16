---
title: "Authenticate and authorize EKS access"
---

# Identify the layer rejecting access

AWS CLI credentials, EKS authentication, and Kubernetes RBAC are separate layers. Success in one does not automatically authorize the next.

## 1. Check account and kubeconfig

```bash
aws sts get-caller-identity
aws eks update-kubeconfig --name eks-workload --region "$AWS_REGION" --alias eks-workload
aws eks update-kubeconfig --name eks-observability --region "$AWS_REGION" --alias eks-observability
kubectl config get-contexts
kubectl --context eks-workload auth can-i get pods -A
kubectl --context eks-workload auth can-i create applications.argoproj.io -n argocd
```

Kubeconfig uses an exec plugin to call `aws eks get-token`; do not store a fixed token in shared files or documentation. If kubeconfig was created with another profile, inspect `users[].user.exec` to avoid using the wrong identity.

## 2. Access entries

```bash
aws eks list-access-entries --cluster-name eks-workload
aws eks list-access-entries --cluster-name eks-observability
```

The module currently grants cluster creator admin permissions. Other operators need appropriately scoped access entries/policies or RBAC; do not share the creator's credentials. Karpenter's node IAM role also needs the correct entry type for nodes to join.

## 3. Common symptoms

| Error | Layer to inspect |
|---|---|
| AWS `ExpiredToken` | AWS/SSO session |
| AWS `AccessDenied` describing the cluster | IAM/SCP before Kubernetes |
| Kubernetes `Unauthorized` | Identity, token, access entry |
| Kubernetes `Forbidden` | RBAC or access-policy scope |
| Endpoint timeout | Networking, public/private endpoint, allowed CIDRs |

To manage permissions through Terraform, declare the principal/scope and plan/review/apply using an already-authorized identity. Editing `aws-auth` is not a general remedy for a cluster using access entries.

## 4. Specify context for every operation

Commands use `--context` for kubectl and `--kube-context` for Helm. Relying on `use-context` before a long command sequence makes it easier to send receiver manifests to the workload cluster accidentally. Record cluster/account and timestamp with evidence.

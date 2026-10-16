# EKS Authentication: STS Tokens & Access Entries

Technical guide covering AWS STS pre-signed URL authentication, short-lived Bearer tokens, and **EKS Access Entries** replacing the legacy `aws-auth` ConfigMap.

---

## 1. Authentication Mechanics: STS SigV4 Bearer Tokens

`kubectl` never stores static passwords or API tokens. On every command:
1. `kubectl` executes the `exec` plugin in `~/.kube/config`:
   `aws eks get-token --cluster-name eks-workload --region ap-northeast-1`
2. AWS CLI creates a pre-signed AWS STS `GetCallerIdentity` request signed with SigV4.
3. The pre-signed URL is base64-encoded and passed in the HTTP `Authorization: Bearer k8s-aws-v1.<base64>` header.
4. EKS Control Plane calls STS to validate caller identity and extracts the caller's IAM ARN.
5. **Token Lifetime**: Fixed to **15 minutes** (automatically refreshed by `kubectl`).

---

## 2. EKS Access Entries Replacing `aws-auth` ConfigMap

Historically, EKS mapped IAM roles to Kubernetes RBAC via ConfigMap `kube-system/aws-auth`.
* **Legacy Risk**: Syntax errors in `aws-auth` would lock administrators out of the cluster permanently.
* **Modern EKS Standard**: **EKS Access Entries** are native AWS API objects managed directly in Terraform:

```hcl
access_entries = {
  karpenter = {
    principal_arn = module.karpenter.node_iam_role_arn
    type          = "EC2_LINUX" # Automatically grants node joining permissions
  }
  admin = {
    principal_arn = "arn:aws:iam::<AWS_ACCOUNT_ID>:role/admin"
    policy_associations = {
      admin = {
        policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
        access_scope = { type = "cluster" }
      }
    }
  }
}
```

# Secret Management: KMS Envelope Encryption & ESO Rotation

Technical documentation covering **AWS KMS Envelope Encryption** for Kubernetes Secrets at rest, and secret synchronization / automated rotation using the **External Secrets Operator (ESO)** with AWS Secrets Manager.

---

## 1. KMS Envelope Encryption for etcd

In [20-cluster-workload/main.tf](https://github.com/tranvix0910/eks-core-terraform/blob/main/20-cluster-workload/main.tf):
```hcl
create_kms_key = true
kms_key_aliases = ["eks/eks-workload"]
cluster_encryption_config = {
  resources = ["secrets"]
}
```

* **Mechanism**: Every Kubernetes Secret stored in etcd is encrypted using a unique Data Encryption Key (DEK). The DEK is encrypted using the master AWS KMS Customer Managed Key (CMK) (`alias/eks/eks-workload`).
* **Compliance**: Meets strict financial banking and enterprise security standards for data-at-rest encryption.

---

## 2. External Secrets Operator (ESO) & AWS Secrets Manager

To eliminate hardcoded plaintext credentials in Git repositories:
1. Sensitive values (DB passwords, API keys) are stored in **AWS Secrets Manager**.
2. **External Secrets Operator (ESO)** runs in-cluster, authenticating via EKS Pod Identity.
3. ESO reads `ExternalSecret` custom resources, fetches values from AWS Secrets Manager, and synchronizes them into standard Kubernetes `Secret` objects.
4. **Automated Rotation**: ESO continuously polls AWS Secrets Manager (e.g. `refreshInterval: 1h`) to update in-cluster secrets automatically when rotated in AWS.

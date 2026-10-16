---
title: "Extension: VPC CNI Custom Networking lab"
---

# Run this lab after completing the core workshop

Custom Networking separates Pod addresses from node subnets. It is not required for the two clusters, EFS, ArgoCD, or centralized observability. Keep the existing Prefix Delegation configuration for the core workshop; add a secondary CIDR only when you have a networking requirement to test.

## 1. Objective and scope

Use the existing workload cluster, create Pod subnets from a secondary VPC CIDR, select ENIConfig by Availability Zone, add a canary node, and verify that Pod IPs belong to Pod subnets while node IPs remain in node subnets. Leave the observability cluster configuration unchanged.

This changes the shared VPC and cluster-wide CNI configuration. Use a dedicated lab window, separate from the PDB and availability exercises. Before proceeding, check for CIDR overlap with on-premises networks, peering, or Transit Gateway; confirm subnet and ENI quotas; and assign a rollback owner.

## 2. Inventory and save the actual configuration

```bash
aws eks describe-addon --cluster-name eks-workload --addon-name vpc-cni \
  --output json > .workshop/vpc-cni-before.json
jq -r '.addon.configurationValues // "{}"' .workshop/vpc-cni-before.json \
  > .workshop/vpc-cni-config-before.json
kubectl --context eks-workload get nodes -o json > .workshop/nodes-before-custom-network.json
terraform -chdir=10-network output -json
```

The checkout file `labs/custom-networking/vpc-cni-configuration-before-custom-networking.json` may be empty. Do not use it for rollback unless it contains the configuration saved for this lab session.

## 3. Prepare the network as a separate change

Plan a secondary CIDR, three private Pod subnets in the same Availability Zones as the node subnets, suitable egress routes, and security groups for Pod ENIs. Use subnet IDs from actual outputs. Replace the environment-specific IDs in `labs/custom-networking/eni-configs.yaml`.

Each ENIConfig must match the Availability Zone of the node using it; a secondary ENI cannot attach across zones. NetworkPolicy, security group rules, DNS, and routing must support the new Pod network. A CGNAT CIDR does not automatically resolve overlap with enterprise networks.

## 4. Create ENIConfig and update the CNI

Copy the sample ENIConfig into `.workshop`, replace all subnet and security group IDs with the resources you created, and set metadata.name to the corresponding Availability Zone. Apply ENIConfig before enabling zone-based selection.

Preserve existing add-on configurationValues and add these settings:

```json
{
  "env": {
    "ENABLE_PREFIX_DELEGATION": "true",
    "WARM_PREFIX_TARGET": "1",
    "AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG": "true",
    "ENI_CONFIG_LABEL_DEF": "topology.kubernetes.io/zone"
  }
}
```

**Merge these keys into the saved configuration.** Do not replace all configurationValues if your environment has additional settings. Update through the EKS managed add-on API or the IaC that owns it. Direct DaemonSet edits may be overwritten by add-on reconciliation. Wait for the add-on and aws-node to become Ready.

## 5. Canary and verification

Increase node group capacity in a controlled change and identify the new node. Use the existing workload cluster. Label and taint the canary with `lab.eks-core/custom-network=true` and `custom-network-lab=true:NoSchedule` as described in the sample manifest. Applying the taint after the node becomes Ready leaves a scheduling window; record that limitation or configure isolation during node bootstrap.

```bash
kubectl --context eks-workload apply -f labs/custom-networking/custom-network-test.yaml
kubectl --context eks-workload -n custom-network-lab get pods -o wide
kubectl --context eks-workload -n kube-system logs -l k8s-app=aws-node -c aws-node --tail=50
```

The lab passes when canary Pods receive IPs from secondary Pod subnets, nodes retain primary subnet IPs, and DNS, egress, and required service connectivity work. IP allocation alone is insufficient evidence.

## 6. Ordered rollback

Delete the test workload, restore the exact saved configurationValues, and wait for a healthy CNI. Return the canary to its approved state and handle the node through the maintenance procedure. Check that no Pods or ENIs use the secondary subnets before removing ENIConfig, security groups, subnets, or the CIDR. Do not force-delete ENIs or modify cluster 2 resources.

Reference: [AWS VPC CNI Custom Networking](https://docs.aws.amazon.com/eks/latest/userguide/cni-custom-network.html). Report this VPC/CNI change separately from the mixed-pool exercise.

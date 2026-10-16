# Lab Session: Custom Networking on the Existing `eks-workload` Cluster

> Goal: enable and validate Amazon VPC CNI Custom Networking on the existing `eks-workload` cluster. The cluster and its node subnets are reused; no new EKS cluster is created.

---

## 1. Scope and safety boundary

This is a **shared-VPC, existing-cluster change**. The commands are documented for a planned lab session and have not been executed while writing this document.

Read-only inventory confirmed:

| Property | Value |
|---|---|
| Profile / account | `eks-core` / `<AWS_ACCOUNT_ID>` |
| Region | `ap-northeast-1` |
| VPC | `eks-lab` — `<VPC_ID>` |
| Target cluster | `eks-workload`, `ACTIVE`, Kubernetes `1.34` |
| Existing node subnets | `10.20.16.0/20` (1a), `10.20.32.0/20` (1c), `10.20.48.0/20` (1d) |
| Managed node group | `infra-5d1225fb4bce159c178a05277b`, 3 × `t3.large`, desired `3`, max `4` |
| Cluster security group | `<SECURITY_GROUP_ID>` |
| VPC CNI add-on | `v1.23.0-eksbuild.1`; Prefix Delegation enabled with `WARM_PREFIX_TARGET=1` |

The session does **not** create another EKS cluster, node subnet, or node group. It reuses the existing cluster, workload node subnets, managed node group, and Prefix Delegation configuration. It creates one dedicated security group for the secondary Pod ENIs so the lab's network rules are explicit and removable.

Custom Networking cannot be implemented using only the existing `10.20.0.0/16` address space: it requires Pod subnets carved from a secondary VPC CIDR. Therefore, the only new network resources in this session are:

- a secondary VPC CIDR, `100.64.0.0/16`; and
- three dedicated private Pod subnets, one in each existing Availability Zone; and
- one dedicated security group for Pod ENIs.

Do **not** run this session against `eks-observability`.

## 2. What changes and what does not

```text
Before
  Node primary ENI: 10.20.x.x
  Pod IP:           10.20.x.x

After Custom Networking
  Node primary ENI: 10.20.x.x       (unchanged)
  Pod ENI / Pod IP: 100.64.x.x      (new secondary VPC CIDR)
```

The Amazon VPC CNI remains VPC-native: Pod addresses are real VPC addresses, not overlay addresses. A node's primary ENI remains responsible for node traffic and traffic SNAT outside the VPC. VPC CNI creates secondary ENIs in the Pod subnets and assigns their addresses or delegated prefixes to application Pods.

`100.64.0.0/10` is RFC 6598 CGNAT address space. It is commonly used for Pod CIDRs, but must not overlap with on-premises networks, Transit Gateway attachments, or peered VPCs. Custom Networking does not solve overlapping-CIDR connectivity by itself.

## 3. Target topology

```text
Existing VPC eks-lab
├── Existing primary CIDR: 10.20.0.0/16
│   └── Reused eks-workload node subnets
│       ├── 10.20.16.0/20  (ap-northeast-1a)
│       ├── 10.20.32.0/20  (ap-northeast-1c)
│       └── 10.20.48.0/20  (ap-northeast-1d)
│
└── New secondary CIDR: 100.64.0.0/16
    └── New Custom Networking Pod subnets
        ├── 100.64.0.0/20   (ap-northeast-1a)
        ├── 100.64.16.0/20  (ap-northeast-1c)
        └── 100.64.32.0/20  (ap-northeast-1d)
```

Each Pod subnet must be in the same Availability Zone as its corresponding node subnet. An ENI cannot be attached across Availability Zones.

## 4. Preconditions and change controls

This change updates the `vpc-cni` add-on configuration across the cluster. Run it only in an approved maintenance window, with an application rollback owner available.

Before starting:

- Confirm `100.64.0.0/16` does not overlap with corporate routing.
- Confirm that adding a secondary CIDR to shared VPC `eks-lab` is approved.
- Confirm that the existing cluster security group can be used as the inbound source for the dedicated Pod ENI security group.
- Confirm that the managed node group may temporarily scale from three to four nodes.
- Back up the current add-on configuration and record the current node count.
- Do not alter the CNI settings on `eks-observability`.

Set the session variables:

```bash
export AWS_PROFILE=eks-core
export AWS_REGION=ap-northeast-1
export VPC_ID=<VPC_ID>
export CLUSTER_NAME=eks-workload
export NODEGROUP_NAME=infra-5d1225fb4bce159c178a05277b
export CLUSTER_SG_ID=<SECURITY_GROUP_ID>
```

Reconfirm the target before every write operation:

```bash
aws sts get-caller-identity

aws eks describe-cluster \
  --region "$AWS_REGION" \
  --name "$CLUSTER_NAME" \
  --query 'cluster.{Name:name,Status:status,VpcId:resourcesVpcConfig.vpcId,Subnets:resourcesVpcConfig.subnetIds}' \
  --output table

aws eks describe-addon \
  --region "$AWS_REGION" \
  --cluster-name "$CLUSTER_NAME" \
  --addon-name vpc-cni \
  --query 'addon.{Version:addonVersion,Status:status,Configuration:configurationValues}' \
  --output json
```

## 5. Step 1 — Associate the secondary VPC CIDR

> This changes shared-VPC state. Do not run outside an approved change window.

```bash
aws ec2 associate-vpc-cidr-block \
  --vpc-id "$VPC_ID" \
  --cidr-block 100.64.0.0/16

aws ec2 describe-vpcs \
  --vpc-ids "$VPC_ID" \
  --query 'Vpcs[0].CidrBlockAssociationSet[].{CIDR:CidrBlock,State:CidrBlockState.State}' \
  --output table
```

Continue only after `100.64.0.0/16` reaches the `associated` state.

## 6. Step 2 — Create the three Pod subnets

These are **Pod-only** subnets for ENIConfig. Do not launch nodes in them.

```bash
POD_SUBNET_1A=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 100.64.0.0/20 --availability-zone ap-northeast-1a --query 'Subnet.SubnetId' --output text)
POD_SUBNET_1C=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 100.64.16.0/20 --availability-zone ap-northeast-1c --query 'Subnet.SubnetId' --output text)
POD_SUBNET_1D=$(aws ec2 create-subnet --vpc-id "$VPC_ID" --cidr-block 100.64.32.0/20 --availability-zone ap-northeast-1d --query 'Subnet.SubnetId' --output text)

aws ec2 create-tags \
  --resources "$POD_SUBNET_1A" "$POD_SUBNET_1C" "$POD_SUBNET_1D" \
  --tags Key=Name,Value=eks-workload-custom-networking-pod Key=Lab,Value=eks-custom-networking
```

Associate the Pod subnets with the appropriate existing private route tables. If the cluster requires image-pull or Internet egress, the route table needs the existing NAT path. Do not enable public IPv4 assignment or associate the Pod subnets with a public route table.

The VPC `local` route must cover both VPC CIDRs:

```text
10.20.0.0/16  -> local
100.64.0.0/16 -> local
```

## 7. Step 3 — Create a security group for Pod ENIs

This security group applies to the CNI-created secondary ENIs. It is not the separate **Security Groups for Pods** feature that assigns an individual security group to each Pod.

The following paste-once command creates `eks-workload-custom-networking-pod`, retains the default allow-all outbound rule for image pulls and testing, and allows inbound traffic from the existing EKS cluster security group:

```bash
export POD_SG_ID=$(
  aws ec2 create-security-group \
    --group-name eks-workload-custom-networking-pod \
    --description "Pod ENIs for EKS Custom Networking lab" \
    --vpc-id "$VPC_ID" \
    --tag-specifications 'ResourceType=security-group,Tags=[{Key=Name,Value=eks-workload-custom-networking-pod},{Key=Lab,Value=eks-custom-networking}]' \
    --query GroupId \
    --output text
)

aws ec2 authorize-security-group-ingress \
  --group-id "$POD_SG_ID" \
  --ip-permissions "[{
    \"IpProtocol\":\"-1\",
    \"UserIdGroupPairs\":[{
      \"GroupId\":\"$CLUSTER_SG_ID\",
      \"Description\":\"Allow traffic from EKS cluster security group\"
    }]
  }]"

echo "POD_SG_ID=$POD_SG_ID"
```

If a security group with the same name already exists, the create command fails rather than silently reusing it. Inspect and explicitly reuse or remove that existing resource before retrying.

## 8. Step 4 — Create ENIConfig by Availability Zone

Create `labs/custom-networking/eni-configs.yaml` and replace the subnet placeholders:

```yaml
apiVersion: crd.k8s.amazonaws.com/v1alpha1
kind: ENIConfig
metadata:
  name: ap-northeast-1a
spec:
  subnet: POD_SUBNET_1A_ID
  securityGroups:
    - POD_SECURITY_GROUP_ID
---
apiVersion: crd.k8s.amazonaws.com/v1alpha1
kind: ENIConfig
metadata:
  name: ap-northeast-1c
spec:
  subnet: POD_SUBNET_1C_ID
  securityGroups:
    - POD_SECURITY_GROUP_ID
---
apiVersion: crd.k8s.amazonaws.com/v1alpha1
kind: ENIConfig
metadata:
  name: ap-northeast-1d
spec:
  subnet: POD_SUBNET_1D_ID
  securityGroups:
    - POD_SECURITY_GROUP_ID
```

Replace `POD_SECURITY_GROUP_ID` with the value printed as `POD_SG_ID`, then connect to the existing cluster and apply the configuration:

```bash
aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"
kubectl config current-context
kubectl apply -f labs/custom-networking/eni-configs.yaml
kubectl get eniconfig
```

The ENIConfig names match `topology.kubernetes.io/zone`, enabling automatic per-AZ selection by VPC CNI.

## 9. Step 5 — Update the existing VPC CNI add-on

The current add-on already has Prefix Delegation enabled. Preserve that configuration while adding Custom Networking variables. Because `vpc-cni` is EKS-managed, update the add-on configuration rather than editing the DaemonSet directly.

First, save the existing configuration for rollback:

```bash
aws eks describe-addon \
  --region "$AWS_REGION" \
  --cluster-name "$CLUSTER_NAME" \
  --addon-name vpc-cni \
  --query 'addon.configurationValues' \
  --output text > labs/custom-networking/vpc-cni-configuration-before-custom-networking.json
```

Apply the cluster-wide configuration:

```bash
aws eks update-addon \
  --region "$AWS_REGION" \
  --cluster-name "$CLUSTER_NAME" \
  --addon-name vpc-cni \
  --resolve-conflicts PRESERVE \
  --configuration-values '{
    "env": {
      "ENABLE_PREFIX_DELEGATION": "true",
      "WARM_PREFIX_TARGET": "1",
      "AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG": "true",
      "ENI_CONFIG_LABEL_DEF": "topology.kubernetes.io/zone"
    }
  }'
```

Wait for completion and verify the final configuration:

```bash
aws eks wait addon-active \
  --region "$AWS_REGION" \
  --cluster-name "$CLUSTER_NAME" \
  --addon-name vpc-cni

kubectl -n kube-system rollout status daemonset/aws-node
kubectl -n kube-system set env daemonset/aws-node --list | \
  rg 'ENABLE_PREFIX_DELEGATION|WARM_PREFIX_TARGET|AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG|ENI_CONFIG_LABEL_DEF'
```

> Existing Pods retain their current networking. AWS recommends using new nodes and draining old nodes when moving to Custom Networking. This session uses a single canary node added to the existing managed node group instead of creating a new EKS cluster.

## 10. Step 6 — Add one canary node to the existing managed node group

The current managed node group has `desiredSize=3` and `maxSize=4`. Scale it to four nodes to add one canary while retaining the existing three nodes:

```bash
aws eks update-nodegroup-config \
  --region "$AWS_REGION" \
  --cluster-name "$CLUSTER_NAME" \
  --nodegroup-name "$NODEGROUP_NAME" \
  --scaling-config minSize=3,maxSize=4,desiredSize=4
```

Wait for the node group to finish updating, then identify the added node:

```bash
aws eks wait nodegroup-active \
  --region "$AWS_REGION" \
  --cluster-name "$CLUSTER_NAME" \
  --nodegroup-name "$NODEGROUP_NAME"

kubectl get nodes -l role=infra -o wide
```

During a quiet window, select the newly added node and isolate it for the canary workload:

```bash
export CANARY_NODE=REPLACE_WITH_THE_NEW_NODE_NAME

kubectl label node "$CANARY_NODE" lab.eks-core/custom-network=true
kubectl taint node "$CANARY_NODE" custom-network-lab=true:NoSchedule
```

The taint prevents ordinary workloads from landing on the canary after it is applied. Run this promptly after the node becomes available; for a strict scheduling isolation guarantee, use the existing infrastructure-as-code workflow to define the label and taint before the node is created.

## 11. Step 7 — Deploy the canary workload

Create `labs/custom-networking/custom-network-test.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: custom-network-lab
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: netcheck
  namespace: custom-network-lab
spec:
  replicas: 3
  selector:
    matchLabels:
      app: netcheck
  template:
    metadata:
      labels:
        app: netcheck
    spec:
      nodeSelector:
        lab.eks-core/custom-network: "true"
      tolerations:
        - key: custom-network-lab
          operator: Equal
          value: "true"
          effect: NoSchedule
      containers:
        - name: curl
          image: curlimages/curl:8.11.1
          command: ["sh", "-c", "sleep 3600000"]
          resources:
            requests:
              cpu: 25m
              memory: 32Mi
```

```bash
kubectl apply -f labs/custom-networking/custom-network-test.yaml
kubectl -n custom-network-lab rollout status deployment/netcheck
kubectl -n custom-network-lab get pods -o wide

POD_NAME=$(kubectl -n custom-network-lab get pod -l app=netcheck -o jsonpath='{.items[0].metadata.name}')
kubectl -n custom-network-lab exec "$POD_NAME" -- ip -4 addr
kubectl -n custom-network-lab exec "$POD_NAME" -- ip route
```

**Pass condition:** every `netcheck` Pod is on the canary node and receives an IP in `100.64.0.0/20`, `100.64.16.0/20`, or `100.64.32.0/20`. The canary node's internal IP remains in the existing `10.20.x.x` node subnet.

## 12. Step 8 — Verify ENIs and traffic

In EC2 Console > **Network Interfaces**, filter by the new Pod subnets. You should see secondary ENIs created by VPC CNI and carrying `100.64.x.x` addresses or prefixes.

```bash
aws ec2 describe-network-interfaces \
  --filters "Name=subnet-id,Values=$POD_SUBNET_1A,$POD_SUBNET_1C,$POD_SUBNET_1D" \
  --query 'NetworkInterfaces[].{ENI:NetworkInterfaceId,Subnet:SubnetId,IPs:PrivateIpAddresses[].PrivateIpAddress,Description:Description,Status:Status}' \
  --output table
```

Optionally, use an existing private HTTP endpoint in the VPC that permits TCP from `100.64.0.0/16`. Its logs should show the Pod's `100.64.x.x` source address, proving that the Pod has a VPC-routable IP rather than an overlay IP.

For Internet egress, if the existing private route table includes NAT egress:

```bash
kubectl -n custom-network-lab exec "$POD_NAME" -- curl -fsS https://checkip.amazonaws.com
```

The response is expected to be the NAT Gateway public EIP, rather than the Pod IP, because traffic is source-NATed on the egress path.

## 13. Troubleshooting

| Symptom | Check | Likely cause |
|---|---|---|
| Pod has `10.20.x.x` | Canary-node label, ENIConfig, `aws-node` environment | Pod ran on an existing node, or CNI did not select the AZ configuration. |
| Pod is Pending / cannot receive an IP | `aws-node` logs, free IPs, IAM | Pod subnet lacks addresses, ENIConfig has wrong AZ/subnet, or CNI lacks EC2 permissions. |
| No secondary ENI | Instance ENI limit, CNI logs | Node and ENIConfig are in different AZs, or the instance reached its ENI limit. |
| Image pull fails | Private route table, NAT, security-group egress | No egress route or a network rule blocks traffic. |
| Cannot reach on-premises | TGW/peering route, CIDR overlap | CGNAT CIDR is not routed or overlaps; consider a Private NAT Gateway. |

```bash
kubectl -n kube-system logs -l k8s-app=aws-node --all-containers --tail=200
kubectl -n kube-system get events --sort-by=.lastTimestamp
kubectl -n custom-network-lab get pods -o wide
```

## 14. Rollback and cleanup

> Do not delete or modify resources belonging to `eks-observability`. Delete only the test namespace and network resources tagged `Lab=eks-custom-networking`.

1. Delete the test namespace:

   ```bash
   kubectl delete namespace custom-network-lab
   ```

2. Remove the taint and label from the canary node. Keep the fourth node until application owners confirm that it is safe to remove it:

   ```bash
   kubectl taint node "$CANARY_NODE" custom-network-lab=true:NoSchedule-
   kubectl label node "$CANARY_NODE" lab.eks-core/custom-network-
   ```

3. Restore the exact VPC CNI configuration that was saved in Step 4. Wait for the add-on and `aws-node` rollout to become healthy before removing Pod subnets:

   ```bash
   aws eks update-addon \
     --region "$AWS_REGION" \
     --cluster-name "$CLUSTER_NAME" \
     --addon-name vpc-cni \
     --resolve-conflicts PRESERVE \
     --configuration-values file://labs/custom-networking/vpc-cni-configuration-before-custom-networking.json

   aws eks wait addon-active \
     --region "$AWS_REGION" \
     --cluster-name "$CLUSTER_NAME" \
     --addon-name vpc-cni
   ```

4. Only if the node removal is approved, drain the specific canary node and return the existing node group to desired size three. Use a targeted Auto Scaling Group termination procedure approved by the platform owner; do not blindly reduce capacity on a production node group.

5. Confirm no VPC CNI/EKS ENIs or Pods use `100.64.x.x`, then delete the dedicated Pod security group, the three tagged Pod subnets, and disassociate `100.64.0.0/16`.

Mandatory dependency checks before deleting the Pod subnets or CIDR:

```bash
aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'Subnets[?starts_with(CidrBlock, `100.64.`)].{SubnetId:SubnetId,CIDR:CidrBlock,State:State}' \
  --output table

aws ec2 describe-network-interfaces \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'NetworkInterfaces[?starts_with(PrivateIpAddress, `100.64.`)].{ENI:NetworkInterfaceId,IP:PrivateIpAddress,Status:Status}' \
  --output table
```

If any dependency remains, identify its owner and stop. Never force-delete an ENI.

## 15. Completion checklist

- [ ] Existing `eks-workload` cluster was used; no EKS cluster was created.
- [ ] Existing `10.20.x.x` node subnets, managed node group, and Prefix Delegation were reused.
- [ ] Secondary CIDR `100.64.0.0/16` and three dedicated Pod subnets were created.
- [ ] A dedicated security group was created and used by every ENIConfig.
- [ ] ENIConfig was created for every existing Availability Zone.
- [ ] A canary node was added through the existing managed node group.
- [ ] `netcheck` Pods received `100.64.x.x` addresses while the node retained `10.20.x.x`.
- [ ] Secondary ENIs appeared in the new Pod subnets.
- [ ] Rollback was completed, or the retained Custom Networking configuration was explicitly approved and recorded.

## AWS references

- [Configure custom networking with the Amazon VPC CNI](https://docs.aws.amazon.com/eks/latest/userguide/cni-custom-network-tutorial.html)
- [EKS networking best practices](https://docs.aws.amazon.com/eks/latest/best-practices/networking.html)
- [Prefix mode for Linux](https://docs.aws.amazon.com/eks/latest/best-practices/prefix-mode-linux.html)
- [Subnet CIDR reservations](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-cidr-reservation.html)

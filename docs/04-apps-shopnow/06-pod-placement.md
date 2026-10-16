---
title: "Step 7b - Distribute replicas across worker nodes"
---

# Verify placement and distribution

## 1. Prove backends run on the mixed group

```bash
kubectl --context eks-workload -n shopnow get pods -o wide
kubectl --context eks-workload get nodes -L workload,role,capacity,kubernetes.io/arch,topology.kubernetes.io/zone
```

Join each backend Pod's `spec.nodeName` with its node labels. Require `workload=microservices`; an EC2 name alone is insufficient. The frontend chart currently has no mixed selector, so it is not backend-placement evidence.

## 2. Current settings and their meaning

Backend Deployment templates use AZ `DoNotSchedule` and hostname `ScheduleAnyway`, rendered only for `replicaCount>1`. Hostname distribution is therefore a soft preference. Adding a constraint does not relocate existing Pods automatically; roll out a new template or replace Pods in a controlled manner.

To require at least two nodes and two zones for multi-replica services, replace the **entire `topologySpreadConstraints` block** in all six backend Deployment templates with this block, inside the existing `replicaCount>1` condition. Single-replica Eureka will not render it.

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    minDomains: 2
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    nodeAffinityPolicy: Honor
    nodeTaintsPolicy: Honor
    labelSelector:
      matchLabels:
        app: {{ .Values.global.appName }}
    matchLabelKeys:
      - pod-template-hash
  - maxSkew: 1
    minDomains: 2
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
    nodeAffinityPolicy: Honor
    nodeTaintsPolicy: Honor
    labelSelector:
      matchLabels:
        app: {{ .Values.global.appName }}
    matchLabelKeys:
      - pod-template-hash
```

Keep the original indentation. Apply through commit → ArgoCD, rather than live patches that self-heal reverts. Two domains require real capacity: with only one available AZ/host, some Pods remain Pending instead of violating the distribution. `nodeTaintsPolicy: Honor` avoids counting tainted nodes the Pod cannot use.

Required hostname anti-affinity can also prevent colocated replicas, but generally requires one node per replica. The workshop uses topology spread so three replicas can distribute 2/1 over two nodes.

## 3. Verify with the proof workload

`workshop-proof` already has three replicas, mandatory hostname spread, and `minDomains=2`. It is an independent test, not a substitute for checking ShopNow's configuration.

```bash
kubectl --context eks-workload -n shopnow get pods -l app=workshop-proof \
  -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,READY:.status.containerStatuses[0].ready
kubectl --context eks-workload -n shopnow describe deployment workshop-proof
kubectl --context eks-workload get nodes -l workload=microservices -L topology.kubernetes.io/zone
```

## 4. Evaluate the distribution

Build a table **per service and revision**: node/zone → replica count. With maxSkew 1, the difference between the largest and smallest counts across eligible domains must not exceed 1. Include eligible domains with zero replicas; counting only nodes already hosting Pods can hide imbalance.

Every worker does not need the same total Pod count: infra, batch, and ARM64 serve different purposes; DaemonSets and service requests also differ. Constraint-related Pending Pods are acceptance information, not a reason to silently remove the constraint.

Reference: [Kubernetes topology spread](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/).

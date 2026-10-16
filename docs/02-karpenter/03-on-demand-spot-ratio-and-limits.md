---
title: "Mixed group - Understand and verify the 1:3 ratio"
---

# Which ratio are you measuring?

The assignment specifies On-Demand:Spot = 1:3. State whether your report measures **node count**, **total vCPU**, or **replica count**. These ratios differ when instance sizes differ.

## What does the current configuration do?

`ms-od` has weight 100 and CPU limit 24; `ms-spot` has weight 10 and CPU limit 72. Both share labels/taints. Karpenter prefers higher-weight pools during provisioning, but can reuse existing nodes or select another pool to satisfy constraints. Limit checks are eventually consistent and can temporarily overrun during rapid scaling.

24:72 expresses a **maximum vCPU budget**, not a constant one-On-Demand-to-three-Spot node guarantee. Low load may use only On-Demand. This is a limitation of this implementation; do not claim an exact ratio from YAML alone.

## 1. Measure running capacity

```bash
kubectl --context eks-workload get nodes -l workload=microservices -o json > .workshop/evidence/mixed-nodes.json
python3 - <<'REPORT'
import json,collections
nodes=json.load(open('.workshop/evidence/mixed-nodes.json'))['items']
stats=collections.defaultdict(lambda:[0,0])
for n in nodes:
    labels=n['metadata']['labels']
    kind=labels.get('karpenter.sh/capacity-type','unknown')
    cpu=int(n['status']['capacity']['cpu'])
    stats[kind][0]+=1; stats[kind][1]+=cpu
    print(n['metadata']['name'],kind,cpu,labels.get('node.kubernetes.io/instance-type'))
for kind,(count,cpu) in sorted(stats.items()):
    print(kind,'nodes=',count,'vCPU=',cpu)
REPORT
```

Record the timestamp and active workload. Exclude infra Managed Node Group and ARM64 nodes from the mixed ratio.

## 2. Test one plus three in an unused mixed environment

This test provisions at least 16 vCPUs of billable capacity. Run it **before deploying ShopNow**, when no workloads/nodes use these pools. If applications already exist, use the measurements above or schedule a dedicated test; do not delete nodes indiscriminately to prepare a fixture.

```bash
kubectl --context eks-workload get nodes -l workload=microservices
kubectl --context eks-workload get pods -A -o wide
```

Start only when no mixed nodes or other consumers use the two pools. Save configuration, then temporarily require the same 4-vCPU instance size:

```bash
kubectl --context eks-workload get nodepool ms-od ms-spot -o yaml > .workshop/mixed-pools-before-test.yaml
kubectl --context eks-workload patch nodepool ms-od --type=json -p='[{"op":"add","path":"/spec/template/spec/requirements/-","value":{"key":"karpenter.k8s.aws/instance-cpu","operator":"In","values":["4"]}},{"op":"replace","path":"/spec/limits/cpu","value":"4"}]'
kubectl --context eks-workload patch nodepool ms-spot --type=json -p='[{"op":"add","path":"/spec/template/spec/requirements/-","value":{"key":"karpenter.k8s.aws/instance-cpu","operator":"In","values":["4"]}},{"op":"replace","path":"/spec/limits/cpu","value":"12"}]'
kubectl --context eks-workload apply -f examples/workshop/ratio-proof.yaml
kubectl --context eks-workload rollout status deployment/workshop-ratio --timeout=10m
```

The first Pod requires On-Demand to create baseline capacity. Each Pod requests 3 vCPUs, so two cannot fit on one 4-vCPU node. Once the first replica is Ready, remove its capacity pin and increase replicas to four:

```bash
kubectl --context eks-workload patch deployment workshop-ratio --type=merge \
  -p '{"spec":{"replicas":4,"template":{"spec":{"nodeSelector":{"capacity":null}}}}}'
kubectl --context eks-workload rollout status deployment/workshop-ratio --timeout=10m
kubectl --context eks-workload get pods -l app=workshop-ratio -o wide
kubectl --context eks-workload get nodes -l workload=microservices \
  -L karpenter.sh/capacity-type,node.kubernetes.io/instance-type
```

Repeat the measurements. Pass at the observed test point if there is exactly one On-Demand node plus three Spot nodes, each with 4 vCPUs, and four Ready Pods. For overrun or unavailable Spot capacity, record the actual result as **Not passed**; this is not a mechanism guaranteeing a permanent ratio. RollingUpdate can create a temporary surge Pod, so wait for stability before measuring.

## 3. Restore configuration

```bash
kubectl --context eks-workload delete -f examples/workshop/ratio-proof.yaml
kubectl --context eks-workload apply -f platform/nodepools/nodepool-2-ondemand.yaml
kubectl --context eks-workload apply -f platform/nodepools/nodepool-2-spot.yaml
kubectl --context eks-workload get nodepools ms-od ms-spot -o yaml
```

If pre-test configuration differed from Git, restore the saved version after removing runtime metadata; do not overwrite another team's changes. Wait for consolidation and verify EC2 resources after testing.

## 4. If a continuous 1:3 node ratio is mandatory

An additional design must control capacity count/size or explicitly partition replicas, with validation during scaling and failures. Two weights alone do not provide that guarantee. This workshop retains the current baseline/overflow approach and reports its limits transparently.

References: [weighted scheduling](https://karpenter.sh/docs/concepts/scheduling/), [NodePool limits](https://karpenter.sh/docs/concepts/nodepools/).

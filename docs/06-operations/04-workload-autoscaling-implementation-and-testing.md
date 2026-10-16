---
title: "Extension - Deploy and test HPA, CPA, and KEDA"
---

# Enable scaling after availability tests pass

Scale-to-zero conflicts with a test requiring two Ready replicas at all times. Disable scaling experiments or use separate targets during PDB/EFS acceptance.

## 1. Metrics Server belongs to Terraform

```bash
kubectl --context eks-workload -n kube-system get deployment metrics-server
kubectl --context eks-workload top pods -n shopnow
```

Do not install a second release. For `<unknown>` metrics, inspect APIService/metrics-server logs first.

## 2. Repair the HPA target before enabling it

`templates/hpa.yaml` currently uses helper fullname, while the Deployment is named `<global.appName>-deployment`. Update all six backend charts before enabling HPA:

```yaml
scaleTargetRef:
  apiVersion: apps/v1
  kind: Deployment
  name: {{ .Values.global.appName }}-deployment
```

Set the namespace from `global.namespace`. Add `behavior.scaleDown.stabilizationWindowSeconds: 300` under `spec` to avoid overly rapid scale-down when appropriate. Render and confirm `scaleTargetRef.name` matches the Deployment, rather than validating YAML syntax alone.

The Deployment should render `replicas` only when the chart owns that field. For external scaling, set Application `ignoreDifferences` on `/spec/replicas` and `RespectIgnoreDifferences=true`; otherwise ArgoCD can keep restoring the values-defined replica count.

## 3. Enable CPU HPA for one service

In the values the Application reads, enable autoscaling with minimum 2, maximum 6, and CPU target 70. CPU requests must exist. Commit/push, sync, then inspect:

```bash
kubectl --context eks-workload -n shopnow get hpa
kubectl --context eks-workload -n shopnow describe hpa
```

Generate actual API load and observe target percentage, desired/current replicas, and NodeClaims. Exceeding the CPU target need not create a node if existing workers have capacity. Stop load and measure scale-down instead of promising a fixed duration.

## 4. KEDA: one owner per target

Install a pinned KEDA chart and verify CRDs/operator/metrics adapter. Values and ScaledObjects exist, but Terraform currently does not install the KEDA release. Before applying:

1. Disable plain HPA on that Deployment.
2. Configure ArgoCD to stop managing `/spec/replicas` for the existing target.
3. Confirm the ScaledObject uses the correct Deployment name.
4. Apply `platform/addons/keda/shopnow-scaledobjects.yaml` through the selected owner.

Current ScaledObjects combine a weekday 09:00–19:00 Vietnam-time cron trigger with Prometheus **CPU usage**, not HTTP RPS. `minReplicaCount=0` can stop services outside that window. CPU from stopped Pods is not an independent request signal capable of waking them; cron is the remaining activation source in this configuration.

For an immediate test, create a separate Deployment/ScaledObject with a short cron window. Do not alter the business schedule of a used application just for a demo.

## 5. CPA for CoreDNS

The manifest is `platform/addons/cluster-proportional-autoscaler/coredns-autoscaler.yaml`. Verify target deployment/coredns and EKS add-on autoscaling before applying; two controllers must not compete for replicas. Test only when another autoscaler does not own CoreDNS scaling.

After applying, inspect CPA logs and CoreDNS replicas against node/core count. Restore previous settings afterward; deleting CPA does not reset CoreDNS replicas automatically.

## 6. Restore

Remove ScaledObjects before uninstalling KEDA and return replica ownership to Git. Disable HPA through values and sync. Delete load generators. Recheck PDB/replica counts before returning to the core lab.

References: [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/), [KEDA concepts](https://keda.sh/docs/latest/concepts/).

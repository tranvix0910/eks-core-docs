---
title: "Load Balancer Controller: route traffic to applications"
---

# Verify load balancing before exposing services

LBC translates Services/Ingresses into AWS load balancers. Terraform now passes `clusterName`, region, and VPC ID directly to the chart. Separate values files containing old environment IDs are not the effective source for this release.

## 1. Check the controller and IAM

```bash
kubectl --context eks-workload -n kube-system get deployment aws-load-balancer-controller
kubectl --context eks-workload -n kube-system logs deployment/aws-load-balancer-controller --tail=80
aws eks list-pod-identity-associations --cluster-name eks-workload
helm --kube-context eks-workload -n kube-system get values aws-load-balancer-controller
```

Pod Identity must associate the correct `kube-system/aws-load-balancer-controller` ServiceAccount. Adding an IRSA annotation is not a general fix for AccessDenied.

## 2. Create application ingress through ArgoCD

Backend charts create Ingresses in `shopnow`, using `target-type: ip`, the `eks-workload` group, and separate listener ports. The ALB targets Pod IPs; security groups must allow the **container target port**, not only the Service port.

```bash
kubectl --context eks-workload -n shopnow get ingress
kubectl --context eks-workload -n shopnow describe ingress shopnow-api-gateway-ingress
kubectl --context eks-workload -n shopnow get endpointslices \
  -l kubernetes.io/service-name=shopnow-api-gateway-service
```

If `ADDRESS` is empty, inspect Events/controller logs first. If DNS exists but requests return 503, check target health, Ready endpoints, and health-check paths.

## 3. Shared ALB and access controls

A shared group reduces ALB count, but all participating ingress resources affect listeners/rules. Restrict ingress creation in that group to trusted operators. A namespace is not an IngressGroup security boundary.

The core lab can use port-forward for UI/API access. For public ingress, set `inboundCidrs` to the class's approved IP/VPN range before deployment. Do not retain `0.0.0.0/0` for admin tools.

## 4. Internal telemetry ALB

Use the separate `eks-observability-internal` group, HTTPS listeners 9009/3100, an ACM certificate, and the node SG from Layer 20. Follow the [TLS lab](03-cert-manager-and-internal-tls.md); do not place internal ingress in the public group.

| Symptom | First check |
|---|---|
| `Evaluated 0 subnets` | Effective VPC/region in Helm values and subnet tags |
| `AccessDenied` | Pod Identity association, logged IAM action, SCP |
| 503 | Ready endpoints, target health, SG path to gateway/Pod |
| 404 | Ingress path, host, and application controller route |
| TLS failure | SAN hostname, ACM region, client CA trust |

Compare rendered configuration with AWS before changing several annotations at once.

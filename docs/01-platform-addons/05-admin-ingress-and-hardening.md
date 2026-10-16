---
title: "Access tools and manage endpoints"
---

# Open workshop tools

Port-forward is the default classroom access method. It avoids personal hostnames in documentation and unnecessary Internet exposure of admin tools.

## Access terminals

Run each command in a separate terminal:

```bash
kubectl --context eks-workload -n argocd port-forward svc/argocd-server 8080:80
```

```bash
kubectl --context eks-workload -n monitoring port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
```

```bash
kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080
```

```bash
kubectl --context eks-observability -n monitoring port-forward svc/grafana 3000:80
```

The ArgoCD release currently uses `--insecure`; access it at `http://localhost:8080`. Centralized Grafana is at `http://localhost:3000`. If a Service name differs, inspect `kubectl get svc` instead of guessing.

## Login credentials

```bash
kubectl --context eks-workload -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 --decode
kubectl --context eks-observability -n monitoring get secret grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode
```

Read credentials only in a personal terminal; do not redirect them into evidence. Cluster 1 Grafana uses a different Secret and is not the centralized Grafana account. The initial ArgoCD Secret may have been removed after a password change; use the current login method in that case.

## If a public ALB is required

`admin-ingress.yaml` shares the `eks-workload` group on ports 80/9090/9093/8081. Before applying it:

1. Restrict `inbound-cidrs` to approved VPN/IP ranges.
2. For a stable endpoint, use a domain you control and an appropriate ACM certificate.
3. Protect Prometheus/Alertmanager/JavaMelody with authentication at the access layer; an obscure URL is not protection.
4. Review both the Terraform-created Grafana ingress in cluster 1 and ingress in cluster 2, rather than updating only one manifest.

JavaMelody can expose SQL, threads, and system properties. Use synthetic data in the workshop. Stop port-forwards with Ctrl+C afterward; remove unused public ingress under its correct owner to release load balancers.

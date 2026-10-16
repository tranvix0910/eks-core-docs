# Shared Administrative Ingress & Security Hardening

Technical documentation on the consolidated administrative Ingress ([admin-ingress.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/ingress/admin-ingress.yaml)), listener port mappings, lab security tradeoffs, and production hardening recommendations.

---

## 1. Structure of `admin-ingress.yaml`

File [admin-ingress.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/ingress/admin-ingress.yaml) consolidates all operational dashboards into **1 single Public ALB** on `eks-workload`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: admin-ingress
  namespace: argocd
  annotations:
    alb.ingress.kubernetes.io/group.name: "eks-workload"
    alb.ingress.kubernetes.io/group.order: "10"
    alb.ingress.kubernetes.io/scheme: "internet-facing"
    alb.ingress.kubernetes.io/target-type: "ip"
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTP": 9090}, {"HTTP": 9093}, {"HTTP": 8081}]'
```

### Ingress Rules:
* Port **`80`** -> `argocd-server` (ArgoCD Web UI)
* Port **`9090`** -> `prometheus-kube-prometheus-prometheus` (Prometheus Web UI)
* Port **`9093`** -> `prometheus-kube-prometheus-alertmanager` (Alertmanager Web UI)
* Port **`8081`** -> `javamelody-collector` (JavaMelody Application Performance Monitoring)

---

## 2. Lab Tradeoffs vs Production Hardening

### The Lab Setup (`0.0.0.0/0`):
In this demonstration lab environment:
* Inbound CIDR is set to `0.0.0.0/0` for immediate browser accessibility.
* Unauthenticated endpoints (Prometheus, Alertmanager, JavaMelody) are accessible to anyone with the ALB URL.
* Traffic runs over unencrypted HTTP on standard ports.

### Production Hardening Guidelines:
For production enterprise environments, apply the following controls:

1. **IP Whitelisting**: Restrict `alb.ingress.kubernetes.io/inbound-cidrs` to enterprise VPN / Bastion subnets.
2. **Mandatory HTTPS**: Attach public ACM certificates and force HTTP -> HTTPS 301 redirects.
3. **SSO / OIDC Authentication**: Integrate AWS Cognito or OIDC (Keycloak / Okta) directly on ALB listener rules.
4. **AWS WAF (Web Application Firewall)**: Attach AWS WAF to mitigate DDoS and block known malicious payloads.

// Short sidebar labels. Page titles stay as written in each doc; only the
// sidebar uses these, the way Dyte keeps its sidebar to two or three words.
module.exports = {
  'architecture/architecture-overview': 'Overview',
  'architecture/organizational-constraints-and-prerequisites': 'Constraints & Prerequisites',
  'architecture/layer-10-network': 'Layer 10 · Network',
  'architecture/layer-20-cluster-workload': 'Layer 20 · Workload Cluster',
  'architecture/layer-21-cluster-observability': 'Layer 21 · Observability Cluster',
  'architecture/custom-networking-lab-session': 'Lab · Custom Networking',

  'platform-addons/gitops-bootstrap-order': 'GitOps Bootstrap Order',
  'platform-addons/aws-load-balancer-controller': 'Load Balancer Controller',
  'platform-addons/cert-manager-and-internal-tls': 'cert-manager & Internal TLS',
  'platform-addons/rancher-multi-cluster': 'Rancher',
  'platform-addons/admin-ingress-and-hardening': 'Admin Ingress & Hardening',

  'karpenter/karpenter-two-halves-architecture': 'Two-Halves Architecture',
  'karpenter/ec2nodeclass-and-nodepools-configuration': 'EC2NodeClass & NodePools',
  'karpenter/on-demand-spot-ratio-and-limits': 'On-Demand / Spot Ratio',
  'karpenter/disruption-and-spot-interruption': 'Disruption & Interruption',

  'observability/observability-architecture-overview': 'Overview',
  'observability/mimir-metrics-pipeline': 'Mimir Metrics',
  'observability/loki-logging-pipeline': 'Loki Logging',
  'observability/grafana-dashboards': 'Grafana Dashboards',

  'apps-shopnow/shopnow-end-to-end-deployment-guide': 'End-to-End Deployment',
  'apps-shopnow/shopnow-microservices-architecture': 'Microservices Architecture',
  'apps-shopnow/shopnow-api-gateway': 'API Gateway',
  'apps-shopnow/blue-green-argo-rollouts': 'Blue-Green Rollouts',
  'apps-shopnow/docker-build-multi-arch-and-ci': 'Multi-Arch Docker Builds',

  'security/eks-pod-identity': 'Pod Identity',
  'security/sts-tokens-and-access-entries': 'STS Tokens & Access Entries',
  'security/secrets-management-and-rotation': 'Secrets & Rotation',
  'security/tls-certificate-lifecycle': 'TLS Certificate Lifecycle',

  'operations/tokyo-region-migration-runbook': 'Tokyo Region Migration',
  'operations/master-incident-catalogue': 'Incident Catalogue',
  'operations/system-verification-and-diagnostics': 'Verification & Diagnostics',
  'operations/workload-autoscaling-implementation-and-testing': 'Autoscaling Load Test',
};

// Sidebar = the workshop, in the order you run it. Each core page sets its own
// sidebar_label in front matter ("1.2 Cluster 1 · Workload"), so items here only
// list ids. Optional and reference pages sit in the last, collapsed group.

const doc = (id, label) => (label ? { type: 'doc', id, label } : { type: 'doc', id });
const section = (label, items, extra = {}) => ({
  type: 'category',
  label,
  // Docusaurus opens the active category automatically; keep the rest closed.
  collapsed: true,
  items,
  ...extra,
});

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
module.exports = {
  guides: [
    { type: 'doc', id: 'index', label: 'Workshop overview', className: 'guide_sidebar_index' },
    doc('platform-overview-and-deployment'),

    section('0 · Before you start', [
      doc('architecture/organizational-constraints-and-prerequisites'),
      doc('architecture/architecture-overview'),
      doc('architecture/architecture-diagrams'),
    ], { className: 'sb-icon sb-icon-book' }),

    section('1 · Infrastructure with Terraform', [
      doc('architecture/terraform-workflow'),
      doc('architecture/layer-10-network'),
      doc('architecture/layer-20-cluster-workload'),
      doc('architecture/layer-21-cluster-observability'),
    ], { className: 'sb-icon sb-icon-building' }),

    section('2 · Platform on cluster 1', [
      doc('platform-addons/gitops-bootstrap-order'),
      doc('karpenter/ec2nodeclass-and-nodepools-configuration'),
      doc('karpenter/on-demand-spot-ratio-and-limits'),
      doc('karpenter/arm64-validation'),
      doc('platform-addons/kite-dashboard'),
    ], { className: 'sb-icon sb-icon-servers' }),

    section('3 · Microservices', [
      doc('apps-shopnow/docker-build-multi-arch-and-ci'),
      doc('apps-shopnow/shopnow-end-to-end-deployment-guide'),
      doc('apps-shopnow/efs-persistent-volumes'),
      doc('apps-shopnow/pod-placement'),
      doc('apps-shopnow/availability-and-pdb'),
    ], { className: 'sb-icon sb-icon-puzzle' }),

    section('4 · Centralized observability', [
      doc('observability/observability-architecture-overview'),
      doc('platform-addons/cert-manager-and-internal-tls'),
      doc('observability/mimir-metrics-pipeline'),
      doc('observability/loki-logging-pipeline'),
      doc('observability/grafana-dashboards'),
    ], { className: 'sb-icon sb-icon-chart' }),

    section('5 · Accept and operate', [
      doc('operations/workshop-acceptance'),
      doc('operations/lifecycle-and-cleanup'),
      doc('operations/master-incident-catalogue', 'Troubleshooting'),
      doc('operations/system-verification-and-diagnostics', 'Diagnostics commands'),
    ], { className: 'sb-divider' }),

    {
      type: 'category',
      label: 'Extensions and reference',
      collapsed: true,
      className: 'sb-divider',
      items: [
        doc('apps-shopnow/shopnow-microservices-architecture', 'Microservices and ports'),
        doc('apps-shopnow/shopnow-api-gateway', 'API gateway checks'),
        doc('platform-addons/javamelody', 'Connect JavaMelody'),
        doc('karpenter-autoscaling-nodepools', 'Karpenter concepts'),
        doc('karpenter/karpenter-two-halves-architecture', 'Karpenter: AWS side vs controller'),
        doc('karpenter/disruption-and-spot-interruption', 'Consolidation and Spot interruption'),
        doc('workload-autoscaling-hpa-cpa-keda', 'Autoscaling: HPA, CPA, KEDA'),
        doc('operations/workload-autoscaling-implementation-and-testing', 'Autoscaling lab'),
        doc('blue-green-deployment-argo-rollouts', 'Release strategies'),
        doc('apps-shopnow/blue-green-argo-rollouts', 'Blue-green frontend'),
        doc('platform-addons/aws-load-balancer-controller', 'Load Balancer Controller'),
        doc('platform-addons/admin-ingress-and-hardening', 'Public admin ingress'),
        doc('eks-security', 'Security overview'),
        doc('security/eks-pod-identity', 'Pod Identity'),
        doc('security/sts-tokens-and-access-entries', 'Cluster access'),
        doc('security/secrets-management-and-rotation', 'Secrets'),
        doc('security/tls-certificate-lifecycle', 'Certificate renewal'),
        doc('platform-addons/rancher-multi-cluster', 'Rancher'),
        doc('architecture/custom-networking-lab-session', 'VPC CNI custom networking'),
        doc('service-mesh-and-istio', 'Service mesh (Istio)'),
        doc('operations/tokyo-region-migration-runbook', 'Deploy to another region'),
      ],
    },
  ],
};

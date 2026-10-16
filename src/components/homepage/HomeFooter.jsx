// Layout adapted from dyte-io/docs (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import ThemedImage from '@theme/ThemedImage';
import useBaseUrl from '@docusaurus/useBaseUrl';

const COLUMNS = [
  {
    name: 'Foundation',
    links: [
      { name: 'Platform overview', to: '/docs/platform-overview-and-deployment' },
      { name: 'Architecture', to: '/docs/architecture/architecture-overview' },
      { name: 'Network layer', to: '/docs/architecture/layer-10-network' },
      { name: 'Constraints & SCP', to: '/docs/architecture/organizational-constraints-and-prerequisites' },
    ],
  },
  {
    name: 'Platform',
    links: [
      { name: 'GitOps bootstrap', to: '/docs/platform-addons/gitops-bootstrap-order' },
      { name: 'Karpenter', to: '/docs/karpenter-autoscaling-nodepools' },
      { name: 'Observability', to: '/docs/observability/observability-architecture-overview' },
      { name: 'Grafana dashboards', to: '/docs/observability/grafana-dashboards' },
    ],
  },
  {
    name: 'Workloads',
    links: [
      { name: 'ShopNow architecture', to: '/docs/apps-shopnow/shopnow-microservices-architecture' },
      { name: 'API gateway', to: '/docs/apps-shopnow/shopnow-api-gateway' },
      { name: 'Workload autoscaling', to: '/docs/workload-autoscaling-hpa-cpa-keda' },
      { name: 'Service mesh', to: '/docs/service-mesh-and-istio' },
    ],
  },
  {
    name: 'Security & Ops',
    links: [
      { name: 'Pod Identity', to: '/docs/security/eks-pod-identity' },
      { name: 'Secrets & rotation', to: '/docs/security/secrets-management-and-rotation' },
      { name: 'Incident catalogue', to: '/docs/operations/master-incident-catalogue' },
      { name: 'Diagnostics', to: '/docs/operations/system-verification-and-diagnostics' },
    ],
  },
];

export default function HomeFooter() {
  const logoLight = useBaseUrl('/img/logo-light.svg');
  const logoDark = useBaseUrl('/img/logo-dark.svg');
  return (
    <footer className="bg-[#F4F7FF] dark:bg-[#191919]">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col px-6 py-12">
        <div className="mb-12 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <ThemedImage
            alt="EKS Core"
            className="h-9 w-fit lg:h-12"
            sources={{ light: logoLight, dark: logoDark }}
          />
          <p className="mb-0 max-w-md text-sm text-gray-500 dark:text-[#999]">
            Amazon EKS reference platform · ap-northeast-1 · Terraform + ArgoCD
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 gap-y-12 md:justify-between lg:flex lg:flex-wrap">
          {COLUMNS.map((col) => (
            <div key={col.name}>
              <h3 className="font-jakarta text-base font-semibold uppercase text-gray-400 dark:text-[#fff]">
                {col.name}
              </h3>
              <div className="flex flex-col gap-3">
                {col.links.map((l) => (
                  <Link
                    key={l.name}
                    to={l.to}
                    className="text-base text-gray-700 hover:text-primary hover:no-underline dark:text-[#f9f9f9]"
                  >
                    {l.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <hr className="my-12 !bg-gray-300 dark:!bg-[#999]" />

        <div className="flex flex-col gap-6 text-sm text-gray-500 lg:flex-row lg:items-center lg:justify-between">
          <span className="dark:text-[#999]">
            &copy; {new Date().getFullYear()} EKS Core Platform
          </span>
          <span className="dark:text-[#999]">
            Docs design adapted from{' '}
            <Link href="https://github.com/dyte-io/docs">dyte-io/docs</Link>{' '}
            (Apache-2.0)
          </span>
        </div>
      </div>
    </footer>
  );
}

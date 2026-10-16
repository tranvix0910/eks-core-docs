// Layout adapted from the "SDKs" section of dyte-io/docs (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import {
  GlobeRegular,
  ServerRegular,
  DataHistogramRegular,
  BranchRegular,
  ShieldKeyholeRegular,
  ServerMultipleRegular,
  ArrowAutofitHeightRegular,
  CertificateRegular,
  DocumentTextRegular,
  ChartMultipleRegular,
  BoxMultipleRegular,
  PeopleTeamRegular,
} from '@fluentui/react-icons';

function Item({ icon: Icon, to, name }) {
  return (
    <Link
      to={to}
      className="flex cursor-pointer items-center rounded-lg border border-solid border-secondary-700 p-2.5 text-inherit hover:border-primary hover:text-primary hover:no-underline"
    >
      <Icon className="mr-2 h-7 w-7 text-primary" />
      <span className="font-medium">{name}</span>
    </Link>
  );
}

export default function Stack() {
  return (
    <section className="mx-auto mb-32 flex w-full max-w-5xl flex-col p-4 py-0">
      <span className="mb-2 uppercase tracking-wider text-text-400">
        Platform stack
      </span>
      <h3 className="mb-12 text-4xl">Every layer, documented from code to cluster</h3>

      <div className="mb-10">
        <h4 className="mb-2 text-2xl">Terraform layers</h4>
        <p className="mb-6 text-text-400">
          Infrastructure is applied in order, each layer reading the previous
          one&apos;s <span className="font-semibold">remote state</span>.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Item name="10 · Network" to="/docs/architecture/layer-10-network" icon={GlobeRegular} />
          <Item name="20 · Workload" to="/docs/architecture/layer-20-cluster-workload" icon={ServerRegular} />
          <Item name="21 · Observability" to="/docs/architecture/layer-21-cluster-observability" icon={DataHistogramRegular} />
          <Item name="Constraints & SCP" to="/docs/architecture/organizational-constraints-and-prerequisites" icon={ShieldKeyholeRegular} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-2xl">In-cluster platform</h4>
        <p className="mb-6 text-text-400">
          Add-ons reconciled by ArgoCD from the <span className="font-semibold">eks-core-gitops</span> repository.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Item name="ArgoCD" to="/docs/platform-addons/gitops-bootstrap-order" icon={BranchRegular} />
          <Item name="Karpenter" to="/docs/karpenter/karpenter-two-halves-architecture" icon={ServerMultipleRegular} />
          <Item name="HPA · CPA · KEDA" to="/docs/workload-autoscaling-hpa-cpa-keda" icon={ArrowAutofitHeightRegular} />
          <Item name="cert-manager" to="/docs/platform-addons/cert-manager-and-internal-tls" icon={CertificateRegular} />
          <Item name="Mimir" to="/docs/observability/mimir-metrics-pipeline" icon={ChartMultipleRegular} />
          <Item name="Loki" to="/docs/observability/loki-logging-pipeline" icon={DocumentTextRegular} />
          <Item name="Load Balancer Controller" to="/docs/platform-addons/aws-load-balancer-controller" icon={BoxMultipleRegular} />
          <Item name="Rancher" to="/docs/platform-addons/rancher-multi-cluster" icon={PeopleTeamRegular} />
        </div>
      </div>
    </section>
  );
}

import {translate} from '@docusaurus/Translate';
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
      <span className="mb-2 uppercase tracking-wider text-text-400">{translate({id: "site.Stack.01", message: "What you will practice"})}</span>
      <h3 className="mb-12 text-4xl">{translate({id: "site.Stack.02", message: "Verify the outcome of every step"})}</h3>

      <div className="mb-10">
        <h4 className="mb-2 text-2xl">{translate({id: "site.Stack.03", message: "Create infrastructure with Terraform"})}</h4>
        <p className="mb-6 text-text-400">{translate({id: "site.Stack.04", message: "Prepare state, create the network, and bootstrap two clusters. Review "})}<span className="font-semibold">{translate({id: "site.Stack.05", message: "the plan before applying"})}</span>.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Item name={translate({id: "site.Stack.06", message: "1 · Network"})} to="/docs/architecture/layer-10-network" icon={GlobeRegular} />
          <Item name={translate({id: "site.Stack.07", message: "2 · Workload"})} to="/docs/architecture/layer-20-cluster-workload" icon={ServerRegular} />
          <Item name={translate({id: "site.Stack.08", message: "3 · Observability"})} to="/docs/architecture/layer-21-cluster-observability" icon={DataHistogramRegular} />
          <Item name={translate({id: "site.Stack.09", message: "0 · Prerequisites"})} to="/docs/architecture/organizational-constraints-and-prerequisites" icon={ShieldKeyholeRegular} />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-2xl">{translate({id: "site.Stack.10", message: "Deploy and verify"})}</h4>
        <p className="mb-6 text-text-400">{translate({id: "site.Stack.11", message: "Deploy applications from Git and verify "})}<span className="font-semibold">{translate({id: "site.Stack.12", message: "every requirement"})}</span>.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Item name={translate({id: "site.Stack.13", message: "Deploy ArgoCD"})} to="/docs/platform-addons/gitops-bootstrap-order" icon={BranchRegular} />
          <Item name={translate({id: "site.Stack.14", message: "Karpenter"})} to="/docs/karpenter/karpenter-two-halves-architecture" icon={ServerMultipleRegular} />
          <Item name={translate({id: "site.Stack.15", message: "EFS and PVs"})} to="/docs/apps-shopnow/efs-persistent-volumes" icon={ArrowAutofitHeightRegular} />
          <Item name={translate({id: "site.Stack.16", message: "Pod placement"})} to="/docs/apps-shopnow/pod-placement" icon={CertificateRegular} />
          <Item name={translate({id: "site.Stack.17", message: "Mimir"})} to="/docs/observability/mimir-metrics-pipeline" icon={ChartMultipleRegular} />
          <Item name={translate({id: "site.Stack.18", message: "Loki"})} to="/docs/observability/loki-logging-pipeline" icon={DocumentTextRegular} />
          <Item name={translate({id: "site.Stack.19", message: "PDB"})} to="/docs/apps-shopnow/availability-and-pdb" icon={BoxMultipleRegular} />
          <Item name={translate({id: "site.Stack.20", message: "Acceptance"})} to="/docs/operations/workshop-acceptance" icon={PeopleTeamRegular} />
        </div>
      </div>
    </section>
  );
}

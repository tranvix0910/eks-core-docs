// Layout adapted from dyte-io/docs (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import {
  ServerMultipleRegular,
  DataHistogramRegular,
  BranchRegular,
} from '@fluentui/react-icons';

const PRODUCTS = [
  {
    title: 'Build infrastructure',
    link: '/docs/architecture/layer-20-cluster-workload',
    icon: ServerMultipleRegular,
    stats: ['Terraform → EKS', 'Managed Nodes · Spot · Mixed · ARM64'],
    text: 'Create two clusters, run controllers on managed nodes, and provision capacity with Karpenter.',
  },
  {
    title: 'Deploy applications',
    link: '/docs/apps-shopnow/shopnow-end-to-end-deployment-guide',
    icon: DataHistogramRegular,
    stats: ['Git → ArgoCD → Microservices', 'EFS · Pod placement · PDB'],
    text: 'Build images, deploy from Git, and verify shared storage, replica distribution, and availability.',
  },
  {
    title: 'Verify and operate',
    link: '/docs/operations/workshop-acceptance',
    icon: BranchRegular,
    stats: ['Metrics + Logs → Cluster 2', 'Grafana · Evidence · Cleanup'],
    text: 'Find telemetry in the observability cluster, verify every requirement, and manage changes after the lab.',
  },
];

function HeroProduct({ link, title, icon: Icon, text, stats }) {
  return (
    <Link
      to={link}
      style={{ borderWidth: '1px' }}
      className={clsx(
        'group flex cursor-pointer flex-col overflow-clip rounded-3xl border-solid from-primary/30 via-transparent to-transparent text-black transition-all hover:bg-gradient-to-tr hover:text-primary hover:no-underline dark:text-white',
        'w-[90vw] border-secondary-700 bg-secondary-900 hover:!border-primary dark:border-secondary-800 sm:w-[330px]',
      )}
    >
      <div className="p-6">
        <h3 className="mb-1.5 flex items-center gap-3 font-jakarta group-hover:text-primary">
          <Icon className="h-7 w-7" />
          <div>{title}</div>
        </h3>
        <p className="mb-0 text-sm text-zinc-400">{text}</p>
      </div>
      <div className="mt-auto flex flex-col gap-1 border-0 border-t border-solid border-secondary-700 px-6 py-4 font-mono text-xs text-text-400 transition-transform group-hover:translate-x-1 dark:border-secondary-800">
        {stats.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
    </Link>
  );
}

export default function HeroSection() {
  return (
    <div className="noise-bg pb-14">
      <section className="no-underline-links px-4 pt-16 lg:py-0">
        <div className="flex flex-col items-center justify-between py-14">
          <h1 className="mb-4 max-w-4xl text-center font-jakarta text-5xl font-bold">
            Deploy and operate microservices on EKS
          </h1>
          <p className="max-w-xl text-center text-text-400">
            From Terraform and ArgoCD to EFS, capacity groups, metrics, and logs.
            Follow each step, verify every requirement, and learn to manage
            the environment after deployment.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              to="/docs"
              className="rounded-lg bg-primary px-5 py-2.5 font-jakarta text-sm font-semibold text-white hover:text-white hover:no-underline"
            >
              Start the workshop
            </Link>
            <Link
              to="/docs/operations/workshop-acceptance"
              className="rounded-lg border border-solid border-secondary-700 px-5 py-2.5 font-jakarta text-sm font-semibold text-black hover:border-primary hover:no-underline dark:text-white"
            >
              View acceptance criteria
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-wrap justify-center gap-6 px-4">
        {PRODUCTS.map((product) => (
          <HeroProduct {...product} key={product.title} />
        ))}
      </section>
    </div>
  );
}

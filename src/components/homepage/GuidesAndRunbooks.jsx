// Layout adapted from dyte-io/docs (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import {
  ArrowRightFilled,
  GlobeRegular,
  CloudFlowRegular,
  ArrowSyncRegular,
  WarningRegular,
  StethoscopeRegular,
  FlashRegular,
} from '@fluentui/react-icons';
import { ChevronRight } from 'react-feather';

const guides = [
  {title: 'Plan and apply infrastructure', icon: CloudFlowRegular, text: 'Create the network, clusters, and states in dependency order.', link: '/docs/architecture/layer-10-network'},
  {title: 'Deploy microservices through ArgoCD', icon: ArrowSyncRegular, text: 'Build images and deploy application layers from Git.', link: '/docs/apps-shopnow/shopnow-end-to-end-deployment-guide'},
  {title: 'EFS, placement, and PDBs', icon: GlobeRegular, text: 'Verify storage, replica distribution, and eviction.', link: '/docs/apps-shopnow/efs-persistent-volumes'},
];
const runbooks = [
  {title: 'Run diagnostics commands', icon: StethoscopeRegular, link: '/docs/operations/system-verification-and-diagnostics'},
  {title: 'Diagnose and resolve failures', icon: WarningRegular, link: '/docs/operations/master-incident-catalogue'},
  {title: 'Updates, rollback, and cleanup', icon: FlashRegular, link: '/docs/operations/lifecycle-and-cleanup'},
  {title: 'Centralized metrics and logs', icon: GlobeRegular, link: '/docs/observability/observability-architecture-overview'},
];

function Guide({ title, text, icon: Icon, link }) {
  return (
    <Link
      to={link}
      className="group flex cursor-pointer items-start gap-2 rounded-lg border-2 border-solid border-transparent p-3 text-inherit transition-colors hover:border-primary hover:text-primary hover:no-underline"
    >
      <Icon className="h-6 w-6 flex-shrink-0" />
      <div className="flex flex-col">
        <h4 className="mb-1 font-semibold">{title}</h4>
        <p className="mb-0 text-sm text-text-400">{text}</p>
      </div>
      <ChevronRight className="ml-auto h-5 w-5 self-center opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function Runbook({ title, icon: Icon, link }) {
  return (
    <Link
      to={link}
      className="group flex cursor-pointer items-center justify-between rounded-lg border-2 border-solid border-transparent p-3 text-inherit transition-colors hover:border-primary hover:text-primary hover:no-underline"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-text-400 group-hover:text-primary" />
        <h4 className="mb-0 text-black group-hover:text-primary dark:text-white">
          {title}
        </h4>
      </div>
      <span className="rounded-lg py-1 px-3 text-sm font-semibold text-text-400 transition-colors group-hover:bg-primary group-hover:text-white">
        Open
      </span>
    </Link>
  );
}

export default function GuidesAndRunbooks() {
  return (
    <section className="no-underline-links my-32 mx-auto flex w-full max-w-5xl flex-col gap-10 p-4 py-0 md:flex-row md:gap-0">
      <div className="flex-1">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="m-0">Step-by-step labs</h3>
          <Link to="/docs" className="font-jakarta text-sm font-semibold">
            View the learning path <ArrowRightFilled className="ml-1" />
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {guides.map((g) => (
            <Guide {...g} key={g.title} />
          ))}
        </div>
      </div>

      <div
        className={clsx(
          'mx-8 block flex-shrink-0 bg-gradient-to-b from-transparent via-secondary-700 to-transparent',
          'hidden w-px md:block',
        )}
      />

      <div className="w-full md:max-w-sm">
        <div className="mb-8 flex items-center justify-between">
          <h3 className="m-0">Operations</h3>
          <Link
            to="/docs/operations/tokyo-region-migration-runbook"
            className="font-jakarta text-sm font-semibold"
          >
            All runbooks <ArrowRightFilled className="ml-1" />
          </Link>
        </div>
        <div className="flex flex-col gap-4">
          {runbooks.map((r) => (
            <Runbook {...r} key={r.title} />
          ))}
        </div>
      </div>
    </section>
  );
}

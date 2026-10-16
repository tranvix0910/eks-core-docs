// Layout adapted from dyte-io/docs (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import clsx from 'clsx';
import {
  BookOpenRegular,
  WarningRegular,
  CodeRegular,
} from '@fluentui/react-icons';

const CARDS = [
  {
    icon: BookOpenRegular,
    title: 'Start here',
    text: 'New to the platform? Read the architecture overview and the deployment order first.',
    link: '/docs/architecture/architecture-overview',
    cta: 'Read the overview',
  },
  {
    icon: WarningRegular,
    title: 'Something broke?',
    text: 'Search 30+ real incidents with their root cause, fix and prevention.',
    link: '/docs/operations/master-incident-catalogue',
    cta: 'Open the catalogue',
  },
  {
    icon: CodeRegular,
    title: 'Source code',
    text: 'Terraform, GitOps manifests, ShopNow services and these docs, one repository each.',
    link: 'https://github.com/tranvix0910?tab=repositories&q=eks-core',
    cta: 'Browse the repositories',
  },
];

export default function HelpSection({ className = '' }) {
  return (
    <section className="px-4 pt-16">
      <div
        className={clsx(
          'mx-auto max-w-7xl rounded-3xl bg-white p-4 py-10 text-black dark:bg-black dark:text-white lg:p-24 lg:py-20',
          className,
        )}
      >
        <h2 className="mb-12 text-center lg:text-3xl">Where do you want to go?</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CARDS.map(({ icon: Icon, title, text, link, cta }) => (
            <div key={title} className="rounded-lg bg-zinc-100 p-6 dark:bg-zinc-900">
              <Icon className="h-12 w-12 text-primary" />
              <h3 className="my-3">{title}</h3>
              <p className="text-zinc-600 dark:text-zinc-400">{text}</p>
              <Link to={link} className="text-primary dark:text-primary-100">
                {cta} &rarr;
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

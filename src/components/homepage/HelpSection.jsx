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
    title: 'New to the workshop?',
    text: 'Read the requirements, prepare your tools, and follow the steps from infrastructure to verification.',
    link: '/docs/platform-overview-and-deployment',
    cta: 'View the steps',
  },
  {
    icon: WarningRegular,
    title: 'Troubleshooting a failure?',
    text: 'Look up symptoms, collect evidence, and identify the failing component before making changes.',
    link: '/docs/operations/master-incident-catalogue',
    cta: 'Incident catalogue',
  },
  {
    icon: CodeRegular,
    title: 'Source code and lab examples',
    text: 'Terraform, charts, values, and verification workloads live in four repositories so you can repeat the exercises.',
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
        <h2 className="mb-12 text-center lg:text-3xl">Where to go next</h2>
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

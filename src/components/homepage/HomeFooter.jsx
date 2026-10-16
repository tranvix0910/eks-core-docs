import {translate} from '@docusaurus/Translate';
// Layout adapted from dyte-io/docs (Apache-2.0)
import React from 'react';
import Link from '@docusaurus/Link';
import ThemedImage from '@theme/ThemedImage';
import useBaseUrl from '@docusaurus/useBaseUrl';

const COLUMNS = [
  {
    "name": translate({id: "site.HomeFooter.01", message: "Get started"}),
    "links": [
      {
        "name": translate({id: "site.HomeFooter.02", message: "Requirements and learning path"}),
        "to": "/docs/platform-overview-and-deployment"
      },
      {
        "name": translate({id: "site.HomeFooter.03", message: "Prerequisites"}),
        "to": "/docs/architecture/organizational-constraints-and-prerequisites"
      },
      {
        "name": translate({id: "site.HomeFooter.04", message: "Terraform"}),
        "to": "/docs/architecture/layer-10-network"
      }
    ]
  },
  {
    "name": translate({id: "site.HomeFooter.05", message: "Deployment"}),
    "links": [
      {
        "name": translate({id: "site.HomeFooter.06", message: "Three capacity groups"}),
        "to": "/docs/karpenter-autoscaling-nodepools"
      },
      {
        "name": translate({id: "site.HomeFooter.07", message: "Build images"}),
        "to": "/docs/apps-shopnow/docker-build-multi-arch-and-ci"
      },
      {
        "name": translate({id: "site.HomeFooter.08", message: "ArgoCD"}),
        "to": "/docs/apps-shopnow/shopnow-end-to-end-deployment-guide"
      }
    ]
  },
  {
    "name": translate({id: "site.HomeFooter.09", message: "Verification"}),
    "links": [
      {
        "name": translate({id: "site.HomeFooter.10", message: "EFS"}),
        "to": "/docs/apps-shopnow/efs-persistent-volumes"
      },
      {
        "name": translate({id: "site.HomeFooter.11", message: "Pod placement"}),
        "to": "/docs/apps-shopnow/pod-placement"
      },
      {
        "name": translate({id: "site.HomeFooter.12", message: "PDB"}),
        "to": "/docs/apps-shopnow/availability-and-pdb"
      },
      {
        "name": translate({id: "site.HomeFooter.13", message: "Metrics and logs"}),
        "to": "/docs/observability/observability-architecture-overview"
      }
    ]
  },
  {
    "name": translate({id: "site.HomeFooter.14", message: "Operations"}),
    "links": [
      {
        "name": translate({id: "site.HomeFooter.15", message: "Acceptance"}),
        "to": "/docs/operations/workshop-acceptance"
      },
      {
        "name": translate({id: "site.HomeFooter.16", message: "Incident catalogue"}),
        "to": "/docs/operations/master-incident-catalogue"
      },
      {
        "name": translate({id: "site.HomeFooter.17", message: "Cleanup"}),
        "to": "/docs/operations/lifecycle-and-cleanup"
      },
      {
        "name": translate({id: "site.HomeFooter.18", message: "Access and secrets"}),
        "to": "/docs/eks-security"
      }
    ]
  }
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
            &copy; {new Date().getFullYear()}{translate({id: "site.HomeFooter.19", message: " EKS Workshop"})}</span>
        </div>
      </div>
    </footer>
  );
}

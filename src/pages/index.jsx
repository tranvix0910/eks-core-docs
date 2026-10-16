import {translate} from '@docusaurus/Translate';
import React from 'react';
import Layout from '@theme/Layout';

import HeroSection from '../components/homepage/HeroSection';
import GuidesAndRunbooks from '../components/homepage/GuidesAndRunbooks';
import Stack from '../components/homepage/Stack';
import HelpSection from '../components/homepage/HelpSection';
import HomeFooter from '../components/homepage/HomeFooter';

export default function Homepage() {
  return (
    <Layout
      title={translate({id: "site.page.01", message: "EKS Workshop"})}
      description={translate({id: "site.page.02", message: "Learn Terraform, Karpenter, ArgoCD, EFS, PDBs, and centralized observability."})}
      wrapperClassName="homepage flex flex-col"
      noFooter
    >
      <HeroSection />
      <GuidesAndRunbooks />
      <Stack />
      <div className="z-0 bg-secondary-800 pb-16">
        <HelpSection />
      </div>
      <HomeFooter />
    </Layout>
  );
}

import React from 'react';
import Layout from '@theme/Layout';

import HeroSection from '../components/homepage/HeroSection';
import TechStack from '../components/homepage/TechStack';
import GuidesAndRunbooks from '../components/homepage/GuidesAndRunbooks';
import Stack from '../components/homepage/Stack';
import HelpSection from '../components/homepage/HelpSection';
import HomeFooter from '../components/homepage/HomeFooter';

export default function Homepage() {
  return (
    <Layout
      title="EKS Workshop"
      description="Learn Terraform, Karpenter, ArgoCD, EFS, PDBs, and centralized observability."
      wrapperClassName="homepage flex flex-col"
      noFooter
    >
      <HeroSection />
      <TechStack />
      <GuidesAndRunbooks />
      <Stack />
      <div className="z-0 bg-secondary-800 pb-16">
        <HelpSection />
      </div>
      <HomeFooter />
    </Layout>
  );
}

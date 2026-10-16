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
      title="EKS Core Documentation"
      description="Two-cluster Amazon EKS platform documentation"
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

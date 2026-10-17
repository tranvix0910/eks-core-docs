import React, {useEffect, useRef, useState} from 'react';

import Eks from '../../assests/images/aws/eks.svg';
import Ec2 from '../../assests/images/aws/ec2.svg';
import Ecr from '../../assests/images/aws/ecr.svg';
import Efs from '../../assests/images/aws/efs.svg';
import S3 from '../../assests/images/aws/s3.svg';
import Vpc from '../../assests/images/aws/vpc.svg';
import Elb from '../../assests/images/aws/elb.svg';
import Iam from '../../assests/images/aws/iam.svg';
import Route53 from '../../assests/images/aws/route53.svg';
import Prometheus from '../../assests/images/observability/prometheus.svg';
import Grafana from '../../assests/images/observability/grafana.svg';
import Mimir from '../../assests/images/observability/mimir.svg';
import Loki from '../../assests/images/observability/loki.svg';
import Alloy from '../../assests/images/observability/alloy.svg';
import terraform from '../../assests/images/Terraform.png';
import argo from '../../assests/images/ArgoCD.png';
import helm from '../../assests/images/Helm.png';
import karpenter from '../../assests/images/Karpenter.png';
import styles from './TechStack.module.css';

const technologies = [
  {name: 'Terraform', image: terraform},
  {name: 'Amazon EKS', Icon: Eks},
  {name: 'Karpenter', image: karpenter},
  {name: 'ArgoCD', image: argo},
  {name: 'Helm', image: helm},
  {name: 'Prometheus', Icon: Prometheus},
  {name: 'Grafana', Icon: Grafana},
  {name: 'Grafana Mimir', Icon: Mimir},
  {name: 'Grafana Loki', Icon: Loki},
  {name: 'Grafana Alloy', Icon: Alloy},
  {name: 'Amazon EC2', Icon: Ec2},
  {name: 'Amazon ECR', Icon: Ecr},
  {name: 'Amazon EFS', Icon: Efs},
  {name: 'Amazon S3', Icon: S3},
  {name: 'Amazon VPC', Icon: Vpc},
  {name: 'Elastic Load Balancing', Icon: Elb},
  {name: 'AWS IAM', Icon: Iam},
  {name: 'Amazon Route 53', Icon: Route53},
];

function Logos({duplicate = false}) {
  return (
    <ul className={styles.logos} aria-hidden={duplicate || undefined}>
      {technologies.map(({name, image, Icon}) => (
        <li className={styles.item} key={name}>
          <span className={styles.artwork}>
            {Icon ? (
              <Icon width={40} height={40} aria-hidden="true" focusable="false" />
            ) : (
              <img src={image} width={40} height={40} alt="" decoding="async" />
            )}
          </span>
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

export default function TechStack() {
  const section = useRef(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
    });
    observer.observe(section.current);

    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return (
    <section ref={section} className={styles.section} aria-labelledby="tech-stack-title">
      <div className={styles.header}>
        <h2 id="tech-stack-title">The workshop stack</h2>
        <p>Tools and services you’ll use throughout the labs.</p>
      </div>
      <div className={styles.viewport}>
        <div
          className={styles.track}
          style={{
            '--stack-duration': `${technologies.length * 6}s`,
            animationPlayState: !visible || !pageVisible ? 'paused' : 'running',
          }}
        >
          <Logos />
          <Logos duplicate />
        </div>
      </div>
    </section>
  );
}

from drawlib import Page


def overview():
    p = Page('1. Overview', 1900, 980)
    p.title('EKS Workshop — architecture overview',
            'Two EKS clusters in one VPC: cluster 1 runs the platform tools and the microservices, cluster 2 stores and shows their metrics and logs.')

    # Outside AWS
    eng = p.icon('user', 'Workshop engineer', 90, 110, size=60, font=11)
    p.text('Terraform · kubectl · Helm · argocd', 20, 196, 210, 20, font=10, align='center', color='#545B64')
    gh = p.box('<b>GitHub · tranvix0910</b><br><br>eks-core-terraform<br>eks-core-gitops<br>eks-core-apps<br>eks-core-docs',
               20, 300, 210, 150, 'grey', align='left', valign='top')
    pages = p.box('<b>Docs site</b><br>GitHub Pages', 20, 500, 210, 56, 'grey')

    cloud = p.group('cloud', 'AWS Cloud', 260, 80, 1620, 880)
    reg = p.group('region', 'Region ap-northeast-1 (Tokyo)', 20, 40, 1340, 820, cloud)
    vpc = p.group('vpc', 'VPC 10.20.0.0/16 · 3 Availability Zones (1a, 1c, 1d) · 1 NAT gateway · S3 gateway endpoint',
                  20, 40, 1300, 620, reg)

    # Cluster 1
    c1 = p.frame('Amazon EKS · eks-workload (cluster 1) · Kubernetes 1.34', 20, 50, 600, 540, 'eks', vpc)
    p.icon('eks', '', 540, 6, size=44, parent=c1)
    mng = p.frame('Managed Node Group infra · 3 × t3.large On-Demand · label role=infra', 20, 60, 560, 150, 'k8s', c1, font=11)
    tools = [('deploy', 'ArgoCD'), ('deploy', 'Karpenter'), ('sts', 'JavaMelody'), ('deploy', 'Load Balancer<br>Controller'),
             ('deploy', 'cert-manager'), ('sts', 'Prometheus')]
    ids = {}
    for i, (k, name) in enumerate(tools):
        ids[name] = p.icon('k8s_' + k, name, 25 + i * 90, 42, size=44, parent=mng, font=10)
    pool1 = p.frame('Pool 1 · batch-spot · Spot', 20, 230, 170, 120, 'white', c1, font=11)
    p.icon('spot', '', 60, 50, size=48, parent=pool1)
    pool3 = p.frame('Pool 3 · arm64 · Graviton', 20, 370, 170, 110, 'white', c1, font=11)
    p.icon('ec2', '', 60, 45, size=48, parent=pool3)
    pool2 = p.frame('Pool 2 · ms-od + ms-spot · On-Demand : Spot = 1 : 3', 210, 230, 370, 250, 'white', c1, font=11)
    p.icon('ec2', 'ms-od · On-Demand · 24 vCPU', 50, 36, size=44, parent=pool2, font=10)
    p.icon('spot', 'ms-spot · Spot · 72 vCPU', 240, 36, size=44, parent=pool2, font=10)
    shop = p.box('<b>Microservices</b><br>6 backends + frontend · deployed by ArgoCD<br>EFS volumes · spread over nodes/AZs · PDBs',
                 20, 140, 330, 90, 'green', pool2, font=11)
    alloy = p.box('Alloy DaemonSet on every node · ships Pod logs', 20, 498, 560, 28, 'purple', c1, font=11)

    # Internal ALB between the clusters (a VPC resource, created by cluster 2's controller)
    alb = p.icon('alb', 'Internal ALB<br>HTTPS :9009 · :3100', 650, 146, size=56, parent=vpc, font=10, label_pos='top')

    # Cluster 2
    c2 = p.frame('Amazon EKS · eks-observability (cluster 2)', 780, 50, 500, 540, 'eks', vpc)
    p.icon('eks', '', 440, 6, size=44, parent=c2)
    mng2 = p.frame('Managed Node Group monitoring · 2 × t3.medium · namespace monitoring', 20, 200, 460, 310, 'k8s', c2, font=11)
    mimir = p.icon('k8s_sts', 'Mimir · metrics', 40, 60, size=50, parent=mng2)
    loki = p.icon('k8s_sts', 'Loki · logs', 190, 60, size=50, parent=mng2)
    p.icon('k8s_deploy', 'Grafana · UI', 350, 60, size=50, parent=mng2)
    p.text('Grafana queries Mimir and Loki', 260, 140, 190, 20, mng2, font=10, color='#545B64', align='center')
    p.icon('k8s_sts', 'Prometheus<br>(cluster 2 itself)', 280, 200, size=40, parent=mng2, font=10)
    p.icon('k8s_deploy', 'Load Balancer<br>Controller', 380, 200, size=40, parent=mng2, font=10)
    p.box('<b>Receives from cluster 1</b><br>metrics → Mimir (tenant eks-workload)<br>logs → Loki<br>over HTTPS through the internal ALB',
          20, 60, 270, 110, 'orange', c2, font=11, align='left')
    p.box('<b>Storage</b><br>recent data: gp3 volumes<br>long-term: S3 buckets', 310, 60, 170, 110, 'yellow', c2, font=11, align='left')

    # Regional services, under the cluster that uses them
    def svc(key, label, abs_x):
        return p.icon(key, label, abs_x - 280, 700, size=56, parent=reg, font=10)
    sqs = svc('sqs', 'SQS<br>Spot interruption<br>→ Karpenter', 320)
    eb = svc('eb', 'EventBridge<br>EC2 events', 440)
    ecr = svc('ecr', 'ECR<br>7 repositories', 590)
    efs = svc('efs', 'EFS<br>ReadWriteMany', 760)
    r53 = svc('r53', 'Route 53<br>observability.internal', 900)
    acm = svc('acm', 'ACM<br>imported cert', 1010)
    s3 = svc('s3', 'S3<br>Mimir + Loki buckets', 1210)
    iam = svc('iam', 'IAM<br>Pod Identity roles', 1370)
    svc('cwl', 'CloudWatch Logs<br>EKS + VPC Flow Logs', 1500)

    reg2 = p.group('region', 'Region ap-southeast-1', 1380, 40, 220, 230, cloud)
    state = p.icon('s3', 'Terraform state<br>eks-tfstate-&lt;account&gt;', 80, 70, size=60, parent=reg2, font=10)

    # Edges
    p.edge(eng, gh, 'git push', 'gitops', exit=(0.5, 1), entry=(0.5, 0), ly=-30)
    p.edge(eng, state, 'terraform apply → AWS resources · state in S3', 'tf', exit=(0.5, 0), entry=(0.5, 0),
           points=[(120, 74), (1750, 74)])
    p.edge(gh, ids['ArgoCD'], 'GitOps pull (eks-core-gitops)', 'gitops', exit=(1, 0.1), entry=(0, 0.5))
    p.edge(gh, pages, 'GitHub Actions', 'gitops', exit=(0.5, 1), entry=(0.5, 0))
    p.edge(ids['Karpenter'], pool2, 'launches nodes (all pools)', 'control', exit=(0.5, 1), entry=(0.3, 0))
    p.edge(eb, sqs, '', 'control', exit=(0, 0.5), entry=(1, 0.5), dashed=True)
    p.edge(ecr, shop, 'image pull', 'image', exit=(0.5, 0), entry=(0.2, 1))
    p.edge(shop, efs, 'NFS · PVC /data', 'storage', exit=(0.75, 1), entry=(0.5, 0))
    p.edge(ids['Prometheus'], alb, 'metrics · remote_write', 'metrics', exit=(1, 0.5), entry=(0, 0.3))
    p.edge(alloy, alb, 'logs · push', 'logs', exit=(1, 0.5), entry=(0, 0.8), points=[(930, 711), (930, 349)])
    p.edge(alb, mimir, '', 'metrics', exit=(0.4, 1), entry=(0.5, 0))
    p.edge(alb, loki, '', 'logs', exit=(0.6, 1), entry=(0.5, 0))
    p.edge(mimir, s3, 'blocks', 'storage', exit=(0.5, 1), entry=(0.3, 0))
    p.edge(loki, s3, 'chunks', 'storage', exit=(0.5, 1), entry=(0.7, 0))
    p.edge(r53, alb, 'DNS', 'net', exit=(0.5, 0), entry=(0.1, 1), dashed=True)
    p.edge(acm, alb, 'TLS', 'net', exit=(0.5, 0), entry=(0.9, 1), dashed=True)

    p.legend([('gitops', 'GitOps / Git'), ('tf', 'Terraform'), ('image', 'Container images'), ('storage', 'Storage'),
              ('metrics', 'Metrics'), ('logs', 'Logs'), ('control', 'Node provisioning'), ('net', 'DNS / TLS')], 20, 620)
    return p


def network():
    p = Page('2. Network', 1780, 1040)
    p.title('Network — layer 10-network',
            'One VPC, three AZs, three subnet tiers. Each cluster gets its own /20 subnets; Karpenter and the load balancer controller find them by tag.')
    cloud = p.group('cloud', 'AWS Cloud', 20, 110, 1740, 910)
    reg = p.group('region', 'Region ap-northeast-1', 20, 40, 1700, 850, cloud)
    vpc = p.group('vpc', 'VPC eks-dev · 10.20.0.0/16', 20, 40, 1320, 780, reg)
    igw = p.icon('igw', 'Internet gateway', 620, 6, size=50, parent=vpc, label_pos='right')

    azs = [('ap-northeast-1a', '10.20.0.0/24', '10.20.16.0/20', '10.20.64.0/20'),
           ('ap-northeast-1c', '10.20.1.0/24', '10.20.32.0/20', '10.20.80.0/20'),
           ('ap-northeast-1d', '10.20.2.0/24', '10.20.48.0/20', '10.20.96.0/20')]
    nat = None
    wl_ids, ob_ids, pub_ids = [], [], []
    for i, (az, pub, wl, ob) in enumerate(azs):
        a = p.group('az', 'Availability Zone ' + az, 20 + i * 430, 80, 410, 680, vpc)
        ps = p.group('public', f'Public subnet {pub}', 15, 40, 380, 150, a)
        pub_ids.append(ps)
        p.text('tag kubernetes.io/role/elb = 1<br>internet-facing load balancers', 15, 50, 220, 40, ps, font=10, color='#248814')
        if i == 0:
            nat = p.icon('nat', 'NAT gateway (single)', 290, 40, size=50, parent=ps, font=10)
        ws = p.group('private', f'Workload subnet {wl} · cluster 1', 15, 210, 380, 220, a)
        wl_ids.append(ws)
        p.icon('ec2', 'infra node', 20, 45, size=44, parent=ws, font=10)
        p.icon('spot', 'Karpenter<br>nodes', 110, 45, size=44, parent=ws, font=10)
        p.icon('efs', 'EFS mount<br>target', 200, 45, size=44, parent=ws, font=10)
        p.icon('eks', 'EKS ENIs', 290, 45, size=44, parent=ws, font=10)
        p.text('karpenter.sh/discovery = eks-workload<br>kubernetes.io/role/internal-elb = 1<br>Pods get VPC IPs (prefix delegation)',
               15, 140, 350, 60, ws, font=10, color='#147EBA')
        os_ = p.group('private', f'Observability subnet {ob} · cluster 2', 15, 450, 380, 210, a)
        ob_ids.append(os_)
        p.icon('ec2', 'monitoring<br>node', 20, 45, size=44, parent=os_, font=10)
        p.icon('alb', 'internal ALB<br>(Mimir / Loki)', 110, 45, size=44, parent=os_, font=10)
        p.icon('eks', 'EKS ENIs', 200, 45, size=44, parent=os_, font=10)
        p.text('karpenter.sh/discovery = eks-observability<br>kubernetes.io/role/internal-elb = 1',
               15, 140, 350, 50, os_, font=10, color='#147EBA')

    s3ep = p.icon('endpoints', 'S3 gateway endpoint<br>(private route tables)', 1380, 120, size=56, parent=reg, font=10)
    s3 = p.icon('s3', 'Amazon S3<br>state · Mimir · Loki', 1560, 120, size=56, parent=reg, font=10)
    flow = p.icon('flow', 'VPC Flow Logs', 1380, 330, size=56, parent=reg, font=10)
    cwl = p.icon('cwl', 'CloudWatch Logs', 1560, 335, size=56, parent=reg, font=10)
    rt = p.box('<b>Route tables</b><br><br><b>public</b><br>10.20.0.0/16 → local<br>0.0.0.0/0 → Internet gateway<br><br>'
               '<b>private (workload + observability)</b><br>10.20.0.0/16 → local<br>0.0.0.0/0 → NAT gateway (AZ 1a)<br>'
               'S3 prefix list → gateway endpoint',
               1370, 480, 310, 210, 'white', reg, font=11, align='left', valign='top')
    sg = p.box('<b>Security groups (layers 20 / 21)</b><br><br>EKS node SGs per cluster<br>EFS SG: TCP 2049 from cluster 1 nodes<br>'
               'Internal ALB SG: 9009 / 3100 from cluster 1 nodes<br>Cluster 2 nodes: 8080 from internal ALB SG',
               1370, 700, 310, 130, 'white', reg, font=11, align='left', valign='top')
    internet = p.box('Internet', 660, 72, 120, 28, 'grey', '1')
    p.edge(internet, igw, '', 'net', both=True, exit=(0.5, 1), entry=(0.5, 0))
    p.edge(nat, igw, 'egress', 'net', exit=(0.5, 0), entry=(0, 0.5))
    p.edge(wl_ids[0], nat, 'private egress (all AZs)', 'net', dashed=True, exit=(0.83, 0), entry=(0.5, 1), ly=-70)
    p.edge(s3ep, s3, '', 'storage', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(flow, cwl, '', 'net', exit=(1, 0.5), entry=(0, 0.5))
    return p

from drawlib import Page


def ns(p, name, x, y, w, h, parent):
    return p.frame('namespace ' + name, x, y, w, h, 'white', parent, font=10, dashed=True)


def cluster1():
    p = Page('3. Cluster 1 · Workload', 2160, 1010)
    p.title('Cluster 1 — eks-workload',
            'Platform tools on the infra Managed Node Group; everything else on Karpenter capacity. Layer 20-cluster-workload creates it.')
    gh = p.box('<b>GitHub</b><br>eks-core-gitops<br>(charts, values, NodePools)', 20, 400, 210, 90, 'grey')
    to2 = p.box('<b>→ cluster 2</b><br>internal ALB<br>mimir / loki.observability.internal', 20, 900, 210, 80, 'orange')

    c1 = p.frame('Amazon EKS · eks-workload · Kubernetes 1.34', 260, 80, 1560, 800, 'eks')
    p.icon('eks', '', 1500, 4, size=40, parent=c1)
    cp = p.box('<b>Control plane (AWS managed)</b> · public endpoint · control-plane logs api / audit / authenticator → CloudWatch (7 days) · '
               'EKS access entries · add-ons: VPC CNI (prefix delegation), CoreDNS, kube-proxy, EBS CSI, EFS CSI, Pod Identity Agent',
               20, 40, 1520, 70, 'white', c1, font=11, align='left')

    mng = p.frame('Managed Node Group infra · 3 × t3.large On-Demand · AL2023 · one node per AZ · label role=infra',
                  20, 150, 740, 560, 'k8s', c1, font=11)
    ks = ns(p, 'kube-system', 20, 40, 700, 110, mng)
    p.icon('k8s_deploy', 'CoreDNS', 30, 40, size=40, parent=ks, font=10)
    p.icon('k8s_deploy', 'Load Balancer<br>Controller 3.4', 160, 40, size=40, parent=ks, font=10)
    p.icon('k8s_deploy', 'Metrics Server', 300, 40, size=40, parent=ks, font=10)
    p.icon('k8s_ds', 'aws-node, kube-proxy,<br>CSI node (all nodes)', 440, 40, size=40, parent=ks, font=10)
    karp = p.icon('k8s_deploy', 'Karpenter 1.14', 600, 40, size=40, parent=ks, font=10)
    ar = ns(p, 'argocd', 20, 165, 700, 110, mng)
    p.icon('k8s_crd', 'AppProject shopnow', 30, 40, size=40, parent=ar, font=10)
    p.icon('k8s_crd', '9 Applications<br>(auto-sync, self-heal)', 200, 40, size=40, parent=ar, font=10)
    argo = p.icon('k8s_deploy', 'ArgoCD (chart 10.3)', 600, 40, size=40, parent=ar, font=10)
    mon = ns(p, 'monitoring', 20, 290, 700, 120, mng)
    prom = p.icon('k8s_sts', 'Prometheus', 40, 40, size=40, parent=mon, font=10)
    p.icon('k8s_sts', 'Alertmanager', 200, 40, size=40, parent=mon, font=10)
    p.icon('k8s_deploy', 'kube-state-metrics', 320, 40, size=40, parent=mon, font=10)
    p.icon('k8s_ds', 'node-exporter', 460, 40, size=40, parent=mon, font=10)
    p.icon('k8s_deploy', 'Grafana (local)', 600, 40, size=40, parent=mon, font=10)
    for i, (n, k, label) in enumerate([('javamelody', 'sts', 'collector + gp3 PVC'), ('cert-manager', 'deploy', 'cert-manager v1.21'),
                                         ('argo-rollouts', 'deploy', 'Rollouts controller'), ('kite', 'deploy', 'Kite (cluster UI)')]):
        f = ns(p, n, 20 + i * 180, 425, 160, 115, mng)
        p.icon('k8s_' + k, label, 60, 40, size=40, parent=f, font=10)

    kf = p.frame('Karpenter capacity · EC2NodeClass default (AL2023, IMDSv2, 30 GiB gp3 encrypted, discovery tag eks-workload)',
                 780, 150, 760, 560, 'white', c1, font=11)
    pool1 = p.frame('Pool 1 · batch-spot', 20, 40, 220, 130, 'white', kf, font=11)
    p.icon('spot', '', 20, 40, size=44, parent=pool1)
    p.text('Spot · amd64/arm64<br>workload=batch<br>limit 48 vCPU', 80, 34, 140, 60, pool1, font=10)
    pool3 = p.frame('Pool 3 · arm64', 20, 390, 220, 130, 'white', kf, font=11)
    p.icon('ec2', '', 20, 40, size=44, parent=pool3)
    p.text('Graviton · Spot/OD<br>arch=arm64<br>limit 48 vCPU', 80, 34, 140, 60, pool3, font=10)
    pool2 = p.frame('Pool 2 · label + taint workload=microservices', 260, 40, 480, 500, 'white', kf, font=11)
    od = p.frame('', 20, 40, 210, 80, 'white', pool2)
    p.icon('ec2', '', 10, 16, size=44, parent=od)
    p.text('<b>ms-od</b> · On-Demand<br>weight 100 · 24 vCPU', 64, 14, 140, 50, od, font=10)
    sp = p.frame('', 250, 40, 210, 80, 'white', pool2)
    p.icon('spot', '', 10, 16, size=44, parent=sp)
    p.text('<b>ms-spot</b> · Spot<br>weight 10 · 72 vCPU', 64, 14, 140, 50, sp, font=10)
    shop = ns(p, 'shopnow', 20, 140, 440, 340, pool2)
    for i, name in enumerate(['frontend<br>(Rollout)', 'api-gateway', 'product', 'cart']):
        p.icon('k8s_deploy', name, 25 + i * 105, 40, size=40, parent=shop, font=10)
    for i, name in enumerate(['user', 'config-server', 'discovery<br>(Eureka)', 'Keycloak']):
        p.icon('k8s_deploy', name, 25 + i * 105, 130, size=40, parent=shop, font=10)
    p.icon('k8s_sts', 'PostgreSQL', 25, 220, size=40, parent=shop, font=10)
    p.icon('k8s_sts', 'MySQL', 130, 220, size=40, parent=shop, font=10)
    p.icon('k8s_pvc', '6 × EFS PVC (RWX)', 235, 220, size=40, parent=shop, font=10)
    p.icon('k8s_pvc', 'DB PVCs (gp3)', 340, 220, size=40, parent=shop, font=10)
    p.text('2 replicas per backend · topology spread across nodes and AZs · PDB maxUnavailable 1', 10, 300, 420, 30, shop, font=10, color='#3F8624')

    alloy = p.box('<b>Alloy DaemonSet</b> (namespace monitoring) · one Pod on every node — infra and all Karpenter pools · tolerates every taint · ships Pod logs to cluster 2',
                  20, 730, 1520, 40, 'purple', c1, font=11)

    # AWS services column
    sqs = p.icon('sqs', 'SQS interruption queue', 1850, 230, size=56, font=10)
    eb = p.icon('eb', 'EventBridge rules', 1990, 230, size=56, font=10)
    iam = p.icon('iam', 'IAM · Pod Identity<br>Karpenter, LBC, EBS/EFS CSI', 1920, 350, size=56, font=10)
    ecr = p.icon('ecr', 'ECR · shopnow/* (7)', 1920, 470, size=56, font=10)
    efs = p.icon('efs', 'EFS · mount target per AZ', 1920, 590, size=56, font=10)
    ebs = p.icon('ebs', 'EBS gp3 volumes', 1920, 710, size=56, font=10)
    cw = p.icon('cwl', 'CloudWatch Logs', 1920, 830, size=56, font=10)

    p.edge(gh, ar, 'GitOps pull', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(argo, shop, 'deploys & syncs', 'gitops', exit=(1, 0.5), entry=(0, 0.13))
    p.edge(karp, kf, 'launches / removes nodes', 'control', exit=(1, 0.5), entry=(0, 0.18), ly=-14)
    p.edge(eb, sqs, '', 'control', exit=(0, 0.5), entry=(1, 0.5), dashed=True)
    p.edge(sqs, karp, 'Spot interruption, rebalance, state change', 'control', exit=(0.5, 0), entry=(0.5, 0), dashed=True,
           points=[(1878, 205), (920, 205)])
    p.edge(iam, ks, 'Pod Identity credentials', 'net', exit=(0.5, 0), entry=(0.5, 0), dashed=True, points=[(1948, 218), (650, 218)])
    p.edge(ecr, shop, 'image pull', 'image', exit=(0, 0.5), entry=(1, 0.26))
    p.edge(shop, efs, 'NFS 2049', 'storage', exit=(1, 0.62), entry=(0, 0.5))
    p.edge(shop, ebs, 'gp3 (databases)', 'storage', exit=(1, 0.94), entry=(0, 0.5))
    p.edge(cp, cw, 'control-plane logs', 'net', exit=(1, 0.5), entry=(0, 0.5), points=[(1830, 155), (1830, 858)])
    p.edge(prom, to2, 'metrics', 'metrics', exit=(0, 0.5), entry=(1, 0.35), points=[(268, 580), (268, 928)])
    p.edge(alloy, to2, 'logs', 'logs', exit=(0, 0.5), entry=(1, 0.75), points=[(244, 830), (244, 960)])
    p.legend([('gitops', 'GitOps'), ('image', 'Images'), ('storage', 'Storage'), ('metrics', 'Metrics'), ('logs', 'Logs'),
              ('control', 'Node provisioning'), ('net', 'IAM / logs')], 20, 560, w=210)
    return p


def karpenter():
    p = Page('4. Karpenter node pools', 1800, 1000)
    p.title('Karpenter — EC2NodeClass and the three node pools',
            'Pods select a pool with a label and tolerate its taint. Pool 2 is two NodePools sharing one label: On-Demand first (weight 100, 24 vCPU), then Spot (weight 10, 72 vCPU).')
    nc = p.box('<b>EC2NodeClass default</b><br>role Karpenter-eks-workload · AMI alias al2023<br>subnets + SGs by tag karpenter.sh/discovery=eks-workload<br>IMDSv2 required · 30 GiB gp3 encrypted root',
               620, 90, 520, 90, 'yellow', font=11)
    cards = [
        ('Pool 1 · NodePool batch-spot', 'spot', ['capacity-type: spot', 'arch: amd64, arm64', 'label workload=batch, capacity=spot',
                                                 'taint workload=batch:NoSchedule', 'limit cpu 48 · weight 50', 'consolidate after 30s'], 'workshop-spot proof Pod'),
        ('Pool 2a · NodePool ms-od', 'ec2', ['capacity-type: on-demand', 'arch: amd64', 'label workload=microservices, capacity=on-demand',
                                             'taint workload=microservices:NoSchedule', 'limit cpu 24 · weight 100', 'consolidate after 1m'], 'Application backends (first 24 vCPU)'),
        ('Pool 2b · NodePool ms-spot', 'spot', ['capacity-type: spot', 'arch: amd64', 'label workload=microservices, capacity=spot',
                                                'taint workload=microservices:NoSchedule', 'limit cpu 72 · weight 10', 'consolidate after 1m'], 'Application backends (overflow, up to 72 vCPU)'),
        ('Pool 3 · NodePool arm64', 'ec2', ['capacity-type: on-demand or spot', 'arch: arm64 (Graviton)', 'label arch=arm64',
                                            'taint arch=arm64:NoSchedule', 'limit cpu 48 · weight 50', 'consolidate after 1m'], 'workshop-arm64 proof Pod'),
    ]
    ids = []
    for i, (title, ic, props, who) in enumerate(cards):
        x = 30 + i * 440
        f = p.frame(title, x, 260, 400, 330, 'orange' if 'ms-' in title else 'white', font=12)
        p.icon(ic, '', 20, 40, size=56, parent=f)
        p.text('<br>'.join(props), 90, 36, 300, 130, f, font=11)
        p.text('family m/c/r · generation ≥ 6 · no nano/micro/small · expireAfter 720h · WhenEmptyOrUnderutilized',
               20, 180, 360, 40, f, font=10, color='#545B64')
        pod = p.icon('k8s_pod', who, 170, 240, size=40, parent=f, font=10)
        ids.append(f)
        p.edge(nc, f, '', 'default', exit=(0.125 + 0.25 * i, 1), entry=(0.5, 0))
    p.box('<b>Pool 2 = ms-od + ms-spot</b>: one label, one taint, two capacity types. 24 : 72 vCPU = 1 : 3 at full size.',
          470, 600, 840, 40, 'orange', font=12)

    # Interruption pipeline
    f = p.frame('Spot interruption handling', 30, 680, 1740, 290, 'white', font=12)
    ec2 = p.icon('spot', 'EC2 Spot node', 40, 80, size=56, parent=f)
    eb = p.icon('eb', 'EventBridge<br>interruption · rebalance ·<br>state change · scheduled change', 290, 80, size=56, parent=f)
    sqs = p.icon('sqs', 'SQS queue<br>(Terraform output karpenter_queue_name)', 590, 80, size=56, parent=f)
    k = p.icon('k8s_deploy', 'Karpenter controller<br>(infra node)', 900, 80, size=56, parent=f)
    act = p.box('<b>Karpenter reacts</b><br>1. launches a replacement node<br>2. cordons and drains the old node<br>3. evictions respect PodDisruptionBudgets',
                1150, 60, 320, 110, 'blue', f, font=11, align='left')
    pdb = p.box('<b>Limit</b><br>a PDB slows voluntary evictions; it cannot stop AWS reclaiming Spot (2-minute warning)',
                1500, 60, 220, 110, 'red', f, font=11, align='left')
    p.edge(ec2, eb, 'interruption notice', 'control', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(eb, sqs, '', 'control', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(sqs, k, 'poll', 'control', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(k, act, '', 'control', exit=(1, 0.5), entry=(0, 0.5))
    p.text('Consolidation runs separately: empty or under-used nodes are removed after consolidateAfter, again respecting PDBs.',
           40, 220, 1600, 30, f, font=11, color='#545B64')
    return p


def cluster2():
    p = Page('5. Cluster 2 · Observability', 1900, 980)
    p.title('Cluster 2 — eks-observability',
            'Receives metrics and logs from cluster 1 through a private ALB, stores them in Mimir and Loki on S3, and shows them in Grafana. Layer 21-cluster-observability creates it.')
    src = p.box('<b>From cluster 1</b><br>Prometheus remote_write<br>Alloy log push', 20, 330, 200, 90, 'orange')
    r53 = p.icon('hz', 'Route 53 private zone<br>observability.internal<br>mimir. / loki. → ALB alias', 70, 520, size=56, font=10)
    acm = p.icon('acm', 'ACM certificate<br>(imported from cert-manager)', 70, 700, size=56, font=10)

    vpc = p.group('vpc', 'VPC 10.20.0.0/16 · observability subnets', 250, 80, 1350, 880)
    alb = p.icon('alb', 'Internal ALB · group eks-observability-internal<br>HTTPS :9009 → mimir-gateway:8080<br>HTTPS :3100 → loki-gateway:8080<br>SG eks-observability-internal-alb',
                 120, 250, size=60, parent=vpc, font=10, label_pos='top')
    c2 = p.frame('Amazon EKS · eks-observability · Kubernetes 1.34', 330, 40, 1000, 820, 'eks', vpc)
    p.icon('eks', '', 940, 4, size=40, parent=c2)
    p.box('<b>Control plane (AWS managed)</b> · add-ons: VPC CNI, CoreDNS, kube-proxy, EBS CSI, Pod Identity Agent',
          20, 40, 960, 40, 'white', c2, font=11, align='left')
    mng = p.frame('Managed Node Group monitoring · 2 × t3.medium On-Demand', 20, 100, 960, 700, 'k8s', c2, font=11)
    mon = ns(p, 'monitoring', 20, 40, 920, 520, mng)
    mim = p.frame('Mimir (mimir-distributed 6.1) · 1 replica per component · tenant eks-workload', 20, 40, 880, 220, 'orange', mon, font=11)
    comps = [('deploy', 'gateway'), ('deploy', 'distributor'), ('sts', 'ingester'), ('deploy', 'querier'), ('deploy', 'query-frontend'),
             ('deploy', 'query-scheduler'), ('sts', 'store-gateway'), ('sts', 'compactor'), ('deploy', 'ruler'), ('sts', 'alertmanager'),
             ('deploy', 'overrides-exporter')]
    mids = {}
    for i, (k, n) in enumerate(comps):
        mids[n] = p.icon('k8s_' + k, n, 20 + (i % 6) * 145, 40 + (i // 6) * 90, size=40, parent=mim, font=10)
    lok = p.frame('Loki (chart 7.3) · SingleBinary · 1 replica', 20, 280, 420, 120, 'purple', mon, font=11)
    lgw = p.icon('k8s_deploy', 'loki-gateway', 40, 40, size=40, parent=lok, font=10)
    lsb = p.icon('k8s_sts', 'loki (single binary)', 220, 40, size=40, parent=lok, font=10)
    gr = p.frame('Grafana 10.5', 460, 280, 200, 120, 'green', mon, font=11)
    graf = p.icon('k8s_deploy', 'Grafana', 30, 40, size=40, parent=gr, font=10)
    p.icon('k8s_cm', 'dashboards', 120, 40, size=40, parent=gr, font=10)
    pr = p.frame('Prometheus (self)', 680, 280, 220, 120, 'white', mon, font=11)
    p.icon('k8s_sts', 'scrapes cluster 2 only', 80, 40, size=40, parent=pr, font=10)
    p.icon('k8s_pvc', 'gp3 PVCs: ingester / store-gateway / compactor / Loki / Grafana WAL and caches', 20, 420, size=40, parent=mon, font=10, label_pos='right')
    ks = ns(p, 'kube-system', 20, 580, 920, 100, mng)
    p.icon('k8s_deploy', 'AWS Load Balancer Controller 3.4 (creates the internal ALB from the Ingresses)', 20, 40, size=40, parent=ks, font=10, label_pos='right')

    s3m = p.icon('s3', 'S3 eks-observability-mimir-&lt;account&gt;<br>blocks · 30-day expiry', 1680, 200, size=60, font=10)
    s3l = p.icon('s3', 'S3 eks-observability-loki-&lt;account&gt;<br>chunks + index · 30-day expiry', 1680, 420, size=60, font=10)
    iam = p.icon('iam', 'IAM · Pod Identity<br>mimir / loki → S3 · EBS CSI · LBC', 1680, 640, size=56, font=10)

    p.edge(src, alb, 'HTTPS (TLS verified)', 'metrics', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(r53, alb, 'DNS', 'net', exit=(1, 0.5), entry=(0.3, 1), dashed=True)
    p.edge(acm, alb, 'certificate', 'net', exit=(1, 0.5), entry=(0.7, 1), dashed=True)
    p.edge(alb, mids['gateway'], ':8080', 'metrics', exit=(1, 0.3), entry=(0, 0.5))
    p.edge(alb, lgw, ':8080', 'logs', exit=(1, 0.8), entry=(0, 0.5))
    p.edge(mids['gateway'], mids['distributor'], '', 'metrics', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(mids['distributor'], mids['ingester'], '', 'metrics', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(lgw, lsb, '', 'logs', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(mim, s3m, 'blocks', 'storage', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(lsb, s3l, 'chunks', 'storage', exit=(0.5, 0), entry=(0, 0.5), points=[(900, 530), (1640, 530), (1640, 450)])
    p.edge(iam, mng, 'Pod Identity', 'net', exit=(0, 0.5), entry=(1, 0.75), dashed=True)
    p.text('Grafana datasources: Mimir (http://mimir-gateway…/prometheus, header X-Scope-OrgID eks-workload) and Loki (http://loki-gateway…)',
           20, 900, 220, 70, font=10, color='#545B64')
    return p


def telemetry():
    p = Page('6. Telemetry flow', 1900, 1020)
    p.title('Telemetry — how cluster 1 metrics and logs reach cluster 2',
            'Two independent paths over one private HTTPS endpoint. Every series and log line carries cluster="eks-workload".')
    l1 = p.frame('Cluster 1 · eks-workload', 20, 90, 520, 560, 'eks', font=12)
    tg = p.box('<b>Scrape targets</b><br>kubelet / cAdvisor · kube-state-metrics<br>node-exporter · ServiceMonitors', 20, 50, 300, 80, 'white', l1, font=11, align='left')
    prom = p.icon('k8s_sts', 'Prometheus (infra node)<br>externalLabels cluster=eks-workload<br>remote_write + header X-Scope-OrgID', 380, 60, size=48, parent=l1, font=10)
    pods = p.box('<b>Pod stdout / stderr</b><br>every namespace, every node', 20, 300, 300, 70, 'white', l1, font=11, align='left')
    alloy = p.icon('k8s_ds', 'Alloy (DaemonSet)<br>loki.source.kubernetes<br>only Pods on its own node', 380, 300, size=48, parent=l1, font=10)
    ca1 = p.box('<b>Secret observability-alb-tls</b> (namespace monitoring)<br>ca.crt only — used to verify the ALB',
                20, 470, 480, 60, 'purple', l1, font=11, align='left')

    mid = p.frame('Private network path (VPC)', 600, 90, 520, 560, 'white', font=12)
    dns = p.icon('hz', 'Route 53 private zone<br>mimir.observability.internal<br>loki.observability.internal', 380, 50, size=56, parent=mid, font=10)
    alb = p.icon('alb', 'Internal ALB · TLS with ACM certificate<br>:9009 metrics · :3100 logs', 300, 230, size=64, parent=mid, font=10)
    sg = p.box('<b>Security groups</b><br>ALB SG ← cluster 1 node SG on 9009 / 3100<br>cluster 2 node SG ← ALB SG on 8080',
               40, 430, 440, 80, 'white', mid, font=11, align='left')

    r = p.frame('Cluster 2 · eks-observability', 1180, 90, 700, 560, 'eks', font=12)
    mg = p.icon('k8s_deploy', 'mimir-gateway', 40, 60, size=44, parent=r, font=10)
    dist = p.icon('k8s_deploy', 'distributor', 180, 60, size=44, parent=r, font=10)
    ing = p.icon('k8s_sts', 'ingester (WAL on gp3)', 320, 60, size=44, parent=r, font=10, label_pos='top')
    s3m = p.icon('s3', 'S3 · Mimir blocks', 560, 50, size=56, parent=r, font=10)
    qf = p.icon('k8s_deploy', 'query-frontend → querier<br>→ store-gateway', 320, 190, size=44, parent=r, font=10)
    lg = p.icon('k8s_deploy', 'loki-gateway', 40, 330, size=44, parent=r, font=10)
    lk = p.icon('k8s_sts', 'Loki single binary', 180, 330, size=44, parent=r, font=10, label_pos='top')
    s3l = p.icon('s3', 'S3 · Loki chunks', 560, 320, size=56, parent=r, font=10)
    gf = p.icon('k8s_deploy', 'Grafana<br>Explore · dashboards', 320, 450, size=44, parent=r, font=10)

    p.edge(tg, prom, 'scrape', 'metrics', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(pods, alloy, 'Kubernetes API', 'logs', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(prom, dns, 'resolve', 'net', exit=(1, 0.3), entry=(0, 0.5), dashed=True)
    p.edge(prom, alb, 'HTTPS POST /api/v1/push', 'metrics', exit=(1, 0.7), entry=(0, 0.3))
    p.edge(alloy, alb, 'HTTPS POST /loki/api/v1/push', 'logs', exit=(1, 0.5), entry=(0, 0.75))
    p.edge(ca1, alb, 'trust', 'net', exit=(1, 0.8), entry=(0.5, 1), dashed=True, points=[(1100, 608), (1100, 500), (932, 500)])
    p.edge(alb, mg, ':9009 → :8080', 'metrics', exit=(1, 0.3), entry=(0, 0.5))
    p.edge(alb, lg, ':3100 → :8080', 'logs', exit=(1, 0.75), entry=(0, 0.5))
    p.edge(mg, dist, '', 'metrics', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(dist, ing, '', 'metrics', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(ing, s3m, 'flush blocks (2 h)', 'storage', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(lg, lk, '', 'logs', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(lk, s3l, 'chunks', 'storage', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(gf, qf, 'PromQL', 'default', exit=(0.5, 0), entry=(0.5, 1), dashed=True)
    p.edge(gf, lk, 'LogQL', 'default', exit=(0, 0.5), entry=(0.5, 1), dashed=True)
    p.edge(qf, ing, '', 'default', exit=(0.5, 0), entry=(0.5, 1), dashed=True)

    # TLS chain
    t = p.frame('TLS chain — issued once in cluster 1 (step 4.1)', 20, 690, 1860, 310, 'white', font=12)
    steps = [('ClusterIssuer<br>selfsigned-root', 'purple'), ('Certificate<br>observability-ca (CA)', 'purple'),
             ('ClusterIssuer<br>observability-ca-issuer', 'purple'), ('Certificate observability-alb-tls<br>SANs mimir. / loki.observability.internal', 'purple'),
             ('Export cert + key + CA<br>(local, temporary)', 'grey'), ('aws acm import-certificate', 'yellow'), ('Ingress annotation<br>certificate-arn → internal ALB', 'orange')]
    prev = None
    for i, (lbl, c) in enumerate(steps):
        b = p.box(lbl, 20 + i * 262, 60, 230, 70, c, t, font=11)
        if prev:
            p.edge(prev, b, '', 'net', exit=(1, 0.5), entry=(0, 0.5))
        prev = b
        if i == 3:
            cab = b
    caout = p.box('ca.crt → Secret observability-alb-tls in monitoring → Prometheus and Alloy verify the ALB (no insecure_skip_verify)',
                  20, 180, 1000, 50, 'purple', t, font=11)
    p.edge(cab, caout, 'public CA only', 'net', exit=(0.5, 1), entry=(0.85, 0))
    p.legend([('metrics', 'Metrics'), ('logs', 'Logs'), ('storage', 'S3'), ('net', 'DNS / TLS'), ('default', 'Queries')], 1640, 836, w=220)
    return p


def shopnow():
    p = Page('7. Microservices application', 1800, 1000)
    p.title('Microservices — deployed by ArgoCD on pool 2',
            'Namespace shopnow. Six Spring backends + a React frontend, two databases and Keycloak. Every backend mounts its own EFS volume.')
    user = p.icon('user', 'Browser<br>(port-forward)', 40, 300, size=56, font=10)
    ns_ = p.frame('namespace shopnow · nodes of pool 2 (workload=microservices) across AZs', 180, 90, 1380, 720, 'green', font=12)
    fe = p.box('<b>frontend</b> · React + Nginx<br>Argo Rollout blue-green<br>svc :80 (+ preview svc)', 30, 190, 210, 90, 'blue', ns_)
    gw = p.box('<b>api-gateway</b><br>Spring Cloud Gateway<br>:5860 · JWT check', 300, 190, 200, 90, 'blue', ns_)
    prod = p.box('<b>product-service</b> :5861', 580, 70, 220, 56, 'blue', ns_)
    cart = p.box('<b>shopping-cart-service</b> :5863', 580, 200, 220, 56, 'blue', ns_)
    usr = p.box('<b>user-service</b> :5865', 580, 330, 220, 56, 'blue', ns_)
    disc = p.box('<b>discovery-server</b> (Eureka) :8761<br>1 replica, no PDB', 300, 470, 220, 60, 'yellow', ns_)
    cfg = p.box('<b>config-server</b> :5859<br>Spring Cloud Config', 560, 470, 220, 60, 'yellow', ns_)
    pg = p.cyl('<b>PostgreSQL</b> :5432<br>gp3 PVC', 900, 110, 150, 90, 'yellow', ns_)
    kc = p.box('<b>Keycloak</b> :8080<br>realm java-microservice-realm', 870, 300, 210, 60, 'purple', ns_)
    my = p.cyl('<b>MySQL</b> :3306<br>gp3 PVC', 900, 410, 150, 90, 'yellow', ns_)
    rules = p.box('<b>Every backend (workshop values)</b><br>replicas 2 · nodeSelector + toleration workload=microservices<br>'
                  'topology spread: zone + hostname, maxSkew 1, DoNotSchedule<br>PDB maxUnavailable 1 · PVC &lt;service&gt;-efs (RWX, efs-sc) at /data',
                  30, 580, 760, 110, 'white', ns_, font=11, align='left')
    efs = p.icon('efs', 'Amazon EFS<br>1 access point per PVC<br>uid/gid 10001', 1690, 300, size=60, font=10)
    jm = p.box('<b>JavaMelody collector</b><br>(infra node)<br>reads /monitoring', 1620, 600, 170, 70, 'grey', font=11)
    argo = p.box('<b>ArgoCD</b> (infra node)<br>8 Applications + workshop-proof', 600, 870, 300, 60, 'grey', font=11)

    p.edge(user, fe, 'http :8082', 'image', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(fe, gw, 'REST', 'image', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(gw, prod, '/product', 'image', exit=(1, 0.2), entry=(0, 0.5))
    p.edge(gw, cart, '/cart', 'image', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(gw, usr, '/user', 'image', exit=(1, 0.8), entry=(0, 0.5))
    p.edge(prod, pg, '', 'storage', exit=(1, 0.5), entry=(0, 0.3))
    p.edge(cart, pg, '', 'storage', exit=(1, 0.5), entry=(0, 0.8))
    p.edge(cart, prod, 'product lookup', 'default', exit=(0.5, 0), entry=(0.5, 1), dashed=True)
    p.edge(usr, kc, 'tokens', 'net', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(gw, kc, 'JWKS', 'net', exit=(0.5, 0), entry=(1, 0.5), dashed=True, points=[(580, 140), (1310, 140), (1310, 420)])
    p.edge(kc, my, '', 'storage', exit=(0.5, 1), entry=(0.5, 0))
    p.edge(gw, disc, 'register / discover', 'default', exit=(0.5, 1), entry=(0.5, 0), dashed=True)
    p.edge(disc, cfg, '', 'default', exit=(1, 0.5), entry=(0, 0.5), dashed=True, both=True)
    p.edge(ns_, efs, 'NFS · 6 RWX', 'storage', exit=(1, 0.33), entry=(0, 0.5))
    p.edge(jm, ns_, 'JVM stats', 'default', exit=(0, 0.5), entry=(1, 0.66), dashed=True)
    p.edge(argo, ns_, 'sync from eks-core-gitops', 'gitops', exit=(0.5, 0), entry=(0.4, 1))
    return p


def gitops():
    p = Page('8. GitOps & delivery', 1900, 980)
    p.title('Delivery — from the four repositories to AWS and the clusters',
            'Terraform changes infrastructure; Git commits change what ArgoCD deploys; images come from ECR; the docs site deploys itself.')
    eng = p.icon('user', 'Engineer', 40, 420, size=60, font=11)
    lanes = [
        ('eks-core-terraform', 90, 'tf'), ('eks-core-gitops', 330, 'gitops'), ('eks-core-apps', 570, 'image'), ('eks-core-docs', 810, 'gitops')]
    repo = {}
    for name, y, _ in lanes:
        repo[name] = p.icon('gitrepo', name, 230, y + 40, size=56, font=11)
    # terraform lane
    tfb = p.box('<b>terraform plan / apply</b><br>layers 10 → 20 → 21<br>backend.hcl + account.auto.tfvars (local)', 420, 120, 280, 90, 'purple', font=11)
    st = p.icon('s3', 'S3 state bucket<br>eks-tfstate-&lt;account&gt;', 790, 60, size=56, font=10)
    aws = p.box('<b>AWS resources</b><br>VPC · EKS × 2 · node groups · IAM · EFS · ECR · S3 · Route 53', 1000, 120, 330, 90, 'orange', font=11)
    hr = p.box('<b>Helm releases via Terraform</b><br>LBC · Karpenter · ArgoCD · Prometheus · Metrics Server<br>Mimir · Loki · Grafana', 1420, 120, 440, 90, 'blue', font=11)
    # gitops lane
    prep = p.box('<b>prepare-applications.sh</b><br>fills repo URL, revision,<br>ECR repo + IMAGE_TAG', 420, 360, 280, 90, 'green', font=11)
    app = p.box('<b>kubectl apply</b><br>ArgoCD Applications<br>(in order: DB → Eureka/Config → APIs → frontend)', 760, 360, 340, 90, 'green', font=11)
    argo = p.box('<b>ArgoCD</b> (cluster 1)<br>auto-sync · prune · self-heal', 1160, 360, 260, 90, 'green', font=11)
    k8s = p.box('<b>namespace shopnow</b><br>Deployments · Rollout · PVCs · PDBs · Services', 1480, 360, 380, 90, 'green', font=11)
    np_ = p.box('<b>kubectl apply</b> NodePools, cert-manager / Alloy (Helm), JavaMelody, internal Ingress', 760, 470, 600, 50, 'white', font=11)
    # apps lane
    bld = p.box('<b>build-images.sh</b><br>docker buildx · linux/amd64<br>7 images · tag IMAGE_TAG', 420, 600, 280, 90, 'blue', font=11)
    ecr = p.icon('ecr', 'ECR shopnow/*', 820, 610, size=56, font=10)
    # docs lane
    gha = p.box('<b>GitHub Actions</b><br>npm ci · docusaurus build', 420, 840, 280, 70, 'grey', font=11)
    pg = p.box('<b>GitHub Pages</b><br>tranvix0910.github.io/eks-core-docs', 790, 840, 330, 70, 'grey', font=11)

    for name, y, kind in lanes:
        p.edge(eng, repo[name], 'git push' if name == 'eks-core-terraform' else '', kind, exit=(1, 0.5), entry=(0, 0.5))
    p.edge(repo['eks-core-terraform'], tfb, '', 'tf', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(tfb, st, 'state + lock', 'tf', exit=(1, 0.3), entry=(0, 0.5))
    p.edge(tfb, aws, 'create / update', 'tf', exit=(1, 0.6), entry=(0, 0.6))
    p.edge(aws, hr, 'then install charts', 'tf', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(repo['eks-core-gitops'], hr, 'values files (sibling clone ../eks-core-gitops)', 'gitops', exit=(0.5, 0), entry=(0.5, 1),
           dashed=True, points=[(258, 290), (1640, 290)])
    p.edge(repo['eks-core-gitops'], prep, '', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(prep, app, '.workshop/applications', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(app, argo, '', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(argo, k8s, 'sync', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(repo['eks-core-gitops'], np_, 'manifests', 'gitops', exit=(1, 0.8), entry=(0, 0.5), points=[(380, 495)])
    p.edge(repo['eks-core-apps'], bld, '', 'image', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(bld, ecr, 'push', 'image', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(ecr, k8s, 'pull IMAGE_TAG', 'image', exit=(1, 0.5), entry=(0.5, 1), points=[(1670, 638)])
    p.edge(argo, repo['eks-core-gitops'], 'watches charts (Git)', 'gitops', exit=(0.5, 0), entry=(0.5, 0), dashed=True, points=[(1290, 330), (258, 330)])
    p.edge(repo['eks-core-docs'], gha, 'push to main', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(gha, pg, 'deploy', 'gitops', exit=(1, 0.5), entry=(0, 0.5))
    p.legend([('tf', 'Terraform'), ('gitops', 'GitOps / Git'), ('image', 'Images')], 1620, 760, w=200)
    return p


def terraform():
    p = Page('9. Terraform layers', 1800, 840)
    p.title('Terraform — three layers, three states, one bucket',
            'Each layer has its own state key. Layers read each other through terraform_remote_state; on an empty account apply them in five passes.')
    bucket = p.icon('s3', 'S3 eks-tfstate-&lt;account&gt; (ap-southeast-1)<br>versioned · encrypted · use_lockfile', 830, 90, size=60, font=11, label_pos='right')
    L = [
        ('10-network', 'network/terraform.tfstate', 'purple',
         '<b>reads</b> nothing (applied first)<br><br>module vpc (VPC, 9 subnets, IGW, 1 NAT, route tables, Flow Logs)<br>module vpc_endpoints (S3 gateway)<br>subnet discovery and ELB tags<br><br><b>outputs</b> vpc_id, vpc_cidr, azs,<br>workload_node_subnet_ids,<br>observability_node_subnet_ids'),
        ('20-cluster-workload', 'cluster-workload/terraform.tfstate', 'orange',
         '<b>reads</b> 10-network (VPC, subnets) · 21 (node SG for the Rancher rule)<br><br>module eks (cluster, infra node group, add-ons)<br>module karpenter (IAM, SQS, EventBridge)<br>module efs · module ecr<br>Pod Identity: EBS CSI, EFS CSI, LBC<br>StorageClasses gp3, efs-sc<br>Helm: LBC, Karpenter, ArgoCD, Prometheus,<br>Metrics Server, Grafana, Kite<br><br><b>outputs</b> node_security_group_id, efs_file_system_id,<br>ecr_repository_urls, karpenter_* …'),
        ('21-cluster-observability', 'cluster-observability/terraform.tfstate', 'blue',
         '<b>reads</b> 10-network (VPC, subnets) · 20 (node SG for the ALB rule)<br><br>module eks (cluster, monitoring node group)<br>module s3 (Mimir + Loki buckets)<br>Pod Identity: S3, EBS CSI, LBC<br>internal ALB security group<br>module route53_zone (observability.internal)<br>Helm: LBC, Prometheus, Mimir, Loki, Grafana<br><br><b>outputs</b> node_security_group_id,<br>internal_alb_security_group_id, mimir/loki bucket'),
    ]
    ids = []
    for i, (name, key, c, body) in enumerate(L):
        f = p.frame(name, 40 + i * 590, 260, 470, 300, c, font=14)
        p.text(f'state key <b>{key}</b>', 20, 34, 440, 20, f, font=11, color='#545B64')
        p.text(body, 20, 64, 440, 230, f, font=11, valign='top')
        ids.append(f)
        p.edge(f, bucket, '', 'tf', exit=(0.5, 0), entry=(0.2 + 0.3 * i, 1), dashed=True)
    p.edge(ids[0], ids[1], 'remote_state', 'default', exit=(1, 0.5), entry=(0, 0.5))
    p.edge(ids[1], ids[2], 'remote_state (both ways)', 'default', exit=(1, 0.5), entry=(0, 0.5), both=True)
    p.box('<b>Local-only files per layer (gitignored)</b><br>backend.hcl — bucket, profile<br>account.auto.tfvars — account_id<br>'
          '<b>Helm values</b> read from ../eks-core-gitops; &lt;AWS_ACCOUNT_ID&gt; replaced at plan time', 40, 620, 560, 110, 'white', font=11, align='left')
    seq = p.frame('First-time apply order', 650, 600, 1110, 190, 'white', font=12)
    steps = ['1 · 10-network<br>full apply', '2 · 20-cluster-workload<br>-target foundation', '3 · 21-cluster-observability<br>-target foundation',
             '4 · 21-cluster-observability<br>full apply', '5 · 20-cluster-workload<br>full apply']
    prev = None
    for i, s in enumerate(steps):
        b = p.box(s, 20 + i * 218, 50, 190, 70, ['purple', 'orange', 'blue', 'blue', 'orange'][i], seq, font=11)
        if prev:
            p.edge(prev, b, '', 'default', exit=(1, 0.5), entry=(0, 0.5))
        prev = b
    p.text('After bootstrap every change is a full-layer plan → review → apply. -target is used only for passes 2 and 3.', 20, 140, 1060, 30, seq, font=11, color='#545B64')
    return p


def all_pages():
    return [cluster1(), karpenter(), cluster2(), telemetry(), shopnow(), gitops(), terraform()]

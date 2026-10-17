# Architecture diagrams

`eks-core-architecture.drawio` — nine tabs: overview, network, cluster 1, Karpenter node pools, cluster 2, telemetry flow, ShopNow, GitOps & delivery, Terraform layers.

It is generated, not hand-drawn:

| File | Role |
|---|---|
| `drawlib.py` | Small helper: AWS groups, icons, boxes, edges, legend |
| `icon-styles.json` | Exact draw.io styles for the AWS and Kubernetes icons used |
| `pages_a.py` | Tabs 1–2 (overview, network) |
| `pages_b.py` | Tabs 3–9 |
| `build.py` | Writes the `.drawio` and copies it to `static/diagrams/` |

```bash
python3 build.py
# export the images used by the docs site (draw.io desktop CLI)
bash -c 'names=(overview network cluster-1-workload karpenter-node-pools cluster-2-observability telemetry-flow shopnow-application gitops-delivery terraform-layers)
for i in $(seq 1 9); do n=$(printf "%02d-%s" $i ${names[$((i-1))]})
  drawio -x -f png -s 1.5 -b 16 --page-index $i -o ../static/img/architecture/$n.png eks-core-architecture.drawio
done'
```

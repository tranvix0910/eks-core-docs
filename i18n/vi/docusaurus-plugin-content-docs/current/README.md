# EKS Workshop · Tài liệu tiếng Việt {#eks-workshop--documentation-sources}

Website Workshop: **https://tranvix0910.github.io/eks-core-docs/**. Mở website và chọn ngôn ngữ để thực hiện các bước.

Workshop xây dựng 2 EKS Cluster bằng Terraform và GitOps:

- **Cluster Workload**: Managed Node Group cho Platform Tools; 3 nhóm Karpenter Spot, Mixed On-Demand/Spot 1:3 và ARM64; Deploy ShopNow qua ArgoCD, sử dụng EFS, Topology Spread và PDB.
- **Cluster Observability**: Mimir, Loki và Grafana để Collect Metrics, Logs từ Cluster Workload.

| Phần | Thư mục / tài liệu chính |
|---|---|
| 0 · Prepare | `00-platform-overview-and-deployment.md`; `00-architecture/02-organizational-constraints-and-prerequisites.md`; `00-architecture/01-architecture-overview.md` |
| 1 · Terraform | `00-architecture/00-terraform-workflow.md`; `00-architecture/03-layer-10-network.md`; `00-architecture/04-layer-20-cluster-workload.md`; `00-architecture/05-layer-21-cluster-observability.md` |
| 2 · Cluster 1 · Workload | `01-platform-addons/01-gitops-bootstrap-order.md`; `02-karpenter/`; `01-platform-addons/07-kite-dashboard.md` |
| 3 · Microservices | `04-apps-shopnow/` — Build Image, Deploy, EFS, Pod Placement và PDB |
| 4 · Centralized Observability | `01-platform-addons/03-cert-manager-and-internal-tls.md`; `03-observability/` |
| 5 · Kiểm tra và vận hành | `06-operations/06-workshop-acceptance.md`; `06-operations/05-lifecycle-and-cleanup.md`; `06-operations/02-master-incident-catalogue.md` |

Các trang còn lại là bài mở rộng và tài liệu tham khảo. Thứ tự sidebar nằm trong `sidebars.js` ở thư mục gốc repo docs.

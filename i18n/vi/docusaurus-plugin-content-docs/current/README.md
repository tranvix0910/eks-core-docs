# EKS Workshop · Tài liệu tiếng Việt {#eks-workshop--documentation-sources}

Website workshop: **https://tranvix0910.github.io/eks-core-docs/**. Mở website và chọn ngôn ngữ để thực hiện các bước.

workshop hướng dẫn tạo hai EKS cluster và triển khai ShopNow bằng Terraform, Karpenter và ArgoCD. Phần lý thuyết giải thích các thành phần sẽ sử dụng; phần thực hành đi từ network, cluster đến ứng dụng, observability và cleanup.

- **workload cluster**: Managed Node Group cho công cụ vận hành; 3 nhóm Karpenter Spot, Mixed On-Demand/Spot 1:3 và ARM64; deploy ShopNow qua ArgoCD, sử dụng EFS, Topology Spread và PDB.
- **observability cluster**: Mimir, Loki và Grafana để Gửi metrics, Logs từ workload cluster.

| Phần | Thư mục / tài liệu chính |
|---|---|
| 0 · Chuẩn bị | `00-platform-overview-and-deployment.md`; `00-architecture/02-organizational-constraints-and-prerequisites.md`; `00-architecture/01-architecture-overview.md` |
| 1 · Hạ tầng với Terraform | `00-architecture/00-terraform-workflow.md`; `00-architecture/03-layer-10-network.md`; `00-architecture/04-layer-20-cluster-workload.md`; `00-architecture/05-layer-21-cluster-observability.md` |
| 2 · Cấu hình workload cluster | `01-platform-addons/01-gitops-bootstrap-order.md`; `02-karpenter/`; `01-platform-addons/07-kite-dashboard.md` |
| 3 · microservices | `04-apps-shopnow/` — build image, deploy, EFS, phân bổ Pod và PDB |
| 4 · Observability | `01-platform-addons/03-cert-manager-and-internal-tls.md`; `03-observability/` |
| 5 · Kiểm tra và vận hành | `06-operations/06-workshop-acceptance.md`; `06-operations/05-lifecycle-and-cleanup.md`; `06-operations/02-master-incident-catalogue.md` |

Các trang còn lại là bài mở rộng và tài liệu tham khảo. Thứ tự sidebar nằm trong `sidebars.js` ở thư mục gốc repo docs.

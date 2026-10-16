# EKS Workshop — nguồn tài liệu {#eks-workshop--documentation-sources}

Website đã xuất bản: **https://tranvix0910.github.io/eks-core-docs/**. Bắt đầu tại đó.

Workshop xây dựng hai EKS cluster bằng Terraform: workload cluster có Managed Node Group infra, ba pool Karpenter (Spot, mixed On-Demand/Spot 1:3, ARM64), microservices triển khai qua ArgoCD trên EFS với topology spread và PodDisruptionBudget; observability cluster nhận metrics (Mimir), logs (Loki) và hiển thị bằng Grafana.

| Phần | Trang |
|---|---|
| 0 · Trước khi bắt đầu | `00-platform-overview-and-deployment.md`, `00-architecture/02-…prerequisites.md`, `00-architecture/01-architecture-overview.md` |
| 1 · Hạ tầng bằng Terraform | `00-architecture/00-terraform-workflow.md`, `03-layer-10-network.md`, `04-layer-20-cluster-workload.md`, `05-layer-21-cluster-observability.md` |
| 2 · Nền tảng trên cluster 1 | `01-platform-addons/01-gitops-bootstrap-order.md`, `02-karpenter/02…`, `03…`, `05…` |
| 3 · Microservices | `04-apps-shopnow/04…`, `00…`, `05…`, `06…`, `07…` |
| 4 · Observability tập trung | `03-observability/01…`, `01-platform-addons/03…`, `03-observability/02…`, `03…`, `04…` |
| 5 · Nghiệm thu và vận hành | `06-operations/06-workshop-acceptance.md`, `05-lifecycle-and-cleanup.md`, `02-master-incident-catalogue.md` |

Các trang còn lại là bài mở rộng hoặc tham khảo tùy chọn. Thứ tự sidebar được khai báo tại `../sidebars.js`.

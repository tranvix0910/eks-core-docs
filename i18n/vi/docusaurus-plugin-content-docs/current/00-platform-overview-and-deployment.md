---
title: "Workshop Overview"
sidebar_label: "Nội dung và các bước thực hành"
---

# Nội Dung Workshop {#workshop-roadmap}

Workshop hướng dẫn tạo hai EKS cluster và triển khai ứng dụng bằng Terraform, Karpenter, ArgoCD. Chúng ta sẽ đi từ cách các thành phần hoạt động đến cấu hình và kiểm tra kết quả. Các bài lý thuyết được đặt trước phần thực hành liên quan để có thể đọc lại ngay khi cần.

## Lý Thuyết {#theory-before-practice}

Nếu mới làm quen với EKS, có thể đọc các phần này theo thứ tự. Mỗi phần giải thích khái niệm bằng chính cấu hình sẽ dùng trong workshop; bên dưới phần giải thích là các bước thực hành.

| Phần | Nội dung |
|---|---|
| 1 | [Kubernetes và Amazon EKS](00-architecture/01-architecture-overview.md#kubernetes-and-eks) |
| 2 | [VPC, Subnet và Ingress](00-architecture/03-layer-10-network.md#network-basics) |
| 3 | [Terraform, State và Bootstrap](00-architecture/00-terraform-workflow.md#terraform-basics) |
| 4 | [Karpenter và các loại Node](02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md#karpenter-basics) |
| 5 | [GitOps, Helm và ArgoCD](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md#gitops-and-helm) |
| 6 | [PV, PVC, EBS và EFS](04-apps-shopnow/05-efs-persistent-volumes.md#storage-basics) |
| 7 | [Scheduling, Replica và PDB](04-apps-shopnow/07-availability-and-pdb.md#availability-basics) |
| 8 | [Metrics, Logs và Observability](03-observability/01-observability-architecture-overview.md#metrics-and-logs) |
| 9 | [IAM, Kubernetes RBAC và TLS](01-eks-security.md#aws-and-kubernetes-access) |

## Nội Dung Triển Khai {#the-assignment}

**Cluster 1 — Workload**

1. Triển khai một **Managed Node Group** chạy các công cụ vận hành: Prometheus, JavaMelody, Karpenter, ArgoCD.
2. **Ba nhóm NodePool Karpenter**:
   - Pool 1 — Spot instance
   - Pool 2 — kết hợp On-Demand và Spot, tỷ lệ **1:3**
   - Pool 3 — ARM64
3. Microservices chạy trên **Pool 2**.
4. Microservices sử dụng Persistent Volume từ EFS.
5. Container được **phân bổ đều trên các worker node** (Pod Topology Spread Constraints / Pod Anti-Affinity).
6. Cấu hình **PodDisruptionBudget** để giới hạn eviction tự nguyện, kết hợp replica và topology spread để giảm ảnh hưởng khi bảo trì Node.
7. Microservices triển khai **qua ArgoCD**.

**Cluster 2 — Observability**

8. Observability tập trung với Prometheus/Mimir, Grafana và Loki.
9. Gửi Metrics và Logs từ Workload Cluster sang Observability Cluster.

## Các Bước Thực Hành {#steps}

### Session 0 · Chuẩn bị

| Bước | Thực hiện |
|---|---|
| **0.1** [Chuẩn bị và thiết lập](architecture/organizational-constraints-and-prerequisites) | Cài đặt công cụ CLI (Terraform, kubectl, Helm, AWS CLI), clone source code, nạp biến môi trường (`workshop.env`) và khởi tạo S3 backend state bucket |
| **0.2** [Kiến trúc](architecture/architecture-overview) | Nắm vững kiến trúc tổng thể 2 cluster (Workload & Observability), luồng kết nối và phân định ranh giới trách nhiệm giữa các thành phần |

### Session 1 · Hạ tầng với Terraform

| Bước | Thực hiện |
|---|---|
| **1.0** [Quy trình Terraform](architecture/terraform-workflow) | Tìm hiểu cấu trúc 3 layer hạ tầng, nguyên tắc phân tách state độc lập và chu trình plan / apply |
| **1.1** [Network](architecture/layer-10-network) | Chạy `terraform apply` layer `10-network` để khởi tạo VPC, Subnet (Public/Private), Route Table và NAT Gateway cho cả hai cluster |
| **1.2** [Cluster 1 · Workload](architecture/layer-20-cluster-workload) | Chạy `terraform apply` layer `20-cluster-workload` để tạo cluster `eks-workload`, Managed Node Group `infra`, EFS và ECR repository |
| **1.3** [Cluster 2 · Observability](architecture/layer-21-cluster-observability) | Chạy `terraform apply` layer `21-cluster-observability` tạo cluster `eks-observability` cùng stack Mimir, Loki, Grafana; sau đó chạy lại layer 20 để hoàn tất add-on cho cluster 1 |

### Session 2 · Cấu hình Workload Cluster & Platform

| Bước | Thực hiện |
|---|---|
| **2.1** [Công cụ vận hành](platform-addons/gitops-bootstrap-order) | Kiểm tra các controller do Terraform cài sẵn trên Managed Node Group; triển khai bổ sung cert-manager, Argo Rollouts và JavaMelody |
| **2.2** [Ba nhóm NodePool](karpenter/ec2nodeclass-and-nodepools-configuration) | Áp dụng EC2NodeClass và 3 cấu hình NodePool (Spot, Mixed, ARM64) của Karpenter bằng `kubectl`, xác minh khả năng cấp phát node |
| **2.3** [Mixed pool 1:3](karpenter/on-demand-spot-ratio-and-limits) | Triển khai workload kiểm thử và đo đạc tỷ lệ phân bổ On-Demand : Spot đạt chuẩn tỷ lệ 1:3 trên Mixed pool |
| **2.4** [ARM64](karpenter/arm64-validation) | Triển khai container ARM64 để Karpenter tự động cấp phát node Graviton / ARM64 và xác minh container chạy thành công |
| **2.5** [Kite Dashboard](platform-addons/kite-dashboard) | Truy cập giao diện quản trị web Kite Dashboard thông qua port-forward hoặc Application Load Balancer (ALB) |

### Session 3 · Triển khai Microservices

| Bước | Thực hiện |
|---|---|
| **3.1** [Build Image](apps-shopnow/docker-build-multi-arch-and-ci) | Thực hiện build multi-arch và push 7 container images của ứng dụng microservices ShopNow lên Amazon ECR |
| **3.2** [Triển khai qua ArgoCD](apps-shopnow/shopnow-end-to-end-deployment-guide) | Tạo Application trên ArgoCD để GitOps tự động đồng bộ và triển khai toàn bộ dịch vụ ShopNow lên Karpenter pool 2 |
| **3.3** [EFS Persistent Volumes](apps-shopnow/efs-persistent-volumes) | Kiểm tra khả năng lưu trữ dùng chung bằng cách ghi và đọc file đồng thời giữa các Pod qua Persistent Volume từ Amazon EFS |
| **3.4** [Phân bổ Pod](apps-shopnow/pod-placement) | Kiểm tra cấu hình Topology Spread Constraints và Pod Anti-Affinity để đảm bảo Pod phân bổ đều trên các node và AZ |
| **3.5** [PDB & Tính sẵn sàng](apps-shopnow/availability-and-pdb) | Kiểm thử khả năng chịu lỗi và tính sẵn sàng của ứng dụng khi drain node theo hạn ngạch PodDisruptionBudget |

### Session 4 · Giám sát tập trung (Observability)

| Bước | Thực hiện |
|---|---|
| **4.1** [TLS và Private DNS](platform-addons/cert-manager-and-internal-tls) | Thiết lập kết nối mạng riêng giữa hai cluster qua Route 53 Private DNS và chứng chỉ TLS nội bộ từ cert-manager cho endpoint Mimir và Loki |
| **4.2** [Metrics → Mimir](observability/mimir-metrics-pipeline) | Cấu hình Prometheus trên Cluster 1 gửi toàn bộ chỉ số giám sát sang Mimir trên Cluster 2 qua cơ chế `remote_write` |
| **4.3** [Logs → Loki](observability/loki-logging-pipeline) | Cài đặt và cấu hình Grafana Alloy trên Cluster 1 để thu thập và chuyển tiếp toàn bộ container logs về Loki trên Cluster 2 |
| **4.4** [Grafana Dashboards](observability/grafana-dashboards) | Cấu hình Mimir & Loki Data Sources trên Grafana Cluster 2, kiểm tra dashboard quan sát tập trung cho Cluster 1 |

### Session 5 · Kiểm tra và vận hành

| Bước | Thực hiện |
|---|---|
| **5.1** [Checklist nghiệm thu](operations/workshop-acceptance) | Thực hiện đối chiếu toàn bộ các tiêu chí kỹ thuật theo checklist nghiệm thu và lưu lại bằng chứng kiểm thử của workshop |
| **5.2** [Vận hành và cleanup](operations/lifecycle-and-cleanup) | Thực hành quy trình thay đổi cấu hình, rollback hệ thống và destroy toàn bộ tài nguyên theo đúng thứ tự để dọn dẹp môi trường, tránh phát sinh chi phí |

Dự kiến 1 ngày cho lần thực hiện đầu tiên. Mỗi EKS cluster thường cần khoảng 15 phút để tạo; build image và provision node Karpenter cũng cần thời gian chờ.

## Chi phí {#cost}

Chi phí ước tính theo giá On-Demand tại `ap-northeast-1` (Tokyo), chưa tính thuế và credit:

| Tài nguyên | Số lượng | USD mỗi giờ |
|---|---|---|
| EKS control plane ($0.10/giờ) | 2 cluster | 0.20 |
| Node group infra, `t3.large` ($0.1088/giờ) | 3 node | 0.33 |
| Node group observability, `t3.medium` ($0.0544/giờ) | 2 node | 0.11 |
| NAT gateway ($0.062/giờ + $0.062/GB) | 1 | 0.06 |
| Application Load Balancer ($0.0243/giờ + LCU) | 2 (quản trị, nội bộ) | 0.05 |
| Địa chỉ public IPv4 ($0.005/giờ) | khoảng 4 | 0.02 |
| **Chi phí nền sau khi apply Terraform** | | **≈ 0.77** |
| Node Karpenter cho các bài thực hành và ứng dụng (Spot rẻ hơn) | 3–5 node | ≈ 0.3–0.6 |

EBS, EFS, S3, ECR và data transfer chỉ thêm vài cent mỗi giờ ở quy mô Workshop. **Một ngày làm workshop (khoảng 8 giờ) tốn khoảng 10–15 USD.** Nếu để hệ thống chạy, riêng chi phí nền đã khoảng 18 USD mỗi ngày, vì vậy hãy [cleanup](operations/lifecycle-and-cleanup) ngay trong ngày.

:::note
Đây là số ước tính từ bảng giá AWS; hãy kiểm tra lại bằng [AWS Pricing Calculator](https://calculator.aws/) cho region và tài khoản của bạn. Nếu có credit hoặc Free Tier, chi phí sẽ thấp hơn.
:::                      

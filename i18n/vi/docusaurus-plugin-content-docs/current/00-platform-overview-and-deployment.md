---
title: "Nội dung workshop"
sidebar_label: "Nội dung và lộ trình"
---

# Nội dung workshop {#workshop-roadmap}

Workshop hướng dẫn tạo hai EKS cluster và triển khai ứng dụng bằng Terraform, Karpenter, ArgoCD. Chúng ta sẽ đi từ cách các thành phần hoạt động đến cấu hình và kiểm tra kết quả. Các bài lý thuyết được đặt trước phần thực hành liên quan để bạn có thể đọc lại ngay khi cần.

## Đọc lý thuyết trước khi thực hành {#theory-before-practice}

Nếu mới làm quen với EKS, đọc các phần này theo thứ tự. Mỗi phần giải thích khái niệm bằng chính cấu hình sẽ dùng trong workshop; bên dưới phần giải thích là các bước thực hành.

| Phần | Nội dung |
|---|---|
| 1 | [Kubernetes và Amazon EKS](00-architecture/01-architecture-overview.md#kubernetes-and-eks) |
| 2 | [VPC, subnet và Ingress](00-architecture/03-layer-10-network.md#network-basics) |
| 3 | [Terraform, state và bootstrap](00-architecture/00-terraform-workflow.md#terraform-basics) |
| 4 | [Karpenter và các loại node](02-karpenter/02-ec2nodeclass-and-nodepools-configuration.md#karpenter-basics) |
| 5 | [GitOps, Helm và ArgoCD](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md#gitops-and-helm) |
| 6 | [PV, PVC, EBS và EFS](04-apps-shopnow/05-efs-persistent-volumes.md#storage-basics) |
| 7 | [Scheduling, replica và PDB](04-apps-shopnow/07-availability-and-pdb.md#availability-basics) |
| 8 | [Metrics, logs và observability](03-observability/01-observability-architecture-overview.md#metrics-and-logs) |
| 9 | [IAM, Kubernetes RBAC và TLS](01-eks-security.md#aws-and-kubernetes-access) |

## Nội dung triển khai {#the-assignment}

**Cluster 1 — Workload**

1. Triển khai một **Managed Node Group** chạy các công cụ vận hành: Prometheus, JavaMelody, Karpenter, ArgoCD.
2. **Ba nhóm NodePool Karpenter**:
   - Pool 1 — Spot instance
   - Pool 2 — kết hợp On-Demand và Spot, tỷ lệ **1:3**
   - Pool 3 — ARM64
3. Microservices chạy trên **pool 2**.
4. Microservices sử dụng persistent volume từ EFS.
5. Container được **phân bổ đều trên các worker node** (Pod Topology Spread Constraints / Pod Anti-Affinity).
6. Cấu hình **PodDisruptionBudget** để giới hạn eviction tự nguyện, kết hợp replica và topology spread để giảm ảnh hưởng khi bảo trì node.
7. Microservices triển khai **qua ArgoCD**.

**Cluster 2 — Observability**

8. Observability tập trung với Prometheus/Mimir, Grafana và Loki.
9. Gửi metrics và logs từ workload cluster sang observability cluster.

## Yêu cầu về hạ tầng và cách triển khai {#implementing-each-requirement}

| # | Yêu cầu | Cách triển khai | Bước thực hiện | Kết quả cần kiểm tra |
|---|---|---|---|---|
| 1 | Managed Node Group cho hạ tầng | EKS Managed Node Group `infra` (label `role=infra`, taint `CriticalAddonsOnly`); mọi platform chart dùng `nodeSelector: role=infra` kèm toleration tương ứng, nên Pod ứng dụng không chạy lên được node này | [1.2](architecture/layer-20-cluster-workload), [2.1](platform-addons/gitops-bootstrap-order) | Pod Prometheus, JavaMelody, Karpenter và ArgoCD đều chạy trên node `role=infra` |
| 2 | Spot pool | NodePool `batch-spot` (`capacity-type=spot`) | [2.2](karpenter/ec2nodeclass-and-nodepools-configuration) | Pod thực hành chạy trên node Spot của `batch-spot` |
| 2 | mixed pool 1:3 | NodePool `ms-od` (On-Demand, 24 vCPU, weight 100) + `ms-spot` (Spot, 72 vCPU, weight 10), dùng chung label và taint | [2.2](karpenter/ec2nodeclass-and-nodepools-configuration), [2.3](karpenter/on-demand-spot-ratio-and-limits) | Báo cáo capacity phân biệt node và vCPU On-Demand với Spot |
| 2 | ARM64 pool | NodePool `arm64` (`kubernetes.io/arch=arm64`) | [2.4](karpenter/arm64-validation) | `uname -m` trả về `aarch64` trên node `arm64` |
| 3 | Microservices trên pool 2 | Values của backend và frontend: `nodeSelector: workload=microservices` + toleration tương ứng | [3.2](apps-shopnow/shopnow-end-to-end-deployment-guide) | Mọi Pod backend và frontend chạy trên node `ms-od` hoặc `ms-spot` |
| 4 | Persistent volume EFS | EFS file system + EFS CSI driver + StorageClass `efs-sc`; mỗi service có một PVC `ReadWriteMany` mount tại `/data` | [1.2](architecture/layer-20-cluster-workload), [3.3](apps-shopnow/efs-persistent-volumes) | Hai replica đọc cùng một file; file còn tồn tại sau khi thay Pod |
| 5 | Phân bổ đều | `topologySpreadConstraints` theo zone và hostname, `maxSkew: 1` | [3.4](apps-shopnow/pod-placement) | Bảng Pod → node → zone có độ lệch ≤ 1 |
| 6 | PodDisruptionBudget | `maxUnavailable: 1` cho mỗi service có hai replica (API gateway, config server, product, cart, user); PDB yêu cầu 2/3 replica trên workload kiểm tra. `discovery-server` và frontend chỉ chạy một replica nên không có PDB và không áp dụng spread | [3.5](apps-shopnow/availability-and-pdb) | Eviction bị từ chối khi budget bằng 0 và được phép khi bằng 1 |
| 7 | Triển khai qua ArgoCD | Mỗi service có một ArgoCD Application, đọc Helm chart từ `eks-core-gitops` | [3.2](apps-shopnow/shopnow-end-to-end-deployment-guide) | Mọi Application đều `Synced` và `Healthy` |
| 8 | Observability tập trung | Cluster 2 chạy Mimir, Loki và Grafana với lưu trữ S3 | [1.3](architecture/layer-21-cluster-observability) | Receiver Pod Ready, truy cập được Grafana |
| 9 | Chuyển telemetry 1 → 2 | Prometheus `remote_write` → Mimir; Alloy DaemonSet → Loki; qua ALB nội bộ với private DNS và TLS | [4.1–4.4](observability/observability-architecture-overview) | Query được metric và dòng log mới của cluster 1 tại Grafana cluster 2 |

## Các bước thực hành {#steps}

| Bước | Thực hiện | Kết quả |
|---|---|---|
| **0.1** [Chuẩn bị và thiết lập](architecture/organizational-constraints-and-prerequisites) | Cài công cụ, clone repo, setup environment, tạo state bucket | Có thể chạy Terraform với tài khoản của bạn |
| **0.2** [Kiến trúc](architecture/architecture-overview) | Tổng quan về kiến trúc | Hiểu từng thành phần chạy ở đâu |
| **1.0** [Quy trình Terraform](architecture/terraform-workflow) | Tìm hiểu thứ tự layer và vòng plan, apply | — |
| **1.1** [Network](architecture/layer-10-network) | `terraform apply` layer `10-network` | VPC và subnet cho hai cluster |
| **1.2** [Cluster 1](architecture/layer-20-cluster-workload) | `terraform apply` layer `20-cluster-workload` | `eks-workload`, node infra, EFS, ECR |
| **1.3** [Cluster 2](architecture/layer-21-cluster-observability) | `terraform apply` layer `21-cluster-observability`, sau đó hoàn tất layer 20 | `eks-observability`, Mimir, Loki, Grafana; add-on cluster 1 |
| **2.1** [Công cụ vận hành](platform-addons/gitops-bootstrap-order) | Kiểm tra các công cụ đã cài; thêm cert-manager, Rollouts và JavaMelody | Mọi công cụ vận hành chạy trên Managed Node Group |
| **2.2** [Ba nhóm NodePool](karpenter/ec2nodeclass-and-nodepools-configuration) | Apply EC2NodeClass và NodePool bằng `kubectl` | Pool Spot, mixed và ARM64 sẵn sàng |
| **2.3** [Mixed pool 1:3](karpenter/on-demand-spot-ratio-and-limits) | Đo tỷ lệ On-Demand:Spot | Báo cáo tỷ lệ |
| **2.4** [ARM64](karpenter/arm64-validation) | Chạy container ARM64 | Node ARM64 được cấp và container chạy được |
| **2.5** [Kite dashboard](platform-addons/kite-dashboard) | Mở dashboard của cluster bằng port-forward hoặc qua ALB | Giao diện web để quản lý cluster 1 |
| **3.1** [Build image](apps-shopnow/docker-build-multi-arch-and-ci) | Build và push 7 image | Image nằm trong ECR |
| **3.2** [Triển khai qua ArgoCD](apps-shopnow/shopnow-end-to-end-deployment-guide) | Tạo ArgoCD Application | Microservices chạy trên pool 2 |
| **3.3** [EFS](apps-shopnow/efs-persistent-volumes) | Ghi và đọc file dùng chung | Kết quả kiểm tra lưu trữ |
| **3.4** [Phân bổ đều](apps-shopnow/pod-placement) | Kiểm tra phân bổ theo từng service | Bảng placement |
| **3.5** [PDB](apps-shopnow/availability-and-pdb) | Kiểm thử eviction theo budget | Kết quả kiểm tra tính sẵn sàng |
| **4.1** [TLS và private DNS](platform-addons/cert-manager-and-internal-tls) | Kết nối hai cluster qua mạng riêng | endpoint nội bộ cho Mimir và Loki |
| **4.2** [Metrics → Mimir](observability/mimir-metrics-pipeline) | Kiểm tra remote_write | Metrics cluster 1 ở cluster 2 |
| **4.3** [Logs → Loki](observability/loki-logging-pipeline) | Cài Alloy | Logs cluster 1 ở cluster 2 |
| **4.4** [Grafana](observability/grafana-dashboards) | Query hai datasource | Quan sát cluster 1 tại một nơi |
| **5.1** [Kiểm tra](operations/workshop-acceptance) | Điền checklist | Kết quả kiểm tra cho từng yêu cầu |
| **5.2** [Vận hành và cleanup](operations/lifecycle-and-cleanup) | Thay đổi, rollback, destroy | Cập nhật được cấu hình và dọn môi trường |

Dự kiến 1 ngày cho lần thực hiện đầu tiên. Mỗi EKS cluster thường cần khoảng 15 phút để tạo; build image và cấp node Karpenter cũng cần thời gian chờ.

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

EBS, EFS, S3, ECR và data transfer chỉ thêm vài cent mỗi giờ ở quy mô workshop. **Một ngày làm workshop (khoảng 8 giờ) tốn khoảng 10–15 USD.** Nếu để hệ thống chạy, riêng chi phí nền đã khoảng 18 USD mỗi ngày, vì vậy hãy [cleanup](operations/lifecycle-and-cleanup) ngay trong ngày.

:::note
Đây là số ước tính từ bảng giá AWS; hãy kiểm tra lại bằng [AWS Pricing Calculator](https://calculator.aws/) cho region và tài khoản của bạn. Nếu có credit hoặc Free Tier, chi phí sẽ thấp hơn.
:::

## Cách thực hiện workshop {#conventions-used-in-every-step}

- Đọc phần giải thích đầu bài và kiểm tra **Chạy từ** trước khi thực hiện lệnh.
- Lệnh dùng Bash. Mọi lệnh `kubectl` truyền `--context eks-workload` hoặc `--context eks-observability` để thao tác đúng cluster.
- Đường dẫn sử dụng biến từ [bước 0.1](architecture/organizational-constraints-and-prerequisites): `$TF_DIR`, `$GITOPS_DIR`, `$APPS_DIR`, `$PLAN_DIR`, `$EVIDENCE_DIR`.
- Chạy phần **Kiểm tra** cuối mỗi bước trước khi chuyển sang bước tiếp theo.

:::warning Chi phí
Workshop tạo tài nguyên có tính phí: hai EKS control plane, EC2 node, NAT gateway, EFS, load balancer và S3. Thực hiện [cleanup](operations/lifecycle-and-cleanup) khi hoàn tất.
:::

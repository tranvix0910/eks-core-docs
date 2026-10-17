---
title: "Lộ trình workshop"
sidebar_label: "Lộ trình và yêu cầu"
---

# Lộ trình workshop {#workshop-roadmap}

Trang này liệt kê **đề bài workshop**, **vị trí triển khai từng yêu cầu** và **thứ tự thực hiện**. Đọc một lượt, sau đó làm lần lượt từ trên xuống dưới.

## Đề bài {#the-assignment}

**Cluster 1 — Workload**

1. Một **Managed Node Group** chạy các công cụ hạ tầng: Prometheus, JavaMelody, Karpenter, ArgoCD.
2. **Ba nhóm node Karpenter**:
   - Pool 1 — Spot instance
   - Pool 2 — kết hợp On-Demand và Spot, tỷ lệ **1:3**
   - Pool 3 — ARM64
3. Microservices chạy trên **pool 2**.
4. Microservices sử dụng **persistent volume từ EFS**.
5. Container được **phân bổ đều trên các worker node** (Pod Topology Spread Constraints / Pod Anti-Affinity).
6. **PodDisruptionBudget** bảo vệ tính sẵn sàng.
7. Microservices được triển khai **qua ArgoCD**.

**Cluster 2 — Observability**

8. Observability tập trung: metrics tương thích Prometheus, Grafana, Loki.
9. Metrics và logs từ cluster 1 được **chuyển sang cluster 2**.

## Cách triển khai từng yêu cầu {#how-each-requirement-is-implemented}

| # | Yêu cầu | Cách triển khai | Bước thực hiện | Cách chứng minh |
|---|---|---|---|---|
| 1 | Managed Node Group cho hạ tầng | EKS Managed Node Group `infra` (label `role=infra`); mọi platform chart dùng `nodeSelector: role=infra` | [1.2](architecture/layer-20-cluster-workload), [2.1](platform-addons/gitops-bootstrap-order) | Pod Prometheus, JavaMelody, Karpenter và ArgoCD đều chạy trên node `role=infra` |
| 2 | Spot pool | NodePool `batch-spot` (`capacity-type=spot`) | [2.2](karpenter/ec2nodeclass-and-nodepools-configuration) | Pod thử nghiệm chạy trên node Spot của `batch-spot` |
| 2 | Mixed pool 1:3 | NodePool `ms-od` (On-Demand, 24 vCPU, weight 100) + `ms-spot` (Spot, 72 vCPU, weight 10), dùng chung label và taint | [2.2](karpenter/ec2nodeclass-and-nodepools-configuration), [2.3](karpenter/on-demand-spot-ratio-and-limits) | Báo cáo capacity phân biệt node và vCPU On-Demand với Spot |
| 2 | ARM64 pool | NodePool `arm64` (`kubernetes.io/arch=arm64`) | [2.4](karpenter/arm64-validation) | `uname -m` trả về `aarch64` trên node `arm64` |
| 3 | Microservices trên pool 2 | Backend values: `nodeSelector: workload=microservices` + toleration tương ứng | [3.2](apps-shopnow/shopnow-end-to-end-deployment-guide) | Mọi backend Pod chạy trên node `ms-od` hoặc `ms-spot` |
| 4 | Persistent volume EFS | EFS file system + EFS CSI driver + StorageClass `efs-sc`; mỗi service có một PVC `ReadWriteMany` mount tại `/data` | [1.2](architecture/layer-20-cluster-workload), [3.3](apps-shopnow/efs-persistent-volumes) | Hai replica đọc cùng một tệp; tệp còn tồn tại sau khi thay Pod |
| 5 | Phân bổ đều | `topologySpreadConstraints` theo zone và hostname, `maxSkew: 1` | [3.4](apps-shopnow/pod-placement) | Bảng Pod → node → zone có độ lệch ≤ 1 |
| 6 | PodDisruptionBudget | `maxUnavailable: 1` cho mỗi backend; PDB yêu cầu 2/3 replica trên workload kiểm chứng | [3.5](apps-shopnow/availability-and-pdb) | Eviction bị từ chối khi budget bằng 0 và được phép khi bằng 1 |
| 7 | Triển khai qua ArgoCD | Mỗi service có một ArgoCD Application, đọc Helm chart từ `eks-core-gitops` | [3.2](apps-shopnow/shopnow-end-to-end-deployment-guide) | Mọi Application đều `Synced` và `Healthy` |
| 8 | Observability tập trung | Cluster 2 chạy Mimir, Loki và Grafana với lưu trữ S3 | [1.3](architecture/layer-21-cluster-observability) | Receiver Pod Ready, truy cập được Grafana |
| 9 | Chuyển telemetry 1 → 2 | Prometheus `remote_write` → Mimir; Alloy DaemonSet → Loki; qua ALB nội bộ với private DNS và TLS | [4.1–4.4](observability/observability-architecture-overview) | Query được metric và dòng log mới của cluster 1 tại Grafana cluster 2 |

## Các bước {#steps}

| Bước | Thực hiện | Kết quả |
|---|---|---|
| **0.1** [Chuẩn bị và thiết lập](architecture/organizational-constraints-and-prerequisites) | Cài công cụ, clone repo, đặt biến, tạo state bucket | Có thể chạy Terraform với tài khoản của bạn |
| **0.2** [Kiến trúc](architecture/architecture-overview) | Đọc thiết kế đích | Hiểu từng thành phần chạy ở đâu |
| **1.0** [Quy trình Terraform](architecture/terraform-workflow) | Hiểu thứ tự các lớp và quy trình plan/apply | — |
| **1.1** [Network](architecture/layer-10-network) | `terraform apply` lớp `10-network` | VPC và subnet cho hai cluster |
| **1.2** [Cluster 1](architecture/layer-20-cluster-workload) | Apply hạ tầng nền lớp `20-cluster-workload` | `eks-workload`, node infra, EFS, ECR |
| **1.3** [Cluster 2](architecture/layer-21-cluster-observability) | Apply lớp `21-cluster-observability`, sau đó hoàn tất lớp 20 | `eks-observability`, Mimir, Loki, Grafana; add-on cluster 1 |
| **2.1** [Công cụ nền tảng](platform-addons/gitops-bootstrap-order) | Kiểm chứng công cụ do Terraform cài; thêm cert-manager và JavaMelody | Mọi công cụ hạ tầng chạy trên Managed Node Group |
| **2.2** [Ba nhóm node](karpenter/ec2nodeclass-and-nodepools-configuration) | Apply EC2NodeClass và NodePool, thử Spot | Pool Spot, mixed và ARM64 sẵn sàng |
| **2.3** [Mixed pool 1:3](karpenter/on-demand-spot-ratio-and-limits) | Đo tỷ lệ On-Demand:Spot | Báo cáo tỷ lệ |
| **2.4** [ARM64](karpenter/arm64-validation) | Chạy container ARM64 | Bằng chứng capacity ARM64 |
| **2.5** [Kite dashboard](platform-addons/kite-dashboard) | Mở dashboard của cluster, có thể qua ALB quản trị | Giao diện web cho cluster 1 |
| **3.1** [Build image](apps-shopnow/docker-build-multi-arch-and-ci) | Build và push bảy image | Image nằm trong ECR |
| **3.2** [Triển khai qua ArgoCD](apps-shopnow/shopnow-end-to-end-deployment-guide) | Tạo ArgoCD Application | ShopNow chạy trên pool 2 |
| **3.3** [EFS](apps-shopnow/efs-persistent-volumes) | Ghi và đọc tệp dùng chung | Bằng chứng lưu trữ |
| **3.4** [Phân bổ đều](apps-shopnow/pod-placement) | Kiểm tra phân bổ theo từng service | Bảng placement |
| **3.5** [PDB](apps-shopnow/availability-and-pdb) | Kiểm thử eviction theo budget | Bằng chứng tính sẵn sàng |
| **4.1** [TLS và private DNS](platform-addons/cert-manager-and-internal-tls) | Kết nối hai cluster qua mạng riêng | Endpoint nội bộ cho Mimir và Loki |
| **4.2** [Metrics → Mimir](observability/mimir-metrics-pipeline) | Kiểm chứng remote_write | Metrics cluster 1 ở cluster 2 |
| **4.3** [Logs → Loki](observability/loki-logging-pipeline) | Cài Alloy | Logs cluster 1 ở cluster 2 |
| **4.4** [Grafana](observability/grafana-dashboards) | Query hai datasource | Quan sát cluster 1 tại một nơi |
| **5.1** [Nghiệm thu](operations/workshop-acceptance) | Điền checklist | Bằng chứng cho từng yêu cầu |
| **5.2** [Vận hành và cleanup](operations/lifecycle-and-cleanup) | Thay đổi, rollback, destroy | Có thể vận hành và xóa nền tảng |

Dành trọn một ngày làm việc cho lần chạy đầu tiên. Phần lớn thời gian chờ là tạo EKS cluster, khoảng 15 phút mỗi cluster, và Karpenter khởi tạo node.

## Quy ước trong mọi bước {#conventions-used-in-every-step}

- Mỗi trang mở đầu bằng hộp **mục tiêu**, **yêu cầu** liên quan và **repo** để chạy lệnh.
- Lệnh dùng Bash. Mọi lệnh `kubectl` truyền `--context eks-workload` hoặc `--context eks-observability` để thao tác đúng cluster.
- Đường dẫn sử dụng biến từ [bước 0.1](architecture/organizational-constraints-and-prerequisites): `$TF_DIR`, `$GITOPS_DIR`, `$APPS_DIR`, `$PLAN_DIR`, `$EVIDENCE_DIR`.
- Mỗi bước kết thúc bằng phần **Kiểm chứng**. Chỉ tiếp tục khi kiểm chứng thành công.

:::warning Chi phí
Workshop tạo tài nguyên có tính phí: hai EKS control plane, EC2 node, NAT gateway, EFS, load balancer và S3. Thực hiện [cleanup](operations/lifecycle-and-cleanup) khi hoàn tất.
:::

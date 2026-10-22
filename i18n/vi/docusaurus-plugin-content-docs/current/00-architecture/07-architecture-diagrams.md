---
title: "Sơ đồ kiến trúc"
sidebar_label: "0.3 Sơ đồ kiến trúc"
---

# Sơ đồ kiến trúc {#architecture-diagrams}

Các sơ đồ được lưu trong một file draw.io gồm chín tab: **[eks-core-architecture.drawio](https://github.com/tranvix0910/eks-core-docs/raw/main/static/diagrams/eks-core-architecture.drawio)**. Bạn có thể mở bằng [draw.io desktop](https://github.com/jgraph/drawio-desktop/releases) hoặc [app.diagrams.net](https://app.diagrams.net). Bấm vào từng ảnh bên dưới để xem bản đầy đủ.

| Tab | Nội dung |
|---|---|
| [1. Tổng quan](#1-overview) | Hai cluster, VPC, các dịch vụ AWS sử dụng, GitHub và bucket state |
| [2. Mạng](#2-network) | VPC, ba AZ, chín subnet, NAT, endpoint, route table, tag discovery |
| [3. Cluster 1 · Workload](#3-cluster-1--workload) | Các namespace trên node group infra, ba pool Karpenter, ứng dụng |
| [4. Node pool Karpenter](#4-karpenter-node-pools) | EC2NodeClass, bốn NodePool với label, taint, limit, weight; xử lý Spot interruption |
| [5. Cluster 2 · Observability](#5-cluster-2--observability) | Các thành phần Mimir, Loki, Grafana, ALB nội bộ, S3, DNS, ACM |
| [6. Luồng telemetry](#6-telemetry-flow) | Metrics và logs từ cluster 1 sang cluster 2, chuỗi TLS |
| [7. Kiến trúc microservices](#7-shopnow-application) | Service, port, database, Keycloak, EFS, quy tắc spread và PDB |
| [8. GitOps và Deployment](#8-gitops-and-delivery) | Bốn repository đi tới AWS, ECR, ArgoCD và GitHub Pages như thế nào |
| [9. Terraform Layers](#9-terraform-layers) | Ba layer, state và phụ thuộc, thứ tự apply lần đầu |

## 1. Tổng quan {#1-overview}

[![Tổng quan](/img/architecture/01-overview.png)](/img/architecture/01-overview.png)

## 2. Network {#2-network}

[![Mạng](/img/architecture/02-network.png)](/img/architecture/02-network.png)

## 3. Cluster 1 · Workload {#3-cluster-1--workload}

[![Cluster 1](/img/architecture/03-cluster-1-workload.png)](/img/architecture/03-cluster-1-workload.png)

## 4. Node pool Karpenter {#4-karpenter-node-pools}

[![Node pool Karpenter](/img/architecture/04-karpenter-node-pools.png)](/img/architecture/04-karpenter-node-pools.png)

## 5. Cluster 2 · Observability {#5-cluster-2--observability}

[![Cluster 2](/img/architecture/05-cluster-2-observability.png)](/img/architecture/05-cluster-2-observability.png)

## 6. Luồng telemetry {#6-telemetry-flow}

[![Luồng telemetry](/img/architecture/06-telemetry-flow.png)](/img/architecture/06-telemetry-flow.png)

## 7. Kiến trúc microservices {#7-shopnow-application}

[![Kiến trúc microservices](/img/architecture/07-shopnow-application.png)](/img/architecture/07-shopnow-application.png)

## 8. GitOps và Deployment {#8-gitops-and-delivery}

[![GitOps và Deployment](/img/architecture/08-gitops-delivery.png)](/img/architecture/08-gitops-delivery.png)

## 9. Terraform Layers {#9-terraform-layers}

[![Terraform Layers](/img/architecture/09-terraform-layers.png)](/img/architecture/09-terraform-layers.png)

## Cập nhật sơ đồ {#updating-the-diagrams}

Script `diagrams/build.py` tạo file `.drawio` trong repo. Khi cập nhật qua script, chạy lại để tạo sơ đồ:

```bash
cd diagrams
python3 build.py                     # writes eks-core-architecture.drawio and copies it to static/diagrams/
drawio -x -f png -s 1.5 -b 16 --page-index 1 -o ../static/img/architecture/01-overview.png eks-core-architecture.drawio
```

Nếu chọn chỉnh trực tiếp bằng draw.io, giữ file đã chỉnh làm nguồn. Chạy lại script sẽ ghi đè các chỉnh sửa đó.

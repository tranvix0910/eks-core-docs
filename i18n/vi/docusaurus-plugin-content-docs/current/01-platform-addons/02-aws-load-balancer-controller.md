---
title: "AWS tải Balancer controller"
---

# Kiểm tra tải Balancer controller {#verify-load-balancing-before-exposing-services}

AWS tải Balancer controller theo dõi Service và Ingress để tạo load balancer trên AWS. Trong repo này, Terraform truyền `clusterName`, region và VPC ID vào chart. Khi kiểm tra, xem values của release đang chạy vì một số file mẫu có thể còn ID của môi trường cũ.

## 1. Kiểm tra controller và IAM {#1-check-the-controller-and-iam}

```bash
kubectl --context eks-workload -n kube-system get deployment aws-load-balancer-controller
kubectl --context eks-workload -n kube-system logs deployment/aws-load-balancer-controller --tail=80
aws eks list-pod-identity-associations --cluster-name eks-workload
helm --kube-context eks-workload -n kube-system get values aws-load-balancer-controller
```

Kiểm tra Pod Identity association đang trỏ tới đúng ServiceAccount `kube-system/aws-load-balancer-controller`. Release này dùng Pod Identity, nên khi gặp `AccessDenied` hãy kiểm tra association và IAM policy tương ứng.

## 2. Tạo Application Ingress qua ArgoCD {#2-create-application-ingress-through-argocd}

Chart backend tạo Ingress trong namespace `shopnow`, dùng group `eks-workload`, `target-type: ip` và listener riêng. ALB gửi request tới IP của Pod, vì vậy security group cần cho phép cổng container mà target sử dụng, không chỉ cổng của Service.

```bash
kubectl --context eks-workload -n shopnow get ingress
kubectl --context eks-workload -n shopnow describe ingress shopnow-api-gateway-ingress
kubectl --context eks-workload -n shopnow get endpointslices \
  -l kubernetes.io/service-name=shopnow-api-gateway-service
```

Nếu Ingress chưa có `ADDRESS`, kiểm tra Events và controller log. Nếu ALB đã có DNS nhưng trả `503`, kiểm tra target health, endpoint Ready và health check path.

## 3. Dùng chung ALB và giới hạn truy cập {#3-shared-alb-and-access-controls}

Các Ingress có cùng group name có thể dùng chung một ALB. Mỗi Ingress đều có thể thêm listener hoặc rule vào ALB đó, nên chỉ cấp quyền tạo Ingress trong group cho người quản lý phù hợp. Tách namespace không tách quyền cấu hình bên trong cùng IngressGroup.

Trong workshop, có thể dùng port-forward để truy cập UI/API. Khi dùng Public Ingress, đặt `inboundCidrs` theo IP hoặc VPN được phép trước khi apply. Với UI quản trị, không mở `0.0.0.0/0`.

## 4. ALB telemetry nội bộ {#4-internal-telemetry-alb}

Dùng group riêng `eks-observability-internal`, HTTPS listener 9009/3100, chứng chỉ ACM và node SG từ layer 20. Làm theo [bài TLS](03-cert-manager-and-internal-tls.md); không đưa ingress nội bộ vào group public.

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| `Evaluated 0 subnets` | VPC/region thực tế trong Helm values và subnet tag |
| `AccessDenied` | Pod Identity association, IAM action trong log, SCP |
| 503 | endpoint Ready, target health, đường SG đến gateway/Pod |
| 404 | Path, host của Ingress và route trong application controller |
| Lỗi TLS | Hostname trong SAN, region ACM, CA tin cậy trên client |

Đối chiếu Ingress đã render với ALB thực tế, rồi sửa từng nguyên nhân.

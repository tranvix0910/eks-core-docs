---
title: "AWS Load Balancer Controller"
---

# Kiểm tra Load Balancer Controller {#verify-load-balancing-before-exposing-services}

AWS Load Balancer Controller tạo Load Balancer từ Kubernetes Service/Ingress. Terraform truyền `clusterName`, region và VPC ID trực tiếp vào chart. Khi kiểm tra cấu hình, xem values của release đang chạy; một số file values mẫu còn chứa ID môi trường cũ.

## 1. Kiểm tra controller và IAM {#1-check-the-controller-and-iam}

```bash
kubectl --context eks-workload -n kube-system get deployment aws-load-balancer-controller
kubectl --context eks-workload -n kube-system logs deployment/aws-load-balancer-controller --tail=80
aws eks list-pod-identity-associations --cluster-name eks-workload
helm --kube-context eks-workload -n kube-system get values aws-load-balancer-controller
```

Pod Identity phải liên kết đúng ServiceAccount `kube-system/aws-load-balancer-controller`. Thêm annotation IRSA không phải cách xử lý chung cho lỗi AccessDenied.

## 2. Deploy Application Ingress qua ArgoCD {#2-create-application-ingress-through-argocd}

Backend chart tạo Ingress trong `shopnow`, dùng `target-type: ip`, group `eks-workload` và listener port riêng. ALB trỏ tới IP Pod; security group phải cho phép **cổng đích của container**, không chỉ cổng Service.

```bash
kubectl --context eks-workload -n shopnow get ingress
kubectl --context eks-workload -n shopnow describe ingress shopnow-api-gateway-ingress
kubectl --context eks-workload -n shopnow get endpointslices \
  -l kubernetes.io/service-name=shopnow-api-gateway-service
```

Nếu Ingress chưa có `ADDRESS`, kiểm tra Events và controller log. Nếu ALB đã có DNS nhưng trả `503`, kiểm tra Target Health, Endpoint Ready và Health Check Path.

## 3. Shared ALB và Access Control {#3-shared-alb-and-access-controls}

IngressGroup dùng chung một ALB để giảm số Load Balancer. Mỗi Ingress trong group đều có thể ảnh hưởng Listener và Rule, vì vậy giới hạn quyền tạo Ingress cho người vận hành phù hợp. Namespace không tách quyền quản lý bên trong cùng IngressGroup.

Trong workshop, có thể dùng Port-forward để truy cập UI/API. Khi dùng Public Ingress, đặt `inboundCidrs` theo IP hoặc VPN được phép trước khi Apply. Với UI quản trị, không mở `0.0.0.0/0`.

## 4. ALB telemetry nội bộ {#4-internal-telemetry-alb}

Dùng group riêng `eks-observability-internal`, HTTPS listener 9009/3100, chứng chỉ ACM và node SG từ Layer 20. Làm theo [bài TLS](03-cert-manager-and-internal-tls.md); không đưa ingress nội bộ vào group public.

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| `Evaluated 0 subnets` | VPC/region thực tế trong Helm values và subnet tag |
| `AccessDenied` | Pod Identity association, IAM action trong log, SCP |
| 503 | Endpoint Ready, target health, đường SG đến gateway/Pod |
| 404 | Path, host của Ingress và route trong application controller |
| Lỗi TLS | Hostname trong SAN, region ACM, CA tin cậy trên client |

Đối chiếu Ingress đã render với ALB thực tế, rồi sửa từng nguyên nhân.

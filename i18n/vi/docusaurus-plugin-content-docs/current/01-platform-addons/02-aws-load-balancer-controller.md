---
title: "Load Balancer Controller: định tuyến tới ứng dụng"
---

# Kiểm chứng load balancing trước khi công khai service {#verify-load-balancing-before-exposing-services}

LBC chuyển Service/Ingress thành load balancer AWS. Terraform hiện truyền `clusterName`, region và VPC ID trực tiếp vào chart. Các tệp values riêng chứa ID môi trường cũ không phải cấu hình thực tế của release này.

## 1. Kiểm tra controller và IAM {#1-check-the-controller-and-iam}

```bash
kubectl --context eks-workload -n kube-system get deployment aws-load-balancer-controller
kubectl --context eks-workload -n kube-system logs deployment/aws-load-balancer-controller --tail=80
aws eks list-pod-identity-associations --cluster-name eks-workload
helm --kube-context eks-workload -n kube-system get values aws-load-balancer-controller
```

Pod Identity phải liên kết đúng ServiceAccount `kube-system/aws-load-balancer-controller`. Thêm annotation IRSA không phải cách xử lý chung cho lỗi AccessDenied.

## 2. Tạo application ingress qua ArgoCD {#2-create-application-ingress-through-argocd}

Backend chart tạo Ingress trong `shopnow`, dùng `target-type: ip`, group `eks-workload` và listener port riêng. ALB trỏ tới IP Pod; security group phải cho phép **cổng đích của container**, không chỉ cổng Service.

```bash
kubectl --context eks-workload -n shopnow get ingress
kubectl --context eks-workload -n shopnow describe ingress shopnow-api-gateway-ingress
kubectl --context eks-workload -n shopnow get endpointslices \
  -l kubernetes.io/service-name=shopnow-api-gateway-service
```

Nếu `ADDRESS` trống, xem Events và controller log trước. Nếu có DNS nhưng request trả 503, kiểm tra target health, endpoint Ready và đường dẫn health check.

## 3. ALB dùng chung và kiểm soát truy cập {#3-shared-alb-and-access-controls}

Group dùng chung giảm số ALB, nhưng mọi ingress tham gia đều ảnh hưởng listener/rule. Chỉ cho phép người vận hành tin cậy tạo ingress trong group này. Namespace không phải ranh giới bảo mật của IngressGroup.

Bài cốt lõi có thể dùng port-forward để truy cập UI/API. Với public ingress, đặt `inboundCidrs` thành dải IP/VPN được lớp học cho phép trước khi triển khai. Không giữ `0.0.0.0/0` cho công cụ quản trị.

## 4. ALB telemetry nội bộ {#4-internal-telemetry-alb}

Dùng group riêng `eks-observability-internal`, HTTPS listener 9009/3100, chứng chỉ ACM và node SG từ lớp 20. Làm theo [bài TLS](03-cert-manager-and-internal-tls.md); không đưa ingress nội bộ vào group public.

| Triệu chứng | Kiểm tra đầu tiên |
|---|---|
| `Evaluated 0 subnets` | VPC/region thực tế trong Helm values và subnet tag |
| `AccessDenied` | Pod Identity association, IAM action trong log, SCP |
| 503 | Endpoint Ready, target health, đường SG đến gateway/Pod |
| 404 | Path, host của Ingress và route trong application controller |
| Lỗi TLS | Hostname trong SAN, region ACM, CA tin cậy trên client |

So sánh cấu hình render với AWS trước khi sửa nhiều annotation cùng lúc.

---
title: "Bước 2.5 — Kite dashboard"
sidebar_label: "2.5 Kite dashboard"
---

# Bước 2.5 — Kite dashboard {#step-25--kite-dashboard}

:::info Tóm tắt bước thực hành
**Mục tiêu:** một dashboard web cho cluster 1 — workload, logs, event, mức dùng tài nguyên và terminal ngay trên trình duyệt — chạy trên node group infra.
**Thời gian:** khoảng 15 phút. **Chạy từ:** `$GITOPS_DIR` (và `$TF_DIR` khi cần thay đổi).
:::

## Kite là gì và được cài như thế nào {#what-kite-is-and-how-it-is-installed}

[Kite](https://github.com/kite-org/kite) là một dashboard Kubernetes gọn nhẹ: xem mọi resource, đọc log Pod, mở shell vào container và xem CPU, memory lấy từ Prometheus. Đây là công cụ tiện ích cho người vận hành; ArgoCD, Karpenter và hệ thống observability không phụ thuộc vào nó.

Terraform cài Kite ở **layer 20** (`20-cluster-workload/helm_releases.tf`) trong lần apply đầy đủ ở [bước 1.3](../architecture/layer-21-cluster-observability#6-finish-cluster-1). Bạn không cần tự chạy `helm install`.

| Thiết lập | Giá trị | Lý do |
|---|---|---|
| Chart | `oci://ghcr.io/kite-org/charts/kite` phiên bản `0.15.0` | Ghim phiên bản như mọi release khác |
| Namespace | `kite-system` | Do Terraform tạo |
| Replica / strategy | 1 / `Recreate` | SQLite chỉ cho một tiến trình ghi; `Recreate` dừng Pod cũ trước khi Pod mới gắn volume |
| Database | SQLite trên PVC `gp3` 5 GiB | User và cấu hình còn nguyên khi Pod khởi động lại |
| Secret | Secret `kite` với `JWT_SECRET` và `KITE_ENCRYPT_KEY` ngẫu nhiên (64 ký tự) | Thay cho encryption key mặc định của chart |
| Vị trí chạy | `nodeSelector: role=infra` | Là công cụ nền tảng nên chạy trên Managed Node Group |
| Tài nguyên | request 250m CPU / 256 MiB, limit 512 MiB | — |
| Service | `kite`, ClusterIP, port `8080` | Health check tại `/healthz` |
| Ingress | tắt trong chart | Mở riêng ở mục 4 nếu bạn cần |
| Quyền Kubernetes | ServiceAccount gắn ClusterRole có **mọi verb trên mọi resource** | Mặc định của chart; xem mục 5 để thu hẹp |

## 1. Kiểm tra cài đặt {#1-check-the-installation}

```bash
helm --kube-context eks-workload list -n kite-system
kubectl --context eks-workload -n kite-system get pods,svc,pvc -o wide
kubectl --context eks-workload -n kite-system get pod -l app.kubernetes.io/name=kite \
  -o jsonpath='{.items[0].spec.nodeName}' | xargs -I{} kubectl --context eks-workload get node {} -L role
```

**Kết quả mong đợi:** release `kite` ở trạng thái `deployed`, một Pod `Running` và `1/1` Ready, Service `kite` trên port `8080`, PVC `Bound`, và node của Pod có `role=infra`.

## 2. Mở Kite bằng port-forward {#2-open-kite-with-port-forward}

Port-forward không cần load balancer và không mở gì ra ngoài. Hãy dùng cách này làm mặc định.

```bash
kubectl --context eks-workload -n kite-system port-forward svc/kite 8088:8080
```

Mở http://localhost:8088.

## 3. Đăng nhập lần đầu {#3-first-sign-in}

Lần đầu mở, Kite chưa có user nào:

1. Tạo tài khoản **quản trị** đầu tiên. Dùng mật khẩu mạnh; tài khoản này làm được mọi thứ trong cluster.
2. Thêm cluster mà Kite sẽ quản lý và chọn **in-cluster**. Kite sẽ dùng ServiceAccount của chính nó; không cần tải kubeconfig lên.
3. Đặt Prometheus URL cho biểu đồ tài nguyên: `http://prometheus-kube-prometheus-prometheus.monitoring.svc:9090`.

User và cấu hình được lưu trong SQLite trên PVC, nên vẫn còn sau khi khởi động lại hoặc nâng cấp.

## Kiểm tra {#verify}

- Màn hình workload liệt kê các namespace `argocd`, `monitoring`, `shopnow`, `kite-system`.
- Mở một Pod ShopNow: log chạy liên tục, biểu đồ CPU và memory có dữ liệu từ Prometheus.
- `kubectl --context eks-workload -n kite-system logs deploy/kite --tail=20` không có lỗi.

## 4. Tùy chọn — truy cập Kite qua ALB quản trị dùng chung {#4-optional--reach-kite-through-the-shared-admin-alb}

Workshop không có tên miền DNS, nên các công cụ được truy cập bằng **hostname của chính ALB** và phân biệt bằng port, giống ArgoCD (`:80`), Prometheus (`:9090`), Alertmanager (`:9093`), JavaMelody (`:8081`) và Grafana (`:3000`). Kite dùng port **8088** trên cùng ALB group `eks-workload`, từ file `platform/ingress/kite-ingress.yaml`.

Khác với các công cụ trên, Kite **không** mở cho `0.0.0.0/0`: nó sửa được mọi resource và mở shell vào container. Manifest chứa placeholder `<ADMIN_CIDR>`, bạn điền địa chỉ của mình khi apply:

```bash
cd "$GITOPS_DIR"
export ADMIN_CIDR="$(curl -s -4 ifconfig.me)/32"
sed "s|<ADMIN_CIDR>|$ADMIN_CIDR|" platform/ingress/kite-ingress.yaml \
  | kubectl --context eks-workload apply -f -
kubectl --context eks-workload -n kite-system get ingress kite -w     # wait for ADDRESS, then Ctrl+C
```

```bash
echo "http://$(kubectl --context eks-workload -n kite-system get ingress kite \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'):8088"
```

Mở URL đó và đăng nhập.

| Kiểm tra | Kết quả mong đợi |
|---|---|
| Trang mở được từ mạng của bạn | có |
| Mở từ mạng khác | bị từ chối hoặc timeout (chặn bởi `inbound-cidrs`) |
| Sau khi đăng nhập, chuyển sang trang khác vẫn giữ phiên | có |

Nếu đăng nhập thành công nhưng sang trang tiếp theo lại bị đưa về màn hình đăng nhập hoặc nhận `401`, nghĩa là cookie phiên có cờ `Secure` và trình duyệt không gửi nó qua HTTP thường — đúng vấn đề Rancher từng gặp trên ALB này. Khi đó hãy xoá Ingress và tiếp tục dùng port-forward:

```bash
kubectl --context eks-workload -n kite-system delete ingress kite
```

Khi IP công khai của bạn thay đổi, apply lại manifest với `ADMIN_CIDR` mới. Kết nối là HTTP thường: hostname của ALB không phải tên miền của bạn nên không cấp được chứng chỉ. Hãy coi listener này là tiện ích cho lab, không phải cấu hình production.

## 5. Tăng cường bảo mật (khuyến nghị ngoài môi trường lab) {#5-hardening-recommended-outside-a-lab}

| Rủi ro | Thay đổi |
|---|---|
| Quyền ghi trên toàn cluster | Thu hẹp `rbac.rules` của chart (bên dưới) và dùng role của Kite cho từng user |
| Mật khẩu và phiên đi qua HTTP | Ưu tiên port-forward, hoặc đặt ALB sau một tên miền có chứng chỉ ACM |
| Chỉ một tài khoản quản trị | Tạo user riêng trong Kite thay vì dùng chung tài khoản đầu tiên |
| Mất dữ liệu | Backup PVC (EBS snapshot) trước khi nâng cấp |

Quyền Kubernetes chỉ đọc cho Kite — sửa values của `helm_release "kite"` trong `$TF_DIR/20-cluster-workload/helm_releases.tf`:

```hcl
    rbac = {
      create = true
      rules = [{
        apiGroups = ["*"]
        resources = ["*"]
        verbs     = ["get", "list", "watch"]
      }]
    }
```

Sau đó plan và apply layer 20 như bình thường. Với quyền chỉ đọc, các thao tác terminal, sửa và xoá trong Kite sẽ không hoạt động; đó chính là mục đích.

## Cài Kite không dùng Terraform {#installing-kite-without-terraform}

Trên một cluster không do các layer này quản lý, cấu hình tương đương bằng Helm là:

```bash
kubectl create namespace kite-system
kubectl -n kite-system create secret generic kite \
  --from-literal=JWT_SECRET="$(openssl rand -hex 32)" \
  --from-literal=KITE_ENCRYPT_KEY="$(openssl rand -hex 32)" \
  --from-literal=DB_TYPE=sqlite

cat > kite-values.yaml <<'VALUES'
replicaCount: 1
deploymentStrategy: { type: Recreate }
secret: { create: false, existingSecret: kite }
db:
  type: sqlite
  sqlite:
    persistence:
      pvc: { enabled: true, storageClass: gp3, accessModes: [ReadWriteOnce], size: 5Gi }
nodeSelector: { role: infra }
resources:
  requests: { cpu: 250m, memory: 256Mi }
  limits: { memory: 512Mi }
ingress: { enabled: false }
VALUES

helm upgrade --install kite oci://ghcr.io/kite-org/charts/kite --version 0.15.0 \
  -n kite-system -f kite-values.yaml --wait
```

Trong workshop này Terraform quản lý release: đừng chạy thêm lệnh Helm trên `eks-workload`, nếu không hai bên sẽ ghi đè lẫn nhau.

## Xử lý sự cố {#troubleshooting}

| Triệu chứng | Kiểm tra |
|---|---|
| Pod `Pending` | PVC đã `Bound` chưa? StorageClass `gp3` có tồn tại; node infra còn chỗ (`kubectl describe pod`) |
| Pod khởi động lại liên tục | `kubectl -n kite-system logs deploy/kite --previous`; Secret `kite` có `JWT_SECRET` và `KITE_ENCRYPT_KEY` |
| Ingress không có ADDRESS | Log của Load Balancer Controller: `kubectl -n kube-system logs deploy/aws-load-balancer-controller` |
| Target của ALB unhealthy | Health check path `/healthz`; Pod đã Ready |
| Biểu đồ tài nguyên trống | Prometheus URL trong phần cấu hình cluster của Kite |

## Gỡ Kite {#remove-kite}

Xoá Ingress nếu đã tạo, rồi bỏ các resource `kite` (`kubernetes_namespace_v1.kite`, `random_password.kite_*`, `kubernetes_secret_v1.kite`, `helm_release.kite`) khỏi layer 20 và apply. Xoá namespace cũng xoá luôn PVC và dữ liệu của Kite.

**Tiếp theo:** [3.1 Build image](../apps-shopnow/docker-build-multi-arch-and-ci)

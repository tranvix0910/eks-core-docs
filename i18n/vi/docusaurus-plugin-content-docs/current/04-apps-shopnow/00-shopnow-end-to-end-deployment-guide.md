---
title: "Bước 3.2 — Deploy ShopNow với ArgoCD"
sidebar_label: "3.2 Deploy với ArgoCD"
---

# Bước 3.2 — Deploy ShopNow với ArgoCD {#step-32--deploy-the-microservices-with-argocd}

:::info Nội dung thực hiện
**Mục tiêu:** Deploy ShopNow lên Mixed Pool và quản lý các service qua ArgoCD.
**Yêu cầu:** 3 (microservices trên pool 2), 7 (ArgoCD). **Thời gian:** khoảng 30 phút. **Chạy từ:** `$GITOPS_DIR`.
:::

## Cấu trúc ArgoCD Application {#how-a-service-gets-deployed}

```mermaid
flowchart LR
  subgraph Git["eks-core-gitops"]
    Chart["apps/…-chart<br/>Helm chart"]
    Over["apps/…-config/overlays/production<br/>service values"]
    WS["examples/workshop/workload-values.yaml<br/>workshop values"]
  end
  Render["prepare-applications.sh<br/>(image repo + tag)"] --> AppYaml["ArgoCD Application"]
  AppYaml --> Argo[ArgoCD]
  Chart --> Argo
  Over --> Argo
  WS --> Argo
  Argo -- "helm template + apply,<br/>auto-sync, self-heal" --> K8s["namespace shopnow<br/>on pool 2"]
```

Mỗi service dùng một ArgoCD **Application**. Application render Helm Chart với 3 file values theo thứ tự; file cuối `workload-values.yaml` cấu hình Mixed Pool, EFS, Pod Placement và PDB cho 6 backend:

```yaml
replicaCount: 2
persistence:            # requirement 4 — EFS volume at /data
  enabled: true
  storageClass: efs-sc
  size: 5Gi
  mountPath: /data
nodeSelector:           # requirement 3 — run on pool 2
  workload: microservices
tolerations:
  - key: workload
    operator: Equal
    value: microservices
    effect: NoSchedule
podDisruptionBudget:    # requirement 6
  enabled: true
  maxUnavailable: 1
```

Discovery Server dùng thêm `discovery-values.yaml` với 1 replica và không có PDB. Eureka trong workshop chưa cấu hình Peer Replication.

Application bật Auto Sync, `prune` và `selfHeal`. Để cập nhật service, sửa cấu hình trong Git rồi Sync; thay đổi trực tiếp bằng `kubectl` có thể bị ArgoCD ghi đè.

## 1. Tạo AppProject {#1-create-the-appproject}

```bash
kubectl --context eks-workload apply -f "$GITOPS_DIR/platform/addons/argocd/appproject-shopnow.yaml"
```

AppProject `shopnow` giới hạn Application Deploy vào namespace `shopnow`.

## 2. Render Application {#2-render-the-applications}

Script tạo Application Manifest từ Git URL, revision, ECR Repository và Image Tag của bạn. Bước này chỉ render file; Apply ở bước tiếp theo.

```bash
cd "$GITOPS_DIR"
bash examples/workshop/prepare-applications.sh
ls .workshop/applications
```

**Kết quả cần có:** chín file — `shopnow-database-services`, `discovery-server`, `config-server`, `product-service`, `cart-service`, `user-service`, `api-gateway`, `frontend` và `workshop-proof.json`.

## 3. Đăng nhập ArgoCD {#3-log-in-to-argocd}

Trong terminal riêng: `kubectl --context eks-workload -n argocd port-forward svc/argocd-server 8080:80`

```bash
argocd login localhost:8080 --plaintext --username admin \
  --password "$(kubectl --context eks-workload -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 --decode)"
```

## 4. Deploy theo thứ tự {#4-deploy-in-dependency-order}

Deploy Database trước, tiếp theo Discovery Server, Config Server và các service. Chờ mỗi nhóm `Healthy` rồi mới tiếp tục.

```bash
A=.workshop/applications
deploy() { for app in "$@"; do kubectl --context eks-workload apply -f "$A/$app.yaml"; done
           for app in "$@"; do argocd app wait "$app" --sync --health --timeout 900; done; }

deploy shopnow-database-services                         # PostgreSQL, MySQL, Keycloak
deploy shopnow-discovery-server shopnow-config-server    # Eureka, Spring Cloud Config
deploy shopnow-product-service shopnow-cart-service shopnow-user-service shopnow-api-gateway
deploy shopnow-frontend
```

Khi backend bắt đầu chạy, theo dõi Karpenter cấp node cho Mixed Pool:

```bash
kubectl --context eks-workload get nodeclaims -w
```

Frontend là Argo Rollout blue-green, promote thủ công; lần triển khai đầu tiên chuyển Healthy trực tiếp. Các lần cập nhật sau chờ promote ([blue-green](blue-green-argo-rollouts)).

## Kiểm tra ArgoCD Application {#verify--argocd-requirement-7}

```bash
argocd app list -p shopnow | tee "$EVIDENCE_DIR/argocd-apps.txt"
```

**Kết quả cần có:** mọi Application `Synced` và `Healthy`, trỏ tới đúng repo và revision của bạn.

## Kiểm tra Microservices trên Mixed Pool {#verify--microservices-on-pool-2-requirement-3}

```bash
kubectl --context eks-workload -n shopnow get pods -o json | jq -r '.items[]
  | select(.metadata.labels.app // "" | test("service|gateway|server"))
  | [.metadata.name, .spec.nodeName] | @tsv' \
| while IFS=$'\t' read -r pod node; do
    printf '%-60s %s\n' "$pod" "$(kubectl --context eks-workload get node "$node" \
      -o jsonpath='{.metadata.labels.karpenter\.sh/nodepool}/{.metadata.labels.karpenter\.sh/capacity-type}')"
  done | tee "$EVIDENCE_DIR/pool2-placement.txt"
```

**Kết quả cần có:** mọi backend Pod hiển thị `ms-od/on-demand` hoặc `ms-spot/spot`. Không Pod nào chạy trên node `infra`, `batch-spot` hoặc `arm64`.

## Kiểm tra ShopNow {#verify--the-application-works}

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-api-gateway-service 5860:5860   # terminal 1
curl -fsS http://localhost:5860/product                                                           # terminal 2
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-frontend-service 8082:80          # terminal 3
```

`/product` trả JSON; danh sách rỗng `[]` là bình thường với database mới. Mở http://localhost:8082 để xem cửa hàng.

| Triệu chứng | Kiểm tra |
|---|---|
| `ImagePullBackOff` | Image tag trong Application (`argocd app manifests <app> \| grep image:`); tag tồn tại trong ECR |
| Pod `Pending`, không có NodeClaim | Selector/toleration Pod so với label pool 2; log Karpenter |
| Backend `CrashLoopBackOff` khi khởi động | Database hoặc Eureka chưa sẵn sàng; `kubectl -n shopnow logs <pod>` |
| Application liên tục `OutOfSync` | `argocd app diff <app>`; loại tài nguyên không được AppProject cho phép |
| PVC `Pending` | Phần xử lý sự cố [bước 3.3](efs-persistent-volumes) |

## Cập nhật Service {#changing-a-service-later}

1. Sửa chart hoặc values trong fork `eks-core-gitops`, commit và push.
2. ArgoCD phát hiện commit và sync, hoặc chạy `argocd app sync <app>`.
3. Với image mới: build lại bằng `IMAGE_TAG` mới, chạy lại `prepare-applications.sh` và apply file Application thay đổi.

Để Rollback, `git revert` commit rồi Push; Auto Sync sẽ áp dụng lại cấu hình trước đó. Khi bật Auto Sync, `argocd app rollback` không được phép. Dùng `argocd app history <app>` để xem Deployment History.

**Tiếp theo:** [3.3 Persistent volume EFS](efs-persistent-volumes)

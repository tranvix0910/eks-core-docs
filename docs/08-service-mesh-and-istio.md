# Service Mesh & Istio — Nghiên cứu và Lộ trình Áp dụng cho EKS Core Platform

> Tài liệu nghiên cứu (research deep-dive), cập nhật tháng 09/2026.
> Mục tiêu: hiểu **bản chất** service mesh, hiểu **Istio** đủ sâu để ra quyết định kiến trúc,
> và trả lời câu hỏi thực tế: *platform này (2 cluster EKS 1.34 + ShopNow Spring Cloud) có nên dùng Istio không, và nếu có thì đi thế nào?*

---

## 1. Service Mesh giải quyết vấn đề gì?

### 1.1 — Bài toán gốc: logic mạng bị nhét vào application code

Trong kiến trúc microservices, mỗi service phải tự lo một tập "network concerns" lặp đi lặp lại:

| Concern | Nếu không có mesh, ai làm? |
|---|---|
| Service discovery | Eureka client (ShopNow đang dùng `shopnow-discovery-server`) |
| Client-side load balancing | Spring Cloud LoadBalancer / Ribbon trong từng service |
| Retry, timeout, backoff | Resilience4j / cấu hình rải rác trong từng app |
| Circuit breaking | Resilience4j / Hystrix |
| mTLS giữa các service | Tự cấu hình keystore/truststore trong JVM |
| Distributed tracing | Micrometer Tracing / OpenTelemetry SDK nhúng vào app |
| Traffic splitting (canary) | Không có — phải dựa vào Service/Ingress |
| Authorization service-to-service | Tự viết filter/interceptor |

Vấn đề của cách tiếp cận này:

1. **Trùng lặp theo ngôn ngữ.** Toàn bộ logic trên tồn tại dưới dạng **library**. ShopNow toàn Java/Spring nên còn may. Thêm một service Go hoặc Node.js là phải viết lại toàn bộ stack đó, và phải giữ hành vi *giống hệt* (cùng retry policy, cùng format tracing header).
2. **Nâng cấp là một chiến dịch.** Sửa timeout policy toàn hệ thống = bump version library + rebuild + redeploy 6 service.
3. **Không quan sát được thống nhất.** Mỗi service báo cáo metric theo cách riêng; không có "sự thật chung" về golden signals.
4. **Bảo mật phụ thuộc thiện chí của dev.** Không có gì ép service A phải dùng TLS khi gọi service B.

### 1.2 — Ý tưởng cốt lõi: kéo logic mạng xuống infrastructure layer

Service mesh **trích xuất** toàn bộ các concern trên ra khỏi application, đặt vào một lớp proxy nằm ngoài process của app. App chỉ còn gọi `http://product-service:8080` một cách "ngây thơ"; proxy chặn traffic và áp dụng policy.

```
KHÔNG CÓ MESH                          CÓ MESH (sidecar)
┌──────────────────┐                   ┌──────────────────────────────┐
│ cart-service     │                   │ Pod: cart-service            │
│  ├ Eureka client │                   │  ┌────────┐   ┌────────────┐ │
│  ├ Ribbon LB     │──── HTTP ───▶     │  │ app    │──▶│ Envoy      │ │──mTLS──▶
│  ├ Resilience4j  │                   │  │ (plain │   │ (sidecar)  │ │
│  └ Tracing SDK   │                   │  │  HTTP) │   │ LB/retry/  │ │
└──────────────────┘                   │  └────────┘   │ mTLS/trace │ │
                                       │               └────────────┘ │
                                       └──────────────────────────────┘
```

Điều đổi lại: **bạn đánh đổi độ phức tạp của application lấy độ phức tạp của platform.** Đây là câu quan trọng nhất trong tài liệu này. Service mesh không xoá bỏ độ phức tạp, nó **di chuyển** độ phức tạp sang chỗ mà một đội platform (chính là bạn) có thể quản lý tập trung.

### 1.3 — Ba trụ cột giá trị

| Trụ cột | Nội dung |
|---|---|
| **Traffic Management** | Canary/weighted routing, mirroring (shadow traffic), retry/timeout, circuit breaking, fault injection, locality-aware routing (ưu tiên AZ gần) |
| **Security** | mTLS tự động giữa mọi pod, workload identity theo chuẩn SPIFFE, authorization policy L4/L7, xoay vòng cert tự động |
| **Observability** | Golden signals (latency/traffic/error/saturation) đồng nhất cho **mọi** service mà không sửa code, access log chuẩn hoá, distributed tracing spans ở tầng mạng |

---

## 2. Kiến trúc chung của một Service Mesh

### 2.1 — Data Plane vs Control Plane

```
                    ┌──────────────────────────────────────┐
                    │        CONTROL PLANE (istiod)        │
                    │  - Đọc K8s API (Service, Endpoint,   │
                    │    Pod, CRD của Istio)               │
                    │  - Biên dịch thành cấu hình Envoy    │
                    │  - Phát hành certificate (CA)        │
                    └──────────────┬───────────────────────┘
                                   │ xDS (gRPC, push-based)
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
        ┌──────────┐         ┌──────────┐         ┌──────────┐
        │ Envoy    │◀──mTLS──│ Envoy    │◀──mTLS──│ Envoy    │   DATA PLANE
        │ product  │         │ cart     │         │ user     │
        └──────────┘         └──────────┘         └──────────┘
```

* **Data plane** = tập các proxy thực sự chạm vào từng gói tin. Chúng nằm trên đường đi của request, nên **lỗi ở đây là lỗi production ngay lập tức**.
* **Control plane** = bộ não, không nằm trên đường đi của request. Control plane chết thì mesh vẫn chạy tiếp với cấu hình cuối cùng đã push (đây là thiết kế cố ý — "fail static"), chỉ là không cập nhật được endpoint mới và không cấp được cert mới.

Hệ quả vận hành quan trọng: **downtime của istiod không đồng nghĩa với downtime của ứng dụng**, nhưng nếu istiod chết đủ lâu (quá thời hạn cert 24h mặc định) thì mTLS sẽ bắt đầu fail. Đây là một trong những sự cố kinh điển của Istio.

### 2.2 — Cơ chế chặn traffic (traffic interception)

Đây là phần "ma thuật" mà nhiều người dùng Istio không hiểu và sau đó không debug nổi.

Với **sidecar mode**, khi pod khởi động:

1. Một **init container** (`istio-init`) hoặc **istio-cni plugin** chạy trước, ghi các luật `iptables` trong network namespace của pod.
2. Luật `iptables` redirect:
   * **Outbound**: mọi traffic đi ra từ app → chuyển vào port `15001` của Envoy.
   * **Inbound**: mọi traffic đi vào pod → chuyển vào port `15006` của Envoy.
3. Envoy sidecar (`istio-proxy`) khởi động, kết nối tới istiod qua xDS, nhận cấu hình.
4. App container khởi động và gọi `http://product-service:8080` như bình thường — nhưng gói tin bị iptables bẻ hướng vào Envoy.

Các port cần thuộc lòng khi debug:

| Port | Vai trò |
|---|---|
| `15001` | Outbound capture (từ app ra ngoài) |
| `15006` | Inbound capture (từ ngoài vào app) |
| `15008` | HBONE tunnel (mTLS, dùng trong ambient mode và sidecar hiện đại) |
| `15020` | Merged metrics + health check của agent |
| `15021` | Health check endpoint (`/healthz/ready`) — ALB/NLB health check phải trỏ vào đây khi có sidecar |
| `15090` | Envoy Prometheus metrics thô |
| `15000` | Envoy admin (chỉ localhost) — dùng `istioctl proxy-config` để đọc |

> **Cảnh báo cho platform này:** ShopNow đang expose qua AWS Load Balancer Controller với `target-type: ip`. Khi bật sidecar, ALB bắn thẳng vào Pod IP, gói tin bị `iptables` bắt vào port `15006`. Nếu health check của Target Group vẫn trỏ vào port ứng dụng trong lúc Envoy chưa ready, target sẽ bị đánh unhealthy. Phải bật `holdApplicationUntilProxyStarts` và cân nhắc trỏ health check sang `15021`.

### 2.3 — Sự phụ thuộc vào thứ tự khởi động (race condition kinh điển)

Vấn đề nổi tiếng nhất của sidecar mode: **app container khởi động trước khi Envoy sẵn sàng** → mọi kết nối outbound trong vài giây đầu bị từ chối.

Với ShopNow điều này rất nghiêm trọng vì:
* `shopnow-config-server` được gọi ngay khi các service Spring Boot khởi động (fetch config).
* `shopnow-discovery-server` (Eureka) được đăng ký ngay lúc bootstrap.

Nếu Envoy chưa lên, các service sẽ crash-loop lúc khởi động. Giải pháp:
* `values.global.proxy.holdApplicationUntilProxyStarts: true` (Istio dùng `postStart` hook chặn app cho tới khi Envoy ready).
* Từ Kubernetes 1.28+ (bạn đang chạy 1.34) Istio hỗ trợ **native sidecar** qua `initContainers` với `restartPolicy: Always` — đây là cách sạch nhất, giải quyết triệt để cả vấn đề khởi động lẫn vấn đề **Job/CronJob không bao giờ kết thúc** vì sidecar không chịu chết.

---

## 3. Istio — Kiến trúc chi tiết

### 3.1 — Các thành phần

| Thành phần | Vai trò |
|---|---|
| **istiod** | Control plane hợp nhất. Gồm 3 chức năng cũ: Pilot (config → xDS), Citadel (CA cấp cert), Galley (validation/webhook). Chạy như một Deployment. |
| **istio-proxy (Envoy)** | Data plane sidecar. Envoy + `pilot-agent` (bootstrap, quản lý cert, expose metrics ở 15020). |
| **istio-cni** | Node agent (DaemonSet) ghi luật iptables trong network namespace của pod, thay cho init container có `NET_ADMIN`. Bắt buộc cho ambient mode. |
| **ztunnel** | (Ambient) L4 proxy per-node viết bằng Rust. Làm mTLS + L4 authz + TCP telemetry. |
| **waypoint** | (Ambient) Envoy proxy per-namespace/per-service, tuỳ chọn, chỉ khi cần tính năng L7. |
| **Ingress/Egress Gateway** | Envoy standalone ở biên mesh, không gắn vào pod nào. Ingress gateway là thứ thay thế/bổ sung cho Ingress Controller. |

### 3.2 — xDS: cách cấu hình chảy xuống proxy

istiod dịch object Kubernetes + CRD Istio thành 4 loại tài nguyên Envoy:

| xDS | Nội dung | Lệnh kiểm tra |
|---|---|---|
| **LDS** (Listener) | Proxy lắng nghe ở port nào, filter chain gì | `istioctl proxy-config listener <pod>` |
| **RDS** (Route) | Với HTTP, request khớp host/path nào thì đi cluster nào | `istioctl proxy-config route <pod>` |
| **CDS** (Cluster) | Định nghĩa upstream (một service + subset), policy LB, circuit breaker | `istioctl proxy-config cluster <pod>` |
| **EDS** (Endpoint) | Danh sách IP:port thực tế của các pod backend | `istioctl proxy-config endpoint <pod>` |

**Quy trình debug chuẩn khi "routing không đúng":** đi từ Listener → Route → Cluster → Endpoint. 90% sự cố Istio được tìm ra bằng đúng 4 lệnh này cộng với `istioctl analyze`.

### 3.3 — Mô hình bảo mật: SPIFFE identity + mTLS

Istio cấp cho mỗi workload một danh tính theo chuẩn **SPIFFE**:

```
spiffe://cluster.local/ns/shopnow/sa/shopnow-cart-service
         └── trust domain ──┘ └─ns─┘ └────ServiceAccount────┘
```

Điểm mấu chốt: **danh tính gắn với ServiceAccount, không gắn với Pod IP hay Namespace label.** Điều này khác hoàn toàn NetworkPolicy (dựa trên IP/label, có thể bị giả mạo nếu attacker chiếm được node).

Luồng cấp cert:
1. `pilot-agent` trong sidecar tạo private key + CSR **ngay trong pod** (private key không bao giờ rời pod).
2. Gửi CSR tới istiod kèm **ServiceAccount token** (projected token, audience `istio-ca`).
3. istiod validate token với K8s TokenReview API → xác nhận đây đúng là SA đó.
4. istiod ký cert (mặc định TTL 24h), trả về qua SDS (Secret Discovery Service).
5. Agent tự động renew ở ~50% TTL.

So sánh với `cert-manager` mà platform đang dùng: cert-manager giải bài toán **cert cho ingress/ALB (north-south, có tên miền, cần trust từ bên ngoài)**. Istio CA giải bài toán **cert cho service-to-service (east-west, danh tính máy, xoay vòng mỗi 24h)**. Hai thứ này **không thay thế nhau** — chúng cùng tồn tại.

### 3.4 — Các API (CRD) chính

#### Nhóm Traffic Management

```yaml
# VirtualService — "request khớp điều kiện nào thì đi đâu"
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: shopnow-product
  namespace: shopnow
spec:
  hosts: [shopnow-product-service]
  http:
  - match:
    - headers:
        x-canary: {exact: "true"}      # header-based routing
    route:
    - destination: {host: shopnow-product-service, subset: v2}
  - route:                              # default: 90/10 weighted split
    - destination: {host: shopnow-product-service, subset: v1}
      weight: 90
    - destination: {host: shopnow-product-service, subset: v2}
      weight: 10
    timeout: 3s
    retries:
      attempts: 3
      perTryTimeout: 1s
      retryOn: 5xx,reset,connect-failure
```

```yaml
# DestinationRule — "sau khi đã chọn được destination, ứng xử thế nào"
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: shopnow-product
  namespace: shopnow
spec:
  host: shopnow-product-service
  trafficPolicy:
    loadBalancer: {simple: LEAST_REQUEST}
    connectionPool:
      tcp: {maxConnections: 100}
      http: {http2MaxRequests: 1000, maxRequestsPerConnection: 10}
    outlierDetection:                   # đây chính là circuit breaking
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
  subsets:                              # định nghĩa v1/v2 dựa trên pod label
  - name: v1
    labels: {version: v1}
  - name: v2
    labels: {version: v2}
```

**Sai lầm phổ biến số 1:** khai báo `subset` trong VirtualService nhưng quên tạo DestinationRule tương ứng → toàn bộ traffic trả `503 NR` (no route). `istioctl analyze` bắt được lỗi này.

| CRD khác | Công dụng |
|---|---|
| `Gateway` | Cấu hình Envoy ở biên (ingress/egress): port, protocol, TLS cert, host nào được nhận |
| `ServiceEntry` | Đăng ký service **ngoài** cluster vào registry của mesh (VD: RDS, ElastiCache, API bên thứ ba) để áp policy lên traffic đi ra |
| `Sidecar` | **Giới hạn phạm vi** cấu hình đẩy xuống mỗi sidecar. Cực kỳ quan trọng khi scale — xem §7.4 |
| `WorkloadEntry` | Đưa VM/bare-metal vào mesh |
| `EnvoyFilter` | "Cửa thoát hiểm" sửa trực tiếp config Envoy. **Tránh dùng** — dễ vỡ khi upgrade, Istio đang chủ động thay bằng first-class API |

#### Nhóm Security

```yaml
# PeerAuthentication — bắt buộc mTLS trong toàn namespace
apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata: {name: default, namespace: shopnow}
spec:
  mtls: {mode: STRICT}    # PERMISSIVE (mặc định) | STRICT | DISABLE
---
# AuthorizationPolicy — chỉ gateway và cart mới được gọi product-service
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata: {name: product-access, namespace: shopnow}
spec:
  selector:
    matchLabels: {app: shopnow-product-service}
  action: ALLOW
  rules:
  - from:
    - source:
        principals:
        - cluster.local/ns/shopnow/sa/shopnow-backend        # API gateway
        - cluster.local/ns/shopnow/sa/shopnow-shopping-cart-service
    to:
    - operation:
        methods: [GET, POST]
        paths: [/api/products*]
```

> **Chiến lược chuyển đổi bắt buộc:** luôn bắt đầu ở `PERMISSIVE` (chấp nhận cả plaintext lẫn mTLS), xác nhận qua metric `istio_requests_total{connection_security_policy="mutual_tls"}` rằng 100% traffic đã là mTLS, rồi mới siết `STRICT`. Nhảy thẳng vào `STRICT` sẽ làm đứt mọi traffic từ pod chưa có sidecar — bao gồm cả Prometheus scrape và ALB health check.

`RequestAuthentication` xử lý JWT của end-user. Với ShopNow đang dùng **Keycloak JWT ở Spring Cloud Gateway**, đây là điểm chồng lấn cần quyết định: validate JWT ở gateway (như hiện tại) hay đẩy xuống mesh. Khuyến nghị: giữ ở gateway cho business logic, dùng mesh cho defense-in-depth ở tầng service.

#### Nhóm Telemetry

```yaml
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata: {name: mesh-default, namespace: istio-system}
spec:
  tracing:
  - randomSamplingPercentage: 1.0      # 1% cho production, 100% cho lab
  accessLogging:
  - providers: [{name: envoy}]
```

### 3.5 — Istio API vs Gateway API

Kubernetes **Gateway API** (GA từ v1.0) đang dần trở thành chuẩn chung thay cho Ingress. Istio hỗ trợ đầy đủ Gateway API và **đây là hướng khuyến nghị cho triển khai mới**.

| Khái niệm | Istio API (cũ) | Gateway API (chuẩn mới) |
|---|---|---|
| Cấu hình biên | `Gateway` (istio) | `Gateway` + `GatewayClass` |
| Định tuyến HTTP | `VirtualService` | `HTTPRoute` |
| Policy upstream | `DestinationRule` | `BackendTrafficPolicy` (chưa đủ) + vẫn cần `DestinationRule` |
| Ranh giới namespace | Lỏng lẻo (dùng `exportTo`) | Chặt chẽ (`ReferenceGrant`) |

Thực tế 2026: Gateway API đã đủ chín cho north-south (ingress) và cho ambient waypoint, nhưng **DestinationRule vẫn chưa có thứ thay thế hoàn chỉnh** cho circuit breaking/connection pool. Chiến lược an toàn: dùng `Gateway`+`HTTPRoute` cho định tuyến, giữ `DestinationRule` cho traffic policy.

---

## 4. Ambient Mode — Thay đổi kiến trúc lớn nhất của Istio

### 4.1 — Vì sao ambient ra đời

Sidecar mode có bốn nhược điểm cấu trúc không thể vá:

1. **Chi phí tài nguyên tuyến tính theo số pod.** Mỗi pod tốn thêm ~50–100MB RAM và một phần CPU cho Envoy. 200 pod = ~10–20GB RAM chỉ để chạy proxy. Với Karpenter, điều này trực tiếp làm tăng số node và hoá đơn EC2.
2. **Upgrade là restart toàn bộ.** Nâng cấp data plane = restart mọi pod trong mesh.
3. **Race condition khởi động và vòng đời Job.** Như §2.3.
4. **Phải "all-in" mới có giá trị.** Muốn có mTLS thì phải chấp nhận cả bộ máy L7 Envoy nặng nề, kể cả với service chỉ chạy TCP thuần.

### 4.2 — Kiến trúc phân tầng của ambient

Ambient tách mesh thành **hai lớp có thể bật độc lập**:

```
┌─────────────────────────────────────────────────────────────┐
│ LỚP L7 (tuỳ chọn) — waypoint proxy (Envoy, per-namespace)   │
│   HTTP routing, retry, circuit breaking, L7 authz, tracing  │
│   → Deployment bình thường, HPA được, chỉ tạo khi CẦN       │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ LỚP L4 (nền tảng) — ztunnel (Rust, DaemonSet per-node)      │
│   mTLS, SPIFFE identity, L4 authz, TCP metrics              │
│   → Bật bằng 1 label namespace, KHÔNG restart pod           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ istio-cni — ghi iptables trong netns pod, redirect vào      │
│              ztunnel qua HBONE (port 15008)                 │
└─────────────────────────────────────────────────────────────┘
```

Bật ambient cho namespace `shopnow` chỉ cần:

```bash
kubectl label namespace shopnow istio.io/dataplane-mode=ambient
```

Traffic bắt đầu được mã hoá mTLS trong vài giây, **không pod nào phải restart**. Đây là khác biệt vận hành khổng lồ so với sidecar.

**HBONE** (HTTP-Based Overlay Network Environment) là giao thức tunnel: ztunnel bọc traffic gốc trong HTTP CONNECT qua TLS trên port 15008. Nhờ vậy ztunnel giữ được danh tính nguồn đầu-cuối mà không cần parse payload L7.

### 4.3 — So sánh Sidecar vs Ambient

| Tiêu chí | Sidecar | Ambient |
|---|---|---|
| Thành phần data plane | Envoy trong mỗi pod | ztunnel/node (L4) + waypoint/namespace (L7) |
| Bật mesh cho workload | Label ns + **restart pod** | Label ns, **không restart** |
| Chi phí RAM | ~50–100MB × số pod | ~15–50MB × số node (+ waypoint nếu dùng) |
| Độ trễ thêm vào (p50) | ~0.6–0.9 ms | ~0.16–0.20 ms (L4-only) |
| Upgrade data plane | Restart toàn bộ pod | Rolling DaemonSet, pod không đụng tới |
| Tính năng L7 | Có sẵn mọi nơi | Chỉ nơi nào deploy waypoint |
| Bán kính ảnh hưởng khi lỗi | 1 pod | 1 node (ztunnel) hoặc 1 namespace (waypoint) |
| Multi-cluster | Ổn định, đã trưởng thành | Beta (công bố tại KubeCon EU 2026) |
| VM / bare-metal | Hỗ trợ | Chưa hỗ trợ |
| Độ trưởng thành | Rất cao, dùng từ 2018 | GA từ Istio 1.24 (11/2024), đã sản xuất-sẵn sàng |

### 4.4 — Chọn cái nào?

* **Ambient** nếu: bắt đầu mới (đúng trường hợp của platform này), phần lớn nhu cầu là mTLS + observability L4, nhạy cảm chi phí node, và muốn có thể rollback nhanh.
* **Sidecar** nếu: cần multi-cluster mesh ngay, cần đưa VM vào mesh, cần per-pod L7 policy chi tiết, hoặc phụ thuộc `EnvoyFilter`/Wasm.

Đội Istio đã tuyên bố rõ trong roadmap 2025–2026: **không có kế hoạch khai tử sidecar mode** chừng nào còn người dùng. Hai chế độ cùng tồn tại lâu dài, và có thể chạy song song trong cùng một cluster.

---

## 5. So sánh Istio với các lựa chọn khác

| | **Istio** | **Linkerd** | **Cilium Service Mesh** | **AWS App Mesh** | **VPC Lattice** |
|---|---|---|---|---|---|
| Proxy | Envoy (+ ztunnel Rust) | linkerd2-proxy (Rust, micro-proxy) | eBPF + Envoy khi cần L7 | Envoy | AWS quản lý |
| Độ phức tạp | Cao | **Thấp nhất** | Trung bình–cao | Trung bình | Thấp |
| Tính năng | **Đầy đủ nhất** | Đủ dùng, có chủ đích cắt bớt | Mạnh L3/L4, L7 còn non | Cơ bản | Cơ bản, thiên về connectivity |
| mTLS tự động | Có | Có (mặc định bật) | Có (WireGuard/IPsec) | Có | TLS do AWS quản lý |
| Ambient/sidecarless | Có | Không (đang nghiên cứu) | Có (bản chất là eBPF) | Không | Không có sidecar |
| Multi-cluster | Rất mạnh | Có | Cluster Mesh (mạnh) | Hạn chế | Cross-VPC/account |
| Gateway API | Đầy đủ | Đầy đủ | Đầy đủ | Không | Riêng của AWS |
| Vendor lock-in | Không | Không | Không | **AWS** | **AWS** |
| Trạng thái 2026 | CNCF Graduated, chuẩn de-facto | CNCF Graduated | CNCF Graduated | **EOL 30/09/2026** | GA |
| Cộng đồng/tuyển dụng | Lớn nhất | Vừa | Lớn (nhờ CNI) | Đang tắt dần | Nhỏ |

### 5.1 — Ghi chú quan trọng về AWS

**AWS App Mesh chấm dứt hỗ trợ ngày 30/09/2026** — tức là *tháng này*. AWS khuyến nghị khách hàng ECS chuyển sang **ECS Service Connect** và khách hàng EKS chuyển sang **VPC Lattice**. Nhiều tổ chức chọn Istio thay vì Lattice để tránh lock-in và có đủ tính năng L7.

**VPC Lattice không phải service mesh đầy đủ.** Nó là lớp application networking do AWS quản lý, mạnh ở kết nối xuyên VPC/account, nhưng thiếu: fault injection, mirroring, circuit breaking chi tiết, và toàn bộ hệ sinh thái công cụ của Istio. Nó cũng tính phí theo giờ + theo lượng request xử lý.

### 5.2 — Khuyến nghị cho platform này

**Istio, chế độ ambient.** Lý do:
1. Bạn đang xây một platform **học tập/tham chiếu** — Istio là kỹ năng có giá trị thị trường cao nhất trong nhóm này.
2. Ambient loại bỏ chính xác những rủi ro nguy hiểm nhất cho ShopNow: race condition khởi động với Config Server/Eureka, và chi phí RAM nhân lên (bạn đang chạy Karpenter với node Spot — mỗi 100MB/pod đều biến thành tiền).
3. Không lock-in AWS, giữ được tính di động của kiến trúc.

Nếu ưu tiên là **đơn giản và vận hành yên tâm** hơn là học sâu, **Linkerd** là lựa chọn hợp lý hơn nhiều so với danh tiếng của nó — cài trong 10 phút, mTLS bật sẵn, gần như không có nút vặn để vặn sai.

---

## 6. Áp dụng vào EKS Core Platform — Phân tích va chạm

Đây là phần quan trọng nhất về mặt thực tế. Mỗi thành phần hiện có đều có điểm tiếp xúc với mesh.

### 6.1 — Bảng va chạm

| Thành phần hiện có | Va chạm | Xử lý |
|---|---|---|
| **Spring Cloud Eureka** (`shopnow-discovery-server`) | **Chồng chéo chức năng.** Eureka làm client-side discovery + LB; mesh làm điều đó ở tầng proxy. Chạy cả hai = LB hai lớp, mesh policy bị bỏ qua vì app gọi thẳng Pod IP từ Eureka | Giai đoạn đầu: **giữ Eureka**, mesh chỉ làm mTLS + telemetry (traffic vẫn được ztunnel bắt kể cả khi gọi thẳng Pod IP). Giai đoạn sau: cân nhắc bỏ Eureka, chuyển sang K8s Service DNS để mesh kiểm soát hoàn toàn định tuyến |
| **Spring Cloud Gateway** (`shopnow-backend`) | Chồng chéo với Istio ingress gateway | Giữ Spring Cloud Gateway cho business routing (`PrefixPath=/api`, JWT Keycloak). Không cần Istio ingress gateway ở giai đoạn đầu |
| **AWS LBC, `target-type: ip`** | ALB bắn vào Pod IP → bị iptables bắt. Health check có thể fail | Sidecar: bật `holdApplicationUntilProxyStarts`, health check → `15021`. **Ambient: gần như không ảnh hưởng** (ztunnel không chặn traffic từ ngoài mesh vào theo kiểu phá health check) |
| **Karpenter** (4 NodePool, Spot) | Consolidation liên tục kill node → ztunnel DaemonSet phải khởi động lại trên node mới. Pod có thể chạy trước khi ztunnel ready | Cài istio-cni + ztunnel với `priorityClassName: system-node-critical`. Với sidecar mode, mỗi node mới còn phải kéo thêm image Envoy → tăng thời gian node ready |
| **Prometheus Agent + Alloy → Mimir** | Sidecar/ztunnel sinh thêm **rất nhiều** metric cardinality (`istio_requests_total` có label source/destination/response_code...). Với `STRICT` mTLS, Prometheus không scrape được pod nếu chính nó không trong mesh | Bật `metricsMerging` (Istio gộp metric app + Envoy ở port 15020). Đặt `PeerAuthentication` PERMISSIVE cho port metrics, hoặc `exclude` cardinality không cần. **Dự phòng tăng 30–50% dung lượng Mimir** |
| **Loki + Alloy** | Access log của Envoy tăng đáng kể lượng log | Bật access log có chọn lọc qua `Telemetry` API, đừng bật toàn mesh |
| **cert-manager** | Không xung đột. Hai phạm vi khác nhau (§3.3) | Có thể tích hợp nâng cao: dùng cert-manager làm intermediate CA cho istiod (`cacerts` secret) thay vì self-signed |
| **Argo Rollouts** (blue-green frontend) | **Cơ hội lớn.** Argo Rollouts hỗ trợ Istio trafficRouting native → nâng cấp từ blue-green sang **canary theo trọng số thực sự** | Xem §6.2 |
| **KEDA / HPA** | Metric của mesh (RPS, p99 latency từ Mimir) là nguồn scale tốt hơn CPU | KEDA Prometheus scaler trỏ vào `istio_requests_total` |
| **EKS Pod Identity** | Không xung đột. Pod Identity Agent chạy trên hostNetwork, nằm ngoài mesh | Nếu bật `STRICT` toàn cluster nhớ loại trừ `kube-system` |
| **VPC CNI + Prefix Delegation** | Ambient hoạt động tốt với VPC CNI (istio-cni chạy chained). Lưu ý đã ghi nhận: **xung đột với Pod Security Groups** | Nếu sau này dùng Security Groups for Pods, cần tắt strict mode của VPC CNI hoặc chuyển sang exec-based probe |
| **Kiến trúc 2 cluster** | Multi-cluster mesh (workload ↔ observability) | **Không cần.** Cluster observability chỉ nhận remote_write/push qua ALB. Không có lý do nối mesh giữa 2 cluster |

### 6.2 — Cơ hội cụ thể: Argo Rollouts + Istio = Canary thực sự

Hiện tại `03-blue-green-argo-rollouts.md` mô tả blue-green với `activeService`/`previewService`. Đây là chuyển đổi **0% → 100%**. Với Istio, cùng một Rollout có thể làm canary theo trọng số:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: {name: shopnow-frontend, namespace: shopnow}
spec:
  strategy:
    canary:
      canaryService: shopnow-frontend-canary
      stableService: shopnow-frontend-stable
      trafficRouting:
        istio:
          virtualService:
            name: shopnow-frontend-vsvc
            routes: [primary]
          destinationRule:
            name: shopnow-frontend-destrule
            canarySubsetName: canary
            stableSubsetName: stable
      steps:
      - setWeight: 5
      - pause: {duration: 2m}
      - analysis:                       # tự động kiểm tra error rate từ Mimir
          templates: [{templateName: success-rate}]
      - setWeight: 25
      - pause: {duration: 5m}
      - setWeight: 50
      - pause: {duration: 5m}
```

Argo Rollouts sẽ tự viết lại `weight` trong VirtualService. Kết hợp với `AnalysisTemplate` truy vấn Mimir (`istio_requests_total{response_code=~"5.."}`) để **tự động rollback** khi error rate vượt ngưỡng. Đây là bước tiến thật sự về năng lực deployment, và là lý do kỹ thuật thuyết phục nhất để đưa Istio vào platform này.

### 6.3 — Ước lượng chi phí

| Khoản | Sidecar mode | Ambient mode |
|---|---|---|
| RAM data plane | ~60MB × ~40 pod ShopNow ≈ **2.4 GB** | ztunnel ~40MB × số node ≈ **0.2–0.4 GB** |
| CPU data plane | ~0.05 vCPU × 40 ≈ 2 vCPU | ~0.1 vCPU × 5 node ≈ 0.5 vCPU |
| istiod | ~1 vCPU / 2GB (HA: ×2) | như nhau |
| Waypoint | — | ~1 Envoy/namespace, chỉ khi cần L7 |
| Tăng dung lượng Mimir | +30–50% series | +15–25% (L4 metric ít label hơn) |
| **Quy đổi node EC2** | ~+1 node `t3.large` | gần như không đáng kể |

---

## 7. Lộ trình học tập & triển khai (thực hành)

### Giai đoạn 0 — Nền tảng lý thuyết (không đụng cluster)

Ba khái niệm phải nắm chắc trước khi gõ lệnh:
1. Vòng đời một request qua mesh: app → iptables → proxy → mTLS → proxy đích → app đích.
2. xDS: LDS → RDS → CDS → EDS (§3.2).
3. SPIFFE identity gắn với ServiceAccount (§3.3).

### Giai đoạn 1 — Lab cô lập (kind/minikube trên máy local, KHÔNG dùng EKS)

Mục tiêu: phá vỡ mọi thứ ở nơi không ai đau.

```bash
# Cài istioctl
curl -L https://istio.io/downloadIstio | sh -
export PATH=$PWD/istio-*/bin:$PATH

# Kiểm tra cluster có sẵn sàng không (LUÔN chạy trước khi cài)
istioctl x precheck

# Cài profile ambient
istioctl install --set profile=ambient --skip-confirmation

# Deploy bookinfo (app mẫu chính thức của Istio)
kubectl apply -f samples/bookinfo/platform/kube/bookinfo.yaml

# Đưa vào mesh — không restart pod nào
kubectl label namespace default istio.io/dataplane-mode=ambient
```

Bài tập bắt buộc phải tự làm:
* Bắt mTLS bằng `kubectl exec` vào ztunnel và đọc log; xác nhận traffic đã mã hoá.
* Cố tình tạo VirtualService trỏ tới subset không tồn tại → quan sát `503 NR` → dùng `istioctl analyze` tìm ra lỗi.
* Deploy waypoint (`istioctl waypoint apply -n default`) rồi thử traffic splitting bằng `HTTPRoute`.
* Đặt `AuthorizationPolicy` DENY rồi xác nhận request bị chặn với `RBAC: access denied`.
* Tiêm lỗi: `fault.delay` 5s vào 50% request, xem retry/timeout phản ứng thế nào.

### Giai đoạn 2 — Triển khai lên `eks-workload` ở namespace nháp

Tạo namespace `mesh-lab` riêng, deploy 2–3 service giả, **tuyệt đối không đụng `shopnow`**.

Điểm cần xác minh trên EKS mà lab local không cho thấy:
* istio-cni có chạy chained với VPC CNI không (`kubectl -n kube-system get ds`).
* Karpenter scale node mới: pod có bị lỗi mạng trong lúc ztunnel chưa ready không?
* Prometheus Agent có scrape được metric của mesh và đẩy về Mimir không?
* Node Spot bị thu hồi: ztunnel khởi động lại có làm đứt kết nối đang mở không?

### Giai đoạn 3 — Đưa `shopnow` vào mesh (chỉ L4)

```bash
kubectl label namespace shopnow istio.io/dataplane-mode=ambient
```

Ở bước này **chỉ có mTLS + L4 telemetry**. Eureka, Spring Cloud Gateway, Argo Rollouts đều giữ nguyên hành vi. Việc cần làm:
* Dựng dashboard Grafana đọc metric mesh từ Mimir.
* Theo dõi `connection_security_policy` — chờ đến khi 100% là `mutual_tls`.
* Đo lại p99 latency trước/sau để định lượng chi phí thật của mesh.
* **Rollback chỉ là gỡ label** — đây là điểm mạnh nhất của ambient.

### Giai đoạn 4 — Bật L7 có chọn lọc

Deploy waypoint cho `shopnow`, rồi:
* Chuyển `shopnow-frontend` từ blue-green sang canary theo trọng số (§6.2).
* Thêm `AuthorizationPolicy` khoá `shopnow-user-service` chỉ cho phép API gateway gọi.
* Siết `PeerAuthentication` lên `STRICT`.
* Thêm retry/timeout ở tầng mesh, rồi **gỡ bớt Resilience4j** trong code — đây mới là lúc mesh thật sự trả lại giá trị bằng cách làm ứng dụng mỏng đi.

### Giai đoạn 5 — Vận hành trưởng thành

* **Revision-based upgrade** (canary upgrade control plane): cài istiod revision mới song song, chuyển từng namespace, rollback bằng cách đổi label. Không bao giờ upgrade in-place trên production.
* Alert cho istiod: `pilot_xds_push_errors`, `pilot_proxy_convergence_time`, cert sắp hết hạn.
* Chạy `istioctl analyze` trong CI trước khi ArgoCD sync.

---

## 8. Cạm bẫy và bài học kinh nghiệm

| # | Cạm bẫy | Cách tránh |
|---|---|---|
| 1 | Bật `STRICT` mTLS quá sớm → đứt Prometheus scrape, ALB health check, mọi pod chưa có mesh | Luôn qua giai đoạn `PERMISSIVE`, xác minh bằng metric trước |
| 2 | `503 NR` / `503 UC` do thiếu DestinationRule cho subset | `istioctl analyze` trong CI |
| 3 | Sidecar không chết → Job/CronJob treo vĩnh viễn | Dùng native sidecar (K8s 1.28+) hoặc ambient |
| 4 | App khởi động trước Envoy → crash-loop khi gọi Config Server | `holdApplicationUntilProxyStarts` hoặc ambient |
| 5 | Không dùng `Sidecar` resource → **mỗi sidecar nhận cấu hình của toàn bộ cluster**. Với 1000 service, mỗi Envoy ngốn hàng trăm MB chỉ để giữ config | Luôn khai báo `Sidecar` với `egress.hosts` giới hạn phạm vi. Ambient không có vấn đề này |
| 6 | Lạm dụng `EnvoyFilter` → vỡ khi upgrade Istio | Coi `EnvoyFilter` là nợ kỹ thuật; ưu tiên first-class API |
| 7 | Cardinality explosion làm sập Mimir | Cấu hình `Telemetry` cắt bớt dimension, tăng limit của Mimir trước |
| 8 | Nghĩ mesh thay thế được NetworkPolicy | Chúng bổ sung nhau: NetworkPolicy chặn ở tầng IP/CNI, AuthorizationPolicy chặn ở tầng danh tính. Defense in depth cần cả hai |
| 9 | Upgrade in-place control plane | Dùng revision-based canary upgrade |
| 10 | Đưa mesh vào khi chỉ có 3 service | Mesh chỉ có lãi từ khoảng 8–10 service trở lên, hoặc khi yêu cầu compliance bắt buộc mTLS |

---

## 9. Khi nào **KHÔNG** nên dùng service mesh

Nghiên cứu này sẽ không trung thực nếu thiếu phần này:

* **Ít hơn ~8 service** và cùng một ngôn ngữ → thư viện (Resilience4j + Micrometer) rẻ hơn nhiều.
* **Đội chưa có ai đọc được `istioctl proxy-config`** → khi có sự cố production, mesh biến từ tài sản thành nợ. Một mesh không ai debug được là một tầng ẩn danh nằm giữa bạn và mọi request.
* **Ứng dụng cực nhạy latency** (giao dịch tần suất cao) → dù ambient chỉ thêm ~0.2ms, ngân sách có thể không cho phép.
* **Đã có L7 gateway giải quyết đủ nhu cầu** và không có yêu cầu mTLS east-west.

Với platform này, tiêu chí quyết định không hẳn là kỹ thuật: đây là môi trường lab/tham chiếu, nên **giá trị học tập và giá trị trình diễn năng lực** là lý do chính đáng để triển khai, miễn là đi theo lộ trình từng bước ở §7 thay vì bật tất cả cùng lúc.

---

## 10. Tổng kết

1. Service mesh **di chuyển** độ phức tạp mạng từ application xuống platform — không xoá nó.
2. Kiến trúc là **control plane** (istiod, ngoài đường đi request) + **data plane** (Envoy/ztunnel, trên đường đi request).
3. **Ambient mode là bước ngoặt**: mTLS bằng một label, không restart pod, chi phí theo node thay vì theo pod, rollback tức thì. Đây là lựa chọn đúng cho triển khai mới năm 2026.
4. **AWS App Mesh EOL 30/09/2026** — không phải phương án. VPC Lattice có nhưng thiếu năng lực L7 và gây lock-in.
5. Với EKS Core Platform: đi **Istio ambient**, theo 5 giai đoạn, giữ nguyên Eureka và Spring Cloud Gateway ở giai đoạn đầu, và điểm thu hoạch lớn nhất là **canary tự động Argo Rollouts + Istio + phân tích metric từ Mimir**.
6. Rủi ro lớn nhất không phải công nghệ mà là **năng lực vận hành**: đừng đưa vào production thứ mà lúc 2 giờ sáng không ai đọc nổi cấu hình của nó.

---

## 11. Tài liệu tham khảo

* [Istio — Sidecar or ambient?](https://istio.io/latest/docs/overview/dataplane-modes/) — so sánh chính thức hai chế độ data plane
* [Istio Roadmap 2025–2026](https://istio.io/latest/blog/2025/roadmap/) — định hướng migration sidecar→ambient, multicluster
* [Istio — Platform-Specific Prerequisites](https://istio.io/latest/docs/ambient/install/platform-prerequisites/) — yêu cầu riêng cho EKS/VPC CNI
* [Istio — Install the Istio CNI node agent](https://istio.io/latest/docs/setup/additional-setup/cni/)
* [Istio — In-pod traffic redirection for ambient](https://istio.io/latest/blog/2024/inpod-traffic-redirection-ambient/) — vì sao ambient chạy được với mọi CNI
* [Istio — Hardening Kubernetes Security with Ambient Mode on Flat Networks](https://istio.io/latest/blog/2026/istio-network-security-flat-networks-ambient-mode/)
* [AWS — Better Together: Amazon EKS Auto Mode and Istio Ambient Mesh](https://aws.amazon.com/blogs/containers/better-together-amazon-eks-auto-mode-and-istio-ambient-mesh/)
* [AWS App Mesh Concepts (thông báo EOL 30/09/2026)](https://docs.aws.amazon.com/app-mesh/latest/userguide/concepts.html)
* [Tetrate — Migrating from AWS App Mesh to Istio](https://tetrate.io/blog/migrating-from-aws-app-mesh-to-istio-a-comprehensive-guide)
* [tetratelabs/aws-app-mesh-to-istio-example](https://github.com/tetratelabs/aws-app-mesh-to-istio-example)
* [Solo.io — The App Mesh Migration Playbook (Lattice vs Gloo Mesh)](https://www.solo.io/blog/the-app-mesh-migration-playbook)

---

## Tài liệu liên quan trong repo

| Tài liệu | Liên quan thế nào |
|---|---|
| [01-architecture-overview.md](00-architecture/01-architecture-overview.md) | Ranh giới 2 cluster — lý do không cần multi-cluster mesh |
| [02-aws-load-balancer-controller.md](01-platform-addons/02-aws-load-balancer-controller.md) | `target-type: ip` và va chạm health check với sidecar |
| [03-blue-green-argo-rollouts.md](04-apps-shopnow/03-blue-green-argo-rollouts.md) | Nền tảng để nâng cấp lên canary theo trọng số với Istio |
| [01-shopnow-microservices-architecture.md](04-apps-shopnow/01-shopnow-microservices-architecture.md) | Eureka/Config Server — vùng chồng lấn chức năng với mesh |
| [03-cert-manager-and-internal-tls.md](01-platform-addons/03-cert-manager-and-internal-tls.md) | TLS north-south vs mTLS east-west |
| [02-mimir-metrics-pipeline.md](03-observability/02-mimir-metrics-pipeline.md) | Nơi hứng metric của mesh — cần tính trước cardinality |

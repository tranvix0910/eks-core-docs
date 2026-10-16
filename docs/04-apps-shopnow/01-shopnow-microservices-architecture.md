# ShopNow Microservices Architecture & Service Topology

Comprehensive architecture documentation for the **ShopNow** e-commerce microservices platform, covering the Spring Cloud stack, database topology, authentication flow, and Kubernetes deployment topology.

---

## 1. Microservices Topology & Service Map

```
                                  Client Browser
                                        │
                                        ▼ (Port 8082)
                         ┌─────────────────────────────┐
                         │ shopnow-frontend (React Web)│
                         └──────────────┬──────────────┘
                                        │
                                        ▼ (Port 5860)
                         ┌─────────────────────────────┐
                         │ shopnow-api-gateway         │
                         │ (Spring Cloud Gateway)      │
                         └──────┬───────┬───────┬──────┘
                                │       │       │
                ┌───────────────┘       │       └───────────────┐
                ▼                       ▼                       ▼
    ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
    │shopnow-product-svc   │ │shopnow-shopping-cart │ │shopnow-user-service  │
    │(Port 5861)           │ │(Port 5863)           │ │(Port 5865)           │
    └──────────┬───────────┘ └──────────┬───────────┘ └──────────┬───────────┘
               │                        │                        │
               ▼                        ▼                        ▼
        PostgreSQL (DB: product)   MySQL 8.0 (DB: cart)    Keycloak (PostgreSQL)

    [Platform Services]
    - shopnow-discovery-server (Eureka on Port 8761)
    - shopnow-config-server (Spring Cloud Config on Port 8888)
```

---

## 2. Component Directory

1. **`shopnow-frontend`** (Port 8082): React SPA, deployed as an **Argo Rollout** (Blue-Green).
2. **`shopnow-api-gateway`** (Port 5860): Spring Cloud Gateway, Eureka client, OAuth2 JWT Resource Server.
3. **`shopnow-product-service`** (Port 5861): Product catalogue API, backed by PostgreSQL.
4. **`shopnow-shopping-cart-service`** (Port 5863): Shopping cart and checkout API, backed by MySQL.
5. **`shopnow-user-service`** (Port 5865): User profiles and auth coordination.
6. **`shopnow-discovery-server`** (Port 8761): Netflix Eureka Service Registry.
7. **`shopnow-config-server`** (Port 8888): Centralized configuration server.
8. **Databases & Keycloak**: PostgreSQL 15, MySQL 8.0, Keycloak 23.

---

## 3. Kubernetes Deployment Structure

All ShopNow manifests reside in `apps/` and follow a modular Kustomize structure:
* `apps/shopnow-backend-config/`: Contains base deployments, configmaps, secrets, and database StatefulSets.
* `apps/shopnow-frontend-config/`: Contains the Argo Rollout CRD manifest, active service, and preview service.

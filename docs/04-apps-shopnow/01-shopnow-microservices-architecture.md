---
title: "ShopNow - Services, ports, and dependencies"
---

# The application used to validate the platform

ShopNow is a reference application for deployment, storage, scheduling, and telemetry tests. It is not a complete commerce implementation with production authorization or availability guarantees.

| Component | Source | In-cluster Service/port | Purpose |
|---|---|---|---|
| Frontend | `shopnow-frontend` | `shopnow-frontend-service:80` | React SPA, Redux, Nginx |
| API gateway | `shopnow-backend/api-gateway` | `shopnow-api-gateway-service:5860` | Routing, JWT |
| Product | `shopnow-product-service` | `shopnow-product-service-service:5861` | Product CRUD, PostgreSQL |
| Cart | `shopnow-shopping-cart-service` | `shopnow-shopping-cart-service-service:5863` | Shopping carts, PostgreSQL, product API calls |
| User | `shopnow-user-service` | `shopnow-user-service-service:5865` | Profiles, registration/login |
| Config server | `shopnow-config-server` | `shopnow-config-server-service:5859` | Spring Config Server |
| Discovery | `shopnow-discovery-server` | `shopnow-discovery-server-service:8761` | Eureka |
| PostgreSQL | Database manifests | `postgres:5432` | Application data |
| MySQL | Database manifests | `shopnow-keycloak-mysql-service:3306` | Keycloak data |
| Keycloak | Database manifests | `shopnow-keycloak-realms-service:8080` | JWT issuance for the demo configuration |

The current config server port is 5859, not 8888. Cart uses PostgreSQL; MySQL serves Keycloak. The actual realm is `java-microservice-realm`, not `shopnow`.

## Request flow

The browser calls gateway paths `/product`, `/shopping-cart`, and `/user`. The gateway resolves services through Eureka, adds `/api`, and forwards to Spring controllers. When troubleshooting, locate the failure in the browser, gateway, or backend before changing the ALB.

## Workshop storage

All six backends mount a service-specific EFS PVC at `/data` through workshop overrides. Replicas of one service share its PVC; different services do not automatically share an Access Point. An EFS mount demonstrates shared filesystem support, but does not mean current code stores products/users there; those remain in PostgreSQL.

## Availability boundaries

The registry and databases remain single-replica. Backend PDBs do not provide database/Eureka HA or guarantee successful cross-service transactions. For the PDB report, identify the tested service and remaining singleton dependencies.

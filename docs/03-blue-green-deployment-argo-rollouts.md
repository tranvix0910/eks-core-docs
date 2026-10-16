# Blue-Green Deployment with ArgoCD & Argo Rollouts — ShopNow Platform

> Overview document covering Blue-Green deployments for ShopNow using Argo Rollouts, building the Spring Cloud API Gateway, and multi-architecture Docker image builds.
> For deep-dive technical guides, see the [docs/04-apps-shopnow/](https://github.com/tranvix0910/eks-core-docs/tree/main/docs/04-apps-shopnow) directory.

---

## ShopNow & Blue-Green Topic Index

1. [ShopNow Microservices Architecture](04-apps-shopnow/01-shopnow-microservices-architecture.md)
   - Service Map (Frontend, Gateway, Eureka Discovery, Config Server, Product, Cart, User).
   - Database layer: PostgreSQL 15, MySQL 8.0, Keycloak 23.

2. [Spring Cloud API Gateway & Routing Fixes](04-apps-shopnow/02-shopnow-api-gateway.md)
   - Unified API gateway on Port 5860.
   - `PrefixPath=/api` filter mechanism and Spring Security OAuth2 resource server.
   - 4 verified production routing issues resolved.

3. [Blue-Green Deployment with Argo Rollouts](04-apps-shopnow/03-blue-green-argo-rollouts.md)
   - Distinguishing ArgoCD vs Argo Rollouts responsibilities.
   - Dual-service pattern: `activeService` and `previewService`.
   - ArgoCD UI Extension setup (`rollout-extension`).
   - Second-by-second traffic switching timeline on AWS ALB.

4. [Multi-Architecture Docker Builds & React Crash Fix](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md)
   - Building `linux/amd64` images on Apple Silicon Macs.
   - Injecting `REACT_APP_BASE_API_URL` build arguments into Create React App.
   - Root-cause analysis of the `TypeError: n.map is not a function` crash.

---

## Operational Status

* **Frontend Rollout**: Running active version `v1.0.2_a48660f` via CRD `Rollout` in namespace `shopnow`.
* **API Gateway**: Registered with Eureka (`API-GATEWAY` status `UP`), routing seamlessly to backend services.
* **Blue-Green Workflow**: Fully managed via the ArgoCD Web UI with automated preview testing and zero-downtime promote actions.

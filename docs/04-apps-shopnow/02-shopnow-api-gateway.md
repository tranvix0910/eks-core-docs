# ShopNow API Gateway Routing & Troubleshooting

Technical guide on **Spring Cloud Gateway (Port 5860)**, path filtering mechanisms (`PrefixPath=/api`), Keycloak JWT authentication, and 4 verified production routing issues resolved.

---

## 1. Routing Mechanics & `PrefixPath=/api`

Backend Spring Boot controllers are mapped to `@RequestMapping("api/...")` (e.g. `/api/products`, `/api/cart`).
However, frontend clients send requests to bare paths (e.g. `/product/**`, `/shopping-cart/**`).

### Gateway Route Configuration:
```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: product-service
          uri: lb://PRODUCT-SERVICE
          predicates:
            - Path=/product/**
          filters:
            - PrefixPath=/api
```
* **Filter `PrefixPath=/api`**: Automatically transforms incoming `/product` requests into `/api/product` before forwarding to the backend microservice.

---

## 2. 4 Verified Production Routing Issues Resolved

1. **Bug 1: Service Name Mismatch**: Config had `lb://SHOPNOW-PRODUCT-SERVICE` while Eureka registered `PRODUCT-SERVICE` -> Fixed to `lb://PRODUCT-SERVICE`.
2. **Bug 2: Missing Path Prefix (`/api`)**: Direct calls resulted in HTTP 404 because controllers expected `/api/products` -> Added `PrefixPath=/api`.
3. **Bug 3: Keycloak JWT Issuer Misconfiguration**: Internal backend could not resolve Keycloak's external public URL -> Standardized internal Keycloak DNS (`http://keycloak.shopnow.svc:8080/realms/shopnow`).
4. **Bug 4: CORS Preflight Blocking**: Browser preflight `OPTIONS` requests were blocked -> Configured global CORS in Spring Cloud Gateway.

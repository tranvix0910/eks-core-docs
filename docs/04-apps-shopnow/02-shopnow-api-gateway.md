---
title: "Verify the API gateway and request path"
---

# Check the API one hop at a time

## 1. Call the gateway

```bash
kubectl --context eks-workload -n shopnow port-forward svc/shopnow-api-gateway-service 5860:5860
```

```bash
curl -i http://localhost:5860/actuator/health
curl -i http://localhost:5860/product
```

SecurityConfig allows anonymous GET requests to `/product`. Writes and cart operations require JWTs under the demo configuration. `[]` is not an error; HTML instead of JSON usually indicates a request sent to frontend/Nginx by mistake.

## 2. Understand route names

| Incoming gateway request | Eureka target | Controller request |
|---|---|---|
| `/product/1` | `PRODUCT-SERVICE` | `/api/product/1` |
| `/shopping-cart/1` | `CART-SERVICE` through the production override | `/api/shopping-cart/1` |
| `/user/signin` | `USER-SERVICE` | `/api/user/signin` |

`PrefixPath=/api` adds the prefix after matching the incoming path. Calling `/api/product` on the gateway is therefore different from calling the controller directly. The older Postman collection still uses gateway `/api/` paths; update those requests before using it for acceptance.

## 3. Isolate failures

- Browser calls the wrong URL: check build-time `REACT_APP_BASE_API_URL` and the Network tab.
- Gateway 404: inspect incoming predicates and prefixes; the direct backend responds at `/api/product`.
- Gateway 503: check Eureka registration, Ready endpoints, and service IDs.
- 401: check JWT issuer/DNS, expiry, and SecurityConfig public paths.
- CORS/preflight: inspect OPTIONS and allowed headers/origins; distinguish this from a missing backend route.

```bash
kubectl --context eks-workload -n shopnow logs deployment/shopnow-api-gateway-deployment --tail=100
kubectl --context eks-workload -n shopnow logs deployment/shopnow-product-service-deployment --tail=100
kubectl --context eks-workload -n shopnow get endpointslices
```

Local configuration and production ConfigMaps differ. Effective values combine image defaults with `/app/config-override/application.properties`.

## 4. Demo authentication limits

The user service validates a database user, then requests a token through `client_credentials`. This is not a complete per-end-user token model. A successful demo login does not prove user-to-cart authorization. The security labs distinguish platform identity from application authentication.

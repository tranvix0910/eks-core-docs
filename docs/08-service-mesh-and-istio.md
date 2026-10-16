---
title: "Extension: when to add a service mesh"
---

# Evaluate Istio after completing the workshop

The core requirements do not include a service mesh. Verify Eureka, Spring Cloud Gateway, Karpenter, EFS, PDB, and telemetry before adding another networking layer.

## Define the benefit before installation

- mTLS and service identities for east-west security requirements.
- Service-to-service access policies beyond gateway logic.
- Traffic splitting and canary analysis when blue-green deployment is insufficient.
- Consistent network telemetry where application instrumentation varies.

A mesh adds control plane components, proxies, and certificate and policy operations. Adopt it when these capabilities address a specific requirement.

## Compare two models

| Model | Data plane | Effects to test |
|---|---|---|
| Sidecar | A proxy per Pod | Resources per Pod, lifecycle and restarts, startup ordering |
| Ambient | A ztunnel per node, with waypoints for L7 when needed | Node lifecycle, CNI, waypoint policy, and failure domains |

This guide does not assume fixed latency, memory usage, or feature maturity for a particular year. Select a version, read its support matrix, and benchmark your workload before deciding.

## Interactions with the existing platform

Eureka may route applications to Pod IPs instead of Service DNS; verify that mesh routing policies apply as intended. Keep business routing and JWT handling in the gateway initially. ALB health checks and Prometheus scraping may need policy exceptions when enforcing mTLS. Karpenter continually creates replacement nodes, so CNI and ztunnel readiness must follow the correct order. Additional metric and log cardinality may require more Mimir and Loki capacity.

Keep the existing private remote_write and log push endpoints for cross-cluster telemetry. A multicluster mesh requires its own use case.

## Trial with a tested rollback

1. Choose a version and a local environment or dedicated test namespace; begin outside `shopnow`.
2. Create two test services and measure latency, CPU, and memory before installation.
3. Install using the official documentation for the selected version; verify VPC CNI compatibility.
4. Enable mTLS within the trial scope, verify identity and traffic through telemetry, and test clients outside the mesh and health checks.
5. Test Karpenter node replacement, Pod restarts, and control plane loss.
6. Add L7 policies, waypoints, or canary routing only for a defined use case after earlier checks pass.
7. Document rollback for enrollment, policies, and controllers; measure connectivity again after rollback.

## Criteria for inclusion in the core workshop

Require a measurable objective, reproducible manifests and version pins, a tested rollback, and passing core exercises. Until then, keep this as an extension so beginners can follow the main learning path.

Reference: [Istio ambient getting started](https://istio.io/latest/docs/ambient/getting-started/). For sidecars, use documentation for the same version and test health and startup behavior separately. Ambient assumptions do not automatically apply to sidecars.

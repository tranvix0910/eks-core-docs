---
title: "JavaMelody - Monitor microservice JVMs"
---

# Turn an empty collector into JVM visibility

JavaMelody adds JVM/JDBC observations for Spring services. It does not replace Prometheus/Mimir or automatically send all its data to cluster 2. The assignment requires the collector on infra nodes; application integration is a separate check.

## 1. Confirm the agent is in the image

The config/discovery/product/cart/user POMs include `javamelody-spring-boot-starter`. The API gateway currently lacks this dependency and is reactive; do not assume its `/monitoring` endpoint exists.

Rebuild images after adding a dependency. Editing a manifest cannot add a Java library to an existing image.

## 2. Connect the collector

After the application Pods are Ready, update `-Djavamelody.urls` in the collector manifest to the internal application endpoint, for example:

```text
-Djavamelody.urls=http://shopnow-product-service-service.shopnow.svc:5861/monitoring
```

For several URLs, use the multi-application syntax documented for the collector version in use; do not assume an arbitrary concatenation is supported. Commit the manifest, apply it to cluster 1, and wait for the StatefulSet rollout. If the endpoint requires authentication, use JavaMelody's supported credential mechanism and a Kubernetes Secret.

## 3. Verify

```bash
kubectl --context eks-workload -n javamelody rollout status statefulset/javamelody-collector --timeout=10m
kubectl --context eks-workload -n javamelody get pods -o wide
kubectl --context eks-workload -n javamelody logs statefulset/javamelody-collector --tail=80
kubectl --context eks-workload -n javamelody port-forward svc/javamelody-collector 8081:8080
```

Send requests to the product API, open the UI, and confirm new timestamps. If only a welcome page appears, check the backend `/monitoring` endpoint from inside the cluster, DNS/port, and collector logs. Its own data uses a gp3 PVC, which does not conflict with the microservices EFS requirement.

**Evidence:** the collector's node has `role=infra`, and at least one backend provides visible JVM/JDBC data. Do not capture screenshots containing real queries or user information.

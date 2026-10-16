# Rancher Multi-Cluster Management & NLB Architecture

Technical documentation on installing **Rancher v2.14.3** on `eks-workload`, managing multi-cluster federation with `eks-observability`, and implementing a Network Load Balancer (NLB) TCP Passthrough to resolve WebSocket TLS Checksum validation in `cattle-cluster-agent`.

---

## 1. Role of Rancher in the Platform

Rancher acts as a unified single-pane-of-glass management console for both Kubernetes clusters:
* **Local Cluster**: `eks-workload` (where Rancher server runs).
* **Imported Cluster**: `eks-observability` (registered via `cattle-cluster-agent`).

---

## 2. Why Internal NLB TCP Passthrough is Required Over ALB

### The ALB Failure Mode:
1. `cattle-cluster-agent` on Cluster 2 maintains a persistent, encrypted WebSocket connection (`wss://`) back to the Rancher server.
2. The agent strictly validates the cryptographic SHA256 checksum of Rancher's root certificate (`--ca-checksum`).
3. **ALB TLS Termination**: If routed through an ALB HTTPS listener, the ALB terminates TLS and re-encrypts with the ALB's own certificate, altering the certificate presented to the agent. This causes an instant checksum mismatch, crashing the agent with `certificate verify failed`.

### The Internal NLB Solution:
File [internal-nlb-service.yaml](https://github.com/tranvix0910/eks-core-gitops/blob/main/platform/addons/rancher/internal-nlb-service.yaml) defines a Layer 4 Network Load Balancer:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: rancher-internal-nlb
  namespace: cattle-system
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "external"
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internal"
spec:
  type: LoadBalancer
  ports:
    - name: https-internal
      port: 443
      targetPort: 443
```
* **Mechanism**: NLB passes raw TCP traffic directly to the Rancher Pods without decrypting TLS. The TLS handshake executes directly between Agent and Server, ensuring 100% checksum consistency.

---

## 3. Why User Access Requires `kubectl port-forward`

* Rancher Web UI sets the **`Secure`** flag on session cookies.
* The `Secure` flag forces the browser to discard cookies unless the browser itself connects via real HTTPS.
* In lab environments lacking custom public domain names (relying on raw `*.elb.amazonaws.com` hostnames), public ALBs run plain HTTP. The browser drops the session cookies, resulting in authentication loops (`401: must authenticate`).
* **Standard User Access Command**:
  ```bash
  kubectl --context eks-workload port-forward -n cattle-system svc/rancher 8443:443
  ```
  Access via: `https://localhost:8443` (Accept the internal self-signed certificate).

---

## 4. Importing `eks-observability` into Rancher

1. Open Rancher UI -> **Cluster Management** -> **Import Existing** -> **Generic** -> Name: `eks-observability`.
2. Configure Rancher `server-url` to point to the Internal NLB hostname (`https://<NLB_DNS>`).
3. Switch context and execute the registration manifest:
   ```bash
   kubectl --context eks-observability apply -f <registration-manifest-url>
   ```
4. Verify that `cattle-cluster-agent` reaches `Running` status on Cluster 2 and the cluster displays `Active` in Rancher.

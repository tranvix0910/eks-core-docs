# Mimir Distributed Metrics Pipeline & Configuration Fixes

Technical reference on **Grafana Mimir Distributed v6.1.0**, S3 TSDB storage, and 6 essential configuration fixes resolved during lab tuning.

---

## 1. Mimir Architecture & Microservices

Mimir runs as a distributed set of microservices:
* **`mimir-distributor`**: Receives incoming `remote_write` requests and splits series across ingesters.
* **`mimir-ingester`**: In-memory ring buffer for active metric samples before flushing to S3.
* **`mimir-compactor`**: Merges and de-duplicates historical blocks in S3.
* **`mimir-store-gateway`**: Queries historical TSDB blocks stored in S3.
* **`mimir-querier` & `query-frontend`**: Executes PromQL queries and provides caching.

---

## 2. 6 Essential Configuration Fixes in `values.yaml`

1. **Disable Bundled MinIO**: Set `minio.enabled: false` to use real AWS S3 directly.
2. **Disable Ingest Storage (Kafka)**: Set `mimir.structuredConfig.ingest_storage.enabled: false` and `kafka.enabled: false` to prevent spinning up Kafka StatefulSets.
3. **Explicit S3 Regional Endpoint**: AWS S3 requires `endpoint: s3.ap-northeast-1.amazonaws.com` explicitly in `values.yaml`.
4. **Unique S3 Storage Prefixes**: Set `alertmanager_storage.storage_prefix: alertmanager` and `ruler_storage.storage_prefix: ruler` to avoid collision with blocks storage.
5. **Re-enable Ingester Push gRPC**: Set `ingester.push_grpc_method_enabled: true` for direct distributor-to-ingester writes.
6. **Set Replication Factor to 1**: Set `ingester.ring.replication_factor: 1` and `store_gateway.sharding_ring.replication_factor: 1` to support a single-replica lab setup without quorum failures.

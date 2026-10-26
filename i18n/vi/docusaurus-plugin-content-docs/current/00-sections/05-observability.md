---
title: "Phần 4 — Giám sát tập trung"
sidebar_label: "4 · Giám sát tập trung"
---

# Phần 4 — Giám sát tập trung {#part-4--centralized-observability}

Cluster 1 gửi metrics và logs sang cluster 2 qua đường mạng riêng có TLS. Chúng ta thiết lập đường kết nối, sau đó kiểm tra metrics trên Mimir, logs trên Loki và xem cả hai trên Grafana.

## Nội dung {#contents}

1. [Luồng metrics và logs](../observability/observability-architecture-overview)
2. [TLS và DNS nội bộ](../platform-addons/cert-manager-and-internal-tls)
3. [Metrics → Mimir](../observability/mimir-metrics-pipeline)
4. [Logs → Loki](../observability/loki-logging-pipeline)
5. [Grafana](../observability/grafana-dashboards)

**Kết quả sau phần này:** Truy vấn được metrics và dòng log mới của cluster 1 trên Grafana của cluster 2.

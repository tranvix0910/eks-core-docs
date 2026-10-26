---
title: "Part 4 — Centralized observability"
sidebar_label: "4 · Centralized observability"
---

# Part 4 — Centralized observability

Cluster 1 sends its metrics and logs to cluster 2 over a private, TLS-protected path. You set up the path, then follow metrics into Mimir, logs into Loki and both into Grafana.

## Contents

1. [Metrics and logs flow](../observability/observability-architecture-overview)
2. [TLS and private DNS](../platform-addons/cert-manager-and-internal-tls)
3. [Metrics → Mimir](../observability/mimir-metrics-pipeline)
4. [Logs → Loki](../observability/loki-logging-pipeline)
5. [Grafana](../observability/grafana-dashboards)

**At the end of this part:** Fresh cluster 1 metrics and log lines queryable in Grafana on cluster 2.

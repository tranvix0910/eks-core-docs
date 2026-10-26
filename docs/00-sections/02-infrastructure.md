---
title: "Part 1 — Infrastructure with Terraform"
sidebar_label: "1 · Infrastructure with Terraform"
---

# Part 1 — Infrastructure with Terraform

Terraform builds the network and both EKS clusters in three layers, each with its own state. You apply them in order: network, workload cluster, observability cluster, then finish the workload cluster.

## Contents

1. [Terraform workflow](../architecture/terraform-workflow)
2. [Network](../architecture/layer-10-network)
3. [Cluster 1 · Workload](../architecture/layer-20-cluster-workload)
4. [Cluster 2 · Observability](../architecture/layer-21-cluster-observability)

**At the end of this part:** Clusters `eks-workload` and `eks-observability` running, with the platform charts installed by Terraform.

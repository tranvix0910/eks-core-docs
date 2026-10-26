---
title: "Phần 3 — Triển khai microservices"
sidebar_label: "3 · Triển khai microservices"
---

# Phần 3 — Triển khai microservices {#part-3--microservices}

Phần này build image cho ứng dụng, triển khai lên pool 2 qua ArgoCD, sau đó kiểm tra lưu trữ dùng chung, cách phân bổ replica và PodDisruptionBudget.

## Nội dung {#contents}

1. [Build image](../apps-shopnow/docker-build-multi-arch-and-ci)
2. [Triển khai với ArgoCD](../apps-shopnow/shopnow-end-to-end-deployment-guide)
3. [EFS persistent volume](../apps-shopnow/efs-persistent-volumes)
4. [Phân bổ Pod](../apps-shopnow/pod-placement)
5. [PodDisruptionBudget](../apps-shopnow/availability-and-pdb)

**Kết quả sau phần này:** Mọi Application `Synced` và `Healthy`, Pod chạy trên pool 2, đã ghi lại kết quả kiểm tra EFS, phân bổ Pod và PDB.

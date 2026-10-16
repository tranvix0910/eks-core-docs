---
title: "Release and roll back applications"
---

# Choose the appropriate release strategy

The core assignment deploys microservices through ArgoCD, mounts EFS, distributes replicas, and applies PDBs. Backends currently use Deployment RollingUpdate. The frontend already has an Argo Rollout blue-green strategy and remains an extension lab.

| Task | Guide |
|---|---|
| Build/push a new image tag | [Build and CI](04-apps-shopnow/04-docker-build-multi-arch-and-ci.md) |
| Create Applications for every service | [Deploy ShopNow](04-apps-shopnow/00-shopnow-end-to-end-deployment-guide.md) |
| Test preview and promote the frontend | [Blue-green](04-apps-shopnow/03-blue-green-argo-rollouts.md) |
| Restore earlier configuration and inspect drift | [Operations](06-operations/05-lifecycle-and-cleanup.md) |

Revert the source configuration commit, then sync for durable rollback. Runtime UI/CLI rollback is an incident response step; update Git afterward so self-heal does not deploy the broken version again.

Do not use one image tag for two different builds in a release exercise. Record the commit, image digest, and promotion/rollback times as evidence.

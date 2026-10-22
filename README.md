# eks-core-docs

Documentation for the EKS Core platform, published at **https://tranvix0910.github.io/eks-core-docs/**.

Markdown lives in [`docs/`](docs/); the site is built with Docusaurus and deployed to GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `main`.

## Run locally

```bash
npm install
npm start          # http://localhost:3000/eks-core-docs/
npm run build      # production build into build/
```

## Adding a page

Drop a Markdown file into the matching `docs/NN-section/` folder; the sidebar picks it up. For a short sidebar label, add its doc ID to [`sidebar-labels.js`](sidebar-labels.js).

## Related repositories

| Repository | Contents |
|---|---|
| **eks-core-docs** | This repository |
| [eks-core-terraform](https://github.com/tranvix0910/eks-core-terraform) | Network and EKS clusters |
| [eks-core-gitops](https://github.com/tranvix0910/eks-core-gitops) | ArgoCD, add-ons, Karpenter node pools, microservices Helm charts |
| [eks-core-apps](https://github.com/tranvix0910/eks-core-apps) | Microservices source code and image build script |

// Reading order follows the workshop requirements.
module.exports = {
  "guides": [
    {
      "type": "doc",
      "id": "index",
      "label": "Workshop learning path",
      "className": "guide_sidebar_index"
    },
    {
      "type": "doc",
      "id": "platform-overview-and-deployment",
      "label": "Requirements and steps",
      "className": "sb-icon sb-icon-book"
    },
    {
      "type": "category",
      "label": "0 · Preparation and design",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "architecture/organizational-constraints-and-prerequisites",
          "label": "Prepare tools and state"
        },
        {
          "type": "doc",
          "id": "architecture/architecture-overview",
          "label": "Architecture and ownership"
        }
      ]
    },
    {
      "type": "category",
      "label": "1 · Create infrastructure with Terraform",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "architecture/layer-10-network",
          "label": "Create the network"
        },
        {
          "type": "doc",
          "id": "architecture/layer-20-cluster-workload",
          "label": "Create the workload cluster"
        },
        {
          "type": "doc",
          "id": "architecture/layer-21-cluster-observability",
          "label": "Create the observability cluster"
        }
      ]
    },
    {
      "type": "category",
      "label": "2 · Platform and capacity groups",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "platform-addons/gitops-bootstrap-order",
          "label": "Bootstrap controllers"
        },
        {
          "type": "doc",
          "id": "platform-addons/aws-load-balancer-controller",
          "label": "Load balancers and ingress"
        },
        {
          "type": "doc",
          "id": "platform-addons/javamelody",
          "label": "JavaMelody"
        },
        {
          "type": "doc",
          "id": "platform-addons/admin-ingress-and-hardening",
          "label": "Access platform tools"
        },
        {
          "type": "doc",
          "id": "karpenter-autoscaling-nodepools",
          "label": "Three capacity groups"
        },
        {
          "type": "doc",
          "id": "karpenter/karpenter-two-halves-architecture",
          "label": "AWS foundation and controller"
        },
        {
          "type": "doc",
          "id": "karpenter/ec2nodeclass-and-nodepools-configuration",
          "label": "Configure pools and test Spot"
        },
        {
          "type": "doc",
          "id": "karpenter/on-demand-spot-ratio-and-limits",
          "label": "Measure the mixed 1:3 ratio"
        },
        {
          "type": "doc",
          "id": "karpenter/arm64-validation",
          "label": "Verify ARM64"
        },
        {
          "type": "doc",
          "id": "karpenter/disruption-and-spot-interruption",
          "label": "Consolidation and interruption"
        }
      ]
    },
    {
      "type": "category",
      "label": "3 · Deploy and protect applications",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "apps-shopnow/shopnow-microservices-architecture",
          "label": "ShopNow architecture"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/docker-build-multi-arch-and-ci",
          "label": "Build and push images"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/shopnow-end-to-end-deployment-guide",
          "label": "Deploy through ArgoCD"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/efs-persistent-volumes",
          "label": "Verify EFS"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/pod-placement",
          "label": "Spread replicas"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/availability-and-pdb",
          "label": "Test PDBs and availability"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/shopnow-api-gateway",
          "label": "Verify the API gateway"
        }
      ]
    },
    {
      "type": "category",
      "label": "4 · Centralized observability",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "platform-addons/cert-manager-and-internal-tls",
          "label": "Private TLS and DNS"
        },
        {
          "type": "doc",
          "id": "observability/observability-architecture-overview",
          "label": "Metrics and log pipelines"
        },
        {
          "type": "doc",
          "id": "observability/mimir-metrics-pipeline",
          "label": "Prometheus → Mimir"
        },
        {
          "type": "doc",
          "id": "observability/loki-logging-pipeline",
          "label": "Alloy → Loki"
        },
        {
          "type": "doc",
          "id": "observability/grafana-dashboards",
          "label": "Grafana queries and dashboards"
        }
      ]
    },
    {
      "type": "category",
      "label": "5 · Acceptance and operations",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "operations/workshop-acceptance",
          "label": "Verify every requirement"
        },
        {
          "type": "doc",
          "id": "operations/system-verification-and-diagnostics",
          "label": "Diagnostics and evidence"
        },
        {
          "type": "doc",
          "id": "operations/master-incident-catalogue",
          "label": "Incident catalogue"
        },
        {
          "type": "doc",
          "id": "operations/lifecycle-and-cleanup",
          "label": "Updates, rollback, and cleanup"
        },
        {
          "type": "doc",
          "id": "operations/tokyo-region-migration-runbook",
          "label": "Deploy to a new environment"
        }
      ]
    },
    {
      "type": "category",
      "label": "6 · Access, secrets, and certificates",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "eks-security",
          "label": "Access paths"
        },
        {
          "type": "doc",
          "id": "security/eks-pod-identity",
          "label": "Pod Identity"
        },
        {
          "type": "doc",
          "id": "security/sts-tokens-and-access-entries",
          "label": "EKS access"
        },
        {
          "type": "doc",
          "id": "security/secrets-management-and-rotation",
          "label": "Secrets and rotation"
        },
        {
          "type": "doc",
          "id": "security/tls-certificate-lifecycle",
          "label": "TLS renewal"
        }
      ]
    },
    {
      "type": "category",
      "label": "7 · Extensions",
      "collapsed": true,
      "items": [
        {
          "type": "doc",
          "id": "blue-green-deployment-argo-rollouts",
          "label": "Releases and rollback"
        },
        {
          "type": "doc",
          "id": "apps-shopnow/blue-green-argo-rollouts",
          "label": "Test frontend blue-green deployment"
        },
        {
          "type": "doc",
          "id": "workload-autoscaling-hpa-cpa-keda",
          "label": "Choose an autoscaling mechanism"
        },
        {
          "type": "doc",
          "id": "operations/workload-autoscaling-implementation-and-testing",
          "label": "Test HPA, CPA, and KEDA"
        },
        {
          "type": "doc",
          "id": "platform-addons/rancher-multi-cluster",
          "label": "Manage clusters with Rancher"
        },
        {
          "type": "doc",
          "id": "architecture/custom-networking-lab-session",
          "label": "Custom Networking"
        },
        {
          "type": "doc",
          "id": "service-mesh-and-istio",
          "label": "Evaluate a service mesh"
        }
      ]
    }
  ]
};

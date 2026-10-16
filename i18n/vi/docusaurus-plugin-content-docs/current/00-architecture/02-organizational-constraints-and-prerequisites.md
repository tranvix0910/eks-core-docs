---
title: "Bước 0.1 — Chuẩn bị và thiết lập"
sidebar_label: "0.1 Chuẩn bị và thiết lập"
---

# Bước 0.1 — Chuẩn bị và thiết lập {#step-01--prerequisites-and-setup}

:::info Tóm tắt bước thực hành
**Mục tiêu:** máy làm việc có thể chạy Terraform, kubectl và Docker với tài khoản AWS của bạn, cùng một S3 bucket lưu Terraform state.
**Thời gian:** khoảng 20 phút. **Chạy từ:** thư mục bất kỳ.
:::

## 1. Tài khoản AWS {#1-aws-account}

Bạn cần tài khoản AWS hoặc role có quyền tạo tài nguyên VPC, EC2, EKS, IAM, EFS, ECR, S3, ELB, Route 53 và SQS.

Kiểm tra các quota sau tại region sẽ sử dụng, mặc định là `ap-northeast-1`:

| Quota | Lý do |
|---|---|
| Running On-Demand Standard instances (vCPU) | Node infra, node monitoring và phần On-Demand của pool 2 |
| All Standard Spot Instance Requests (vCPU) | Pool 1 và 2 |
| EC2-VPC Elastic IPs | Một NAT gateway |
| VPCs per region | Một VPC mới |

```bash
aws service-quotas list-service-quotas --service-code ec2 \
  --query 'Quotas[?contains(QuotaName, `vCPU`)].{Name:QuotaName,Value:Value}' --output table
```

Nếu tổ chức áp dụng Service Control Policies (SCP), xác nhận chúng cho phép EKS và EFS tại region đích. Lệnh deny tường minh trong SCP có ưu tiên cao hơn mọi quyền IAM.

## 2. Công cụ {#2-tools}

| Công cụ | Phiên bản | Dùng để |
|---|---|---|
| AWS CLI | v2 | Credentials, đăng nhập ECR, kiểm tra |
| Terraform | ≥ 1.10, < 2.0 | Tạo hạ tầng |
| kubectl | Chênh tối đa một minor version so với EKS 1.34 | Truy cập cluster |
| Helm | v3 | cert-manager, Alloy |
| Docker có buildx | Phiên bản gần đây | Build image |
| argocd CLI | Tương ứng với server | `argocd app wait` |
| git, jq, python3, curl, openssl | Phiên bản gần đây | Script và kiểm tra |

```bash
aws --version && terraform version && kubectl version --client && helm version
docker buildx version && argocd version --client && jq --version && python3 --version
```

## 3. AWS profile {#3-aws-profile}

Mọi repo sử dụng AWS CLI profile **`eks-core`**. Tạo profile theo phương thức đăng nhập của tài khoản; ví dụ dưới đây dùng IAM Identity Center:

```bash
aws configure sso --profile eks-core
aws sts get-caller-identity --profile eks-core
```

Không đưa access key vào bất kỳ repo nào.

## 4. Clone bốn repo cạnh nhau {#4-clone-the-four-repositories-side-by-side}

Các lớp Terraform đọc Helm values từ `../eks-core-gitops`, vì vậy đặt các repo trong cùng thư mục cha.

```bash
mkdir -p ~/eks-core && cd ~/eks-core
git clone https://github.com/tranvix0910/eks-core-terraform.git
git clone https://github.com/tranvix0910/eks-core-gitops.git
git clone https://github.com/tranvix0910/eks-core-apps.git
git clone https://github.com/tranvix0910/eks-core-docs.git
```

ArgoCD triển khai từ Git URL. Nếu cần sửa chart hoặc values, chẳng hạn ở [bước 3.4](../apps-shopnow/pod-placement), hãy **fork `eks-core-gitops`** và dùng URL của fork bên dưới.

## 5. Biến dùng trong mọi bước {#5-variables-used-in-every-step}

Lưu các biến vào tệp như `~/eks-core/workshop.env` và `source` tệp đó trong mỗi terminal mới.

```bash
# Where the repos live
export WORKSHOP_HOME=~/eks-core
export TF_DIR=$WORKSHOP_HOME/eks-core-terraform
export GITOPS_DIR=$WORKSHOP_HOME/eks-core-gitops
export APPS_DIR=$WORKSHOP_HOME/eks-core-apps
export PLAN_DIR=$WORKSHOP_HOME/plans          # saved Terraform plans
export EVIDENCE_DIR=$WORKSHOP_HOME/evidence   # outputs you keep as proof

# AWS
export AWS_PROFILE=eks-core
export AWS_REGION=ap-northeast-1              # where the clusters run
export AWS_DEFAULT_REGION=$AWS_REGION
export STATE_REGION=ap-southeast-1            # where the Terraform state bucket lives
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# GitOps and images
export WORKSHOP_REPO_URL=https://github.com/tranvix0910/eks-core-gitops.git   # or your fork
export WORKSHOP_REVISION=main
export IMAGE_TAG=workshop-v1

mkdir -p "$PLAN_DIR" "$EVIDENCE_DIR"
```

```bash
source ~/eks-core/workshop.env
echo "$AWS_ACCOUNT_ID $AWS_REGION"
```

## 6. Tạo bucket lưu Terraform state {#6-create-the-terraform-state-bucket}

Mỗi lớp lưu state trong cùng một S3 bucket tên `eks-tfstate-<account-id>`. Chỉ tạo bucket một lần:

```bash
AWS_REGION=$STATE_REGION bash "$TF_DIR/scripts/bootstrap-backend.sh"
aws s3api get-bucket-versioning --bucket "eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"
```

**Kết quả mong đợi:** `"Status": "Enabled"`. Bucket chặn truy cập công khai và được mã hóa. Backend dùng S3 lock file (`use_lockfile = true`), nên không cần bảng DynamoDB.

## 7. Cấu hình tài khoản cho từng lớp {#7-give-each-layer-your-account-values}

Thông tin riêng của tài khoản không được commit vào Git. Mỗi lớp Terraform đọc hai tệp cục bộ đã được gitignore:

| Tệp | Nội dung |
|---|---|
| `backend.hcl` | Tên state bucket và AWS profile cho S3 backend |
| `account.auto.tfvars` | `account_id` — provider từ chối chạy với tài khoản khác |

```bash
for layer in 10-network 20-cluster-workload 21-cluster-observability; do
  printf 'bucket  = "eks-tfstate-%s"\nprofile = "eks-core"\n' "$AWS_ACCOUNT_ID" > "$TF_DIR/$layer/backend.hcl"
  printf 'account_id = "%s"\n' "$AWS_ACCOUNT_ID" > "$TF_DIR/$layer/account.auto.tfvars"
done
git -C "$TF_DIR" status --short   # must not list backend.hcl or account.auto.tfvars
```

Region, CIDR, kích thước node và phiên bản Kubernetes nằm trong `terraform.tfvars` của từng lớp. Sửa tại đó nếu dùng region khác.

## Kiểm chứng {#verify}

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Tiếp theo:** [0.2 Kiến trúc](01-architecture-overview.md)

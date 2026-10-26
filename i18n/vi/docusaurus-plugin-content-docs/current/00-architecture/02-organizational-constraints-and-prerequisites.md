---
title: "Bước 0.1 — Chuẩn Bị và Thiết Lập"
sidebar_label: "0.1 Chuẩn Bị và Thiết Lập"
---

# Bước 0.1 — Chuẩn Bị và Th2ưiết Lập {#step-01--prerequisites-and-setup}

Đầu tiên, chúng ta cần chuẩn bị tài khoản AWS, cài các công cụ và clone repo. Sau khi hoàn tất phần này, bạn có thể dùng cùng một cấu hình môi trường để chạy các bước Terraform và Kubernetes phía sau.

**Thời gian:** khoảng 20 phút. **Chạy từ:** thư mục bất kỳ.

## 1. Tài khoản AWS {#1-aws-account}

Bạn cần tài khoản AWS hoặc IAM role có quyền tạo VPC, EC2, EKS, IAM, EFS, ECR, S3, ELB, Route 53 và SQS.

Kiểm tra Service Quotas tại region triển khai. Cấu hình mẫu dùng `ap-northeast-1`:

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

## 2. Công cụ {#2-tools}

| Công cụ | Phiên bản | Dùng để |
|---|---|---|
| AWS CLI | 2.35.24 | Credentials, đăng nhập ECR, kiểm tra tài nguyên AWS |
| Terraform | 1.15.5 (code yêu cầu ≥ 1.10, < 2.0) | Tạo ba layer hạ tầng |
| kubectl | 1.34.11 (cùng minor với EKS 1.34) | Truy cập cluster |
| Helm | 4.2.3 | Cài đặt cert-manager, Argo Rollouts, Alloy |
| Docker buildx | Docker 29.5.3, buildx 0.34.1 | Build và push image |
| ArgoCD CLI | 3.5.0 (khớp với ArgoCD chart 10.3.0) | `argocd app wait`, `sync`, `diff` |

```bash
aws --version              # aws-cli/2.35.x
terraform version          # Terraform v1.15.x
kubectl version --client   # Client Version: v1.34.x
helm version --short       # v4.2.x
docker buildx version      # github.com/docker/buildx v0.34.x
argocd version --client    # argocd: v3.5.x
```

## 3. AWS Profile {#3-aws-profile}

Trước tiên, kiểm tra các AWS Profile đã có trên máy và chọn Profile sẽ dùng cho Workshop. Tên `eks-core` trong ví dụ chỉ là tên mẫu. Cần thay bằng Profile thực tế và dùng cùng tên đó trong `workshop.env`, Terraform Provider và S3 Backend:

```bash
aws configure list-profiles
export AWS_PROFILE=eks-core   # example: replace with an existing profile from the list
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

## 4. Clone 4 Repo {#4-clone-the-four-repositories-side-by-side}

Đặt 4 repo trong cùng thư mục cha. Terraform đọc Helm Values qua đường dẫn tương đối `../eks-core-gitops`.

```bash
mkdir -p ~/eks-core && cd ~/eks-core
git clone https://github.com/tranvix0910/eks-core-terraform.git
git clone https://github.com/tranvix0910/eks-core-gitops.git
git clone https://github.com/tranvix0910/eks-core-apps.git
git clone https://github.com/tranvix0910/eks-core-docs.git
```

## 5. Cấu Hình Môi Trường {#5-variables-used-in-every-step}

Lưu các biến dùng chung vào `~/eks-core/workshop.env`. Trước khi source file, sửa `AWS_PROFILE=eks-core` thành profile vừa chọn. Mỗi terminal mới cần source lại file này. Nếu bạn đã export một profile khác, giá trị trong file vẫn sẽ ghi đè biến đó.

```bash
# Where the repos live
export WORKSHOP_HOME=~/eks-core
export TF_DIR=$WORKSHOP_HOME/eks-core-terraform
export GITOPS_DIR=$WORKSHOP_HOME/eks-core-gitops
export APPS_DIR=$WORKSHOP_HOME/eks-core-apps
export PLAN_DIR=$WORKSHOP_HOME/plans          # saved Terraform plans

# AWS
export AWS_PROFILE=eks-core                  # replace with the profile selected in step 3
export AWS_REGION=ap-northeast-1              # where the clusters run
export AWS_DEFAULT_REGION=$AWS_REGION
export STATE_REGION=ap-southeast-1            # where the Terraform state bucket lives
unset AWS_ACCOUNT_ID
if ! AWS_ACCOUNT_ID=$(aws sts get-caller-identity \
  --profile "$AWS_PROFILE" --region "$AWS_REGION" --query Account --output text); then
  unset AWS_ACCOUNT_ID
  printf 'Cannot load the AWS account. Check profile "%s" and its login.\n' "$AWS_PROFILE" >&2
  return 1   # this file must be sourced; stop before using an empty account ID
fi
export AWS_ACCOUNT_ID

# GitOps and images
export WORKSHOP_REPO_URL=https://github.com/tranvix0910/eks-core-gitops.git   # or your fork
export WORKSHOP_REVISION=main
export IMAGE_TAG=workshop-v1

mkdir -p "$PLAN_DIR"
```

```bash
source ~/eks-core/workshop.env && printf '%s %s\n' "$AWS_ACCOUNT_ID" "$AWS_REGION"
```

## 6. Cấu hình Terraform Backend {#6-create-the-terraform-state-bucket}

3 Terraform layer lưu state vào S3 bucket `eks-tfstate-<account-id>`, mỗi layer dùng state key riêng. Tạo bucket một lần:

```bash
AWS_REGION=$STATE_REGION bash "$TF_DIR/scripts/bootstrap-backend.sh"
aws s3api get-bucket-versioning --bucket "eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"
```

**Kết quả:** `"Status": "Enabled"`. Bucket chặn truy cập công khai và được mã hóa. Backend dùng S3 lock file (`use_lockfile = true`), nên không cần bảng DynamoDB.

## 7. Khai báo tài khoản AWS cho từng layer {#7-give-each-layer-your-account-values}

Code trong Git giống nhau với mọi người, nhưng **AWS account ID** và **AWS profile** là của riêng bạn. Terraform lấy hai giá trị này từ hai file nhỏ, tạo một lần trong mỗi layer (3 layer). Cả hai file đều nằm trong `.gitignore` nên không bao giờ bị đẩy lên GitHub.

| File | Terraform dùng để làm gì | Ví dụ |
|---|---|---|
| `backend.hcl` | `terraform init` đọc file này để biết **state của layer được lưu ở đâu**: S3 bucket `eks-tfstate-<account-id>`, truy cập bằng profile của bạn. Tên bucket chứa account ID nên không thể ghi cứng trong Git. | `bucket = "eks-tfstate-123456789012"`<br/>`profile = "eks-core"` |
| `account.auto.tfvars` | `terraform plan/apply` tự nạp file này. `account_id` khiến AWS provider **từ chối chạy trên account khác**, đồng thời được dùng để thay `<AWS_ACCOUNT_ID>` trong Helm values. `aws_profile` chọn credentials để gọi AWS. | `account_id = "123456789012"`<br/>`aws_profile = "eks-core"` |

Vòng lặp dưới đây tạo hai file cho cả ba layer từ các biến trong `workshop.env`. File nào đã tồn tại sẽ được bỏ qua, nên chạy lại cũng không sao:

```bash
: "${AWS_ACCOUNT_ID:?source ~/eks-core/workshop.env first}"

for layer in 10-network 20-cluster-workload 21-cluster-observability; do
  dir="$TF_DIR/$layer"

  # Where Terraform keeps this layer's state (used by terraform init)
  [ -e "$dir/backend.hcl" ] || cat > "$dir/backend.hcl" <<EOF
bucket  = "eks-tfstate-$AWS_ACCOUNT_ID"
profile = "$AWS_PROFILE"
EOF

  # Which account and profile Terraform may use (used by plan/apply)
  [ -e "$dir/account.auto.tfvars" ] || cat > "$dir/account.auto.tfvars" <<EOF
account_id  = "$AWS_ACCOUNT_ID"
aws_profile = "$AWS_PROFILE"
EOF
done

cat "$TF_DIR/20-cluster-workload/backend.hcl" "$TF_DIR/20-cluster-workload/account.auto.tfvars"
git -C "$TF_DIR" status --short   # must not list backend.hcl or account.auto.tfvars
```

**Kết quả:** hai file ngắn chứa account ID và profile của bạn; `git status` không hiển thị file nào trong số đó.

Muốn đổi profile sau này, sửa `profile` trong `backend.hcl` và `aws_profile` trong `account.auto.tfvars` ở từng layer, rồi chạy `terraform -chdir="$TF_DIR/<layer>" init -reconfigure -backend-config=backend.hcl`. Không cần apply lại hạ tầng. Region, CIDR, kích thước node và phiên bản Kubernetes vẫn nằm trong `terraform.tfvars` đã commit của từng layer.

## Kiểm tra {#verify}

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Tiếp theo:** [0.2 Kiến trúc](01-architecture-overview.md)

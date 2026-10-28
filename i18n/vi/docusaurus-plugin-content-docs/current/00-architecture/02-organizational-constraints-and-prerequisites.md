---
title: "Bước 0.1 — Chuẩn Bị và Thiết Lập"
sidebar_label: "0.1 Chuẩn Bị và Thiết Lập"
---

# Bước 0.1 — Chuẩn Bị và Thiết Lập {#step-01--prerequisites-and-setup}

Đầu tiên, chúng ta cần chuẩn bị tài khoản AWS, cài các công cụ và clone repo. Sau khi hoàn tất phần này, có thể dùng cùng một cấu hình môi trường để chạy các bước Terraform và Kubernetes phía sau.

## 1. Công cụ {#1-tools}

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

## 2. AWS Profile {#2-aws-profile}

Trước tiên, kiểm tra các AWS Profile đã có trên máy và chọn Profile sẽ dùng cho Workshop. Tên `eks-core` trong ví dụ chỉ là tên mẫu. Cần thay bằng Profile thực tế và dùng cùng tên đó trong `workshop.env`, Terraform Provider và S3 Backend:

```bash
aws configure list-profiles
export AWS_PROFILE=eks-core   # example: replace with an existing profile from the list
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

## 3. Clone 4 Repo {#3-clone-the-four-repositories-side-by-side}

Đặt 4 repo trong cùng thư mục cha. Terraform đọc Helm Values qua đường dẫn tương đối `../eks-core-gitops`.

```bash
mkdir -p ~/eks-core && cd ~/eks-core
git clone https://github.com/tranvix0910/eks-core-terraform.git
git clone https://github.com/tranvix0910/eks-core-gitops.git
git clone https://github.com/tranvix0910/eks-core-apps.git
git clone https://github.com/tranvix0910/eks-core-docs.git
```

## 4. Cấu Hình Môi Trường {#4-variables-used-in-every-step}

Lưu các biến dùng chung vào `~/eks-core/workshop.env`. Trước khi source file, sửa `AWS_PROFILE=eks-core` thành profile vừa chọn. Mỗi terminal mới cần source lại file này. Nếu bạn đã export một profile khác, giá trị trong file vẫn sẽ ghi đè biến đó.

```bash
# Where the repos live
export WORKSHOP_HOME=~/eks-core
export TF_DIR=$WORKSHOP_HOME/eks-core-terraform
export GITOPS_DIR=$WORKSHOP_HOME/eks-core-gitops
export APPS_DIR=$WORKSHOP_HOME/eks-core-apps
export PLAN_DIR=$WORKSHOP_HOME/plans          # saved Terraform plans

# AWS
export AWS_PROFILE=eks-core                  # replace with the profile selected in step 2
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

mkdir -p "$PLAN_DIR"
```

```bash
source ~/eks-core/workshop.env && printf '%s %s\n' "$AWS_ACCOUNT_ID" "$AWS_REGION"
```



## 5. Cấu hình Terraform Backend {#5-create-the-terraform-state-bucket}

3 Terraform layer lưu state vào S3 bucket `eks-tfstate-<account-id>`, mỗi layer dùng state key riêng. Tạo bucket một lần:

```bash
AWS_REGION=$STATE_REGION bash "$TF_DIR/scripts/bootstrap-backend.sh"
aws s3api get-bucket-versioning --bucket "eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"
```

**Kết quả:** `"Status": "Enabled"`. Bucket chặn truy cập công khai và được mã hóa. Backend dùng S3 lock file (`use_lockfile = true`), nên không cần bảng DynamoDB.

## 6. Khai báo tài khoản AWS cho từng layer {#6-give-each-layer-your-account-values}

Code trong Git giống nhau với mọi người, nhưng **AWS account ID** và **AWS profile** là của riêng bạn. Mỗi layer (3 layer) đọc hai giá trị này từ hai file nhỏ. Cả hai file đều nằm trong `.gitignore` nên không bị đẩy lên GitHub.

| File | Terraform dùng để làm gì |
|---|---|
| `backend.hcl` | `terraform init` đọc file này để biết **state của layer được lưu ở đâu**: S3 bucket `eks-tfstate-<account-id>`, truy cập bằng profile của bạn. |
| `account.auto.tfvars` | `terraform plan/apply` tự nạp file này. `account_id` khiến AWS provider **từ chối chạy trên account khác** và được dùng để thay `<AWS_ACCOUNT_ID>` trong Helm values; `aws_profile` chọn credentials để gọi AWS. |

**1. Copy file mẫu.**

Mỗi layer có sẵn file `.example` cho cả hai file:

```bash
cd "$TF_DIR"
cp 10-network/backend.hcl.example                     10-network/backend.hcl
cp 10-network/account.auto.tfvars.example             10-network/account.auto.tfvars
cp 20-cluster-workload/backend.hcl.example            20-cluster-workload/backend.hcl
cp 20-cluster-workload/account.auto.tfvars.example    20-cluster-workload/account.auto.tfvars
cp 21-cluster-observability/backend.hcl.example       21-cluster-observability/backend.hcl
cp 21-cluster-observability/account.auto.tfvars.example 21-cluster-observability/account.auto.tfvars
echo "$AWS_ACCOUNT_ID $AWS_PROFILE"    # the two values to put into the files
```

**2. Sửa các file vừa tạo.** 

Trong từng file, thay `<AWS_ACCOUNT_ID>` bằng account ID và `eks-core` bằng profile của bạn — hai giá trị vừa in ra ở trên. Cả ba layer dùng cùng giá trị. Với account `123456789012` và profile `eks-core`, nội dung file sẽ như sau:

```hcl title="backend.hcl"
bucket  = "eks-tfstate-123456789012"
profile = "eks-core"
```

```hcl title="account.auto.tfvars"
account_id  = "123456789012"
aws_profile = "eks-core"
```

**3. Kiểm Tra.**

```bash
cat "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars
grep -l '<AWS_ACCOUNT_ID>' "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars   # prints nothing
git -C "$TF_DIR" status --short                                                      # lists neither file
```

**Kết quả:** đầy đủ các file chứa Account ID và Profile của bạn, không còn `<AWS_ACCOUNT_ID>`, và `git status` không hiển thị file nào trong số đó.

Muốn đổi Profile sau này, sửa `profile` trong `backend.hcl` và `aws_profile` trong `account.auto.tfvars`, rồi chạy `terraform -chdir="$TF_DIR/<layer>" init -reconfigure -backend-config=backend.hcl` cho layer đó. Không cần apply lại hạ tầng. Region, CIDR, kích thước node và phiên bản Kubernetes vẫn nằm trong `terraform.tfvars` đã commit của từng layer.

## Kiểm Tra {#verify}

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Tiếp theo:** [0.2 Kiến trúc](01-architecture-overview.md)

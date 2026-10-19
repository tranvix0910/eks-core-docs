---
title: "Bước 0.1 — Chuẩn bị và thiết lập"
sidebar_label: "0.1 Chuẩn bị và thiết lập"
---

# Bước 0.1 — Chuẩn bị và thiết lập {#step-01--prerequisites-and-setup}

:::info Nội dung thực hiện
**Mục tiêu:** chuẩn bị Tools, AWS Account, 4 Repo và Backend Terraform.
**Thời gian:** khoảng 20 phút. **Chạy từ:** thư mục bất kỳ.
:::

## 1. AWS Account {#1-aws-account}

Chuẩn bị AWS Account hoặc IAM Role có quyền tạo VPC, EC2, EKS, IAM, EFS, ECR, S3, ELB, Route 53 và SQS.

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

Nếu AWS Account thuộc Organization, kiểm tra SCP cho phép tạo EKS và EFS tại region đã chọn. Explicit Deny trong SCP vẫn chặn thao tác dù IAM Role có quyền Admin.

## 2. Tools {#2-tools}

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

Chọn AWS CLI Profile đang sử dụng trên máy. **`eks-core` là tên mẫu; workshop không tự tạo profile này.** Dùng cùng profile trong `workshop.env`, Terraform Provider và S3 Backend:

```bash
aws configure list-profiles
export AWS_PROFILE=eks-core   # example: replace with an existing profile from the list
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

Nếu chưa có profile, đăng nhập theo phương thức của tổ chức. Với IAM Identity Center, chạy `aws configure sso --profile "$AWS_PROFILE"`, sau đó `aws sso login --profile "$AWS_PROFILE"` và kiểm tra lại identity. Nếu profile đã hoạt động, dùng lại profile đó. Không lưu Access Key trong repo.

## 4. Clone 4 Repo {#4-clone-the-four-repositories-side-by-side}

Đặt 4 repo trong cùng thư mục cha. Terraform đọc Helm values qua đường dẫn tương đối `../eks-core-gitops`.

```bash
mkdir -p ~/eks-core && cd ~/eks-core
git clone https://github.com/tranvix0910/eks-core-terraform.git
git clone https://github.com/tranvix0910/eks-core-gitops.git
git clone https://github.com/tranvix0910/eks-core-apps.git
git clone https://github.com/tranvix0910/eks-core-docs.git
```

ArgoCD triển khai từ Git URL. Nếu cần sửa chart hoặc values, chẳng hạn ở [bước 3.4](../apps-shopnow/pod-placement), hãy **fork `eks-core-gitops`** và dùng URL của fork bên dưới.

## 5. Setup Environment {#5-variables-used-in-every-step}

Tạo file `~/eks-core/workshop.env` để dùng chung biến cho các bước. **Sửa `AWS_PROFILE=eks-core` thành profile đã chọn ở bước 3**, rồi source file trong mỗi terminal mới. Giá trị trong file sẽ ghi đè biến đã export trước đó.

```bash
# Where the repos live
export WORKSHOP_HOME=~/eks-core
export TF_DIR=$WORKSHOP_HOME/eks-core-terraform
export GITOPS_DIR=$WORKSHOP_HOME/eks-core-gitops
export APPS_DIR=$WORKSHOP_HOME/eks-core-apps
export PLAN_DIR=$WORKSHOP_HOME/plans          # saved Terraform plans
export EVIDENCE_DIR=$WORKSHOP_HOME/evidence   # outputs you keep as proof

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

mkdir -p "$PLAN_DIR" "$EVIDENCE_DIR"
```

```bash
source ~/eks-core/workshop.env && printf '%s %s\n' "$AWS_ACCOUNT_ID" "$AWS_REGION"
```

## 6. Setup Backend Terraform {#6-create-the-terraform-state-bucket}

3 Terraform Layer lưu state vào S3 Bucket `eks-tfstate-<account-id>`, mỗi Layer dùng state key riêng. Tạo bucket một lần:

```bash
AWS_REGION=$STATE_REGION bash "$TF_DIR/scripts/bootstrap-backend.sh"
aws s3api get-bucket-versioning --bucket "eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"
```

**Kết quả cần có:** `"Status": "Enabled"`. Bucket chặn truy cập công khai và được mã hóa. Backend dùng S3 lock file (`use_lockfile = true`), nên không cần bảng DynamoDB.

## 7. Setup AWS Account cho từng Layer {#7-give-each-layer-your-account-values}

Mỗi Layer đọc 2 file local đã được gitignore. Dùng các file này để cấu hình account và profile, không commit thông tin riêng vào Git:

| File | Nội dung |
|---|---|
| `backend.hcl` | Tên state bucket và AWS profile cho S3 backend |
| `account.auto.tfvars` | `account_id` và `aws_profile` — provider kiểm tra account và dùng profile local đã chọn |

```bash
python3 <<'PYCONFIG'
import json, os, re
from pathlib import Path
account = os.environ.get("AWS_ACCOUNT_ID", "")
profile = os.environ.get("AWS_PROFILE", "")
if not re.fullmatch(r"[0-9]{12}", account) or not profile:
    raise SystemExit("Load a valid AWS_ACCOUNT_ID and AWS_PROFILE before creating local files.")
root = Path(os.environ["TF_DIR"])
# Preflight all paths before writing anything; preserve existing local files.
for name in ("10-network", "20-cluster-workload", "21-cluster-observability"):
    layer = root / name
    if not (layer / "main.tf").is_file():
        raise SystemExit("Invalid Terraform layer: " + str(layer))
    for filename in ("backend.hcl", "account.auto.tfvars"):
        if (layer / filename).exists():
            raise SystemExit("Already exists; review/update this file instead of overwriting: " + str(layer / filename))
for name in ("10-network", "20-cluster-workload", "21-cluster-observability"):
    layer = root / name
    (layer / "backend.hcl").write_text(
        'bucket = ' + json.dumps("eks-tfstate-" + account) + '\nprofile = ' + json.dumps(profile) + '\n')
    (layer / "account.auto.tfvars").write_text(
        'account_id = ' + json.dumps(account) + '\naws_profile = ' + json.dumps(profile) + '\n')
PYCONFIG
git -C "$TF_DIR" status --short   # must not list backend.hcl or account.auto.tfvars
```

Nếu repo đã được setup, sửa `profile` trong `backend.hcl` và `aws_profile` trong `account.auto.tfvars` của từng Layer. Giữ account ID và bucket đang dùng. File `*.auto.tfvars` sẽ ghi đè profile mẫu trong `terraform.tfvars`. Sau khi đổi backend profile, chạy `terraform -chdir="$TF_DIR/<layer>" init -reconfigure -backend-config=backend.hcl` tại Layer đó. Thay CLI Profile không cần Apply hạ tầng.

Region, CIDR, kích thước node và phiên bản Kubernetes nằm trong `terraform.tfvars` của từng Layer. Sửa tại đó nếu dùng region khác.

## Kiểm tra kết quả {#verify}

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Tiếp theo:** [0.2 Kiến trúc](01-architecture-overview.md)

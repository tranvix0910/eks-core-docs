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

Chọn AWS CLI profile đã có trên máy. **`eks-core` chỉ là tên ví dụ, không bắt buộc và không tự được tạo.** Dùng cùng một tên đã chọn trong `workshop.env`, cấu hình provider Terraform và backend S3:

```bash
aws configure list-profiles
export AWS_PROFILE=eks-core   # example: replace with an existing profile from the list
aws sts get-caller-identity --profile "$AWS_PROFILE"
```

Nếu chưa có profile, dùng cách đăng nhập của tổ chức. Với IAM Identity Center, cấu hình bằng `aws configure sso --profile "$AWS_PROFILE"`, đăng nhập bằng `aws sso login --profile "$AWS_PROFILE"`, rồi kiểm tra identity lại. Không cần tạo lại profile đang hoạt động. Không đưa access key vào bất kỳ repo nào.

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

Lưu các biến vào tệp như `~/eks-core/workshop.env` và `source` tệp đó trong mỗi terminal mới. **Thay dòng mẫu `AWS_PROFILE=eks-core` bằng profile đã chọn ở bước 3 trước khi source.** File này chủ động đặt cố định profile đã chọn; export tên khác trước khi source không ghi đè được dòng trong file.

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

Với checkout có sẵn, chỉ sửa `profile` trong từng `backend.hcl` và `aws_profile` trong từng `account.auto.tfvars`, giữ nguyên account ID, bucket và thiết lập khác. File local `*.auto.tfvars` ghi đè profile mẫu trong `terraform.tfvars` đã track. Sau khi đổi profile của backend đã khởi tạo, chạy `terraform -chdir="$TF_DIR/<layer>" init -reconfigure -backend-config=backend.hcl` cho lớp đó; không apply hạ tầng chỉ để sửa CLI profile.

Region, CIDR, kích thước node và phiên bản Kubernetes nằm trong `terraform.tfvars` của từng lớp. Sửa tại đó nếu dùng region khác.

## Kiểm chứng {#verify}

```bash
aws sts get-caller-identity --query Account --output text   # your account
aws s3 ls "s3://eks-tfstate-$AWS_ACCOUNT_ID" --region "$STATE_REGION"  # no error
ls "$TF_DIR"/*/backend.hcl "$TF_DIR"/*/account.auto.tfvars              # six files
```

**Tiếp theo:** [0.2 Kiến trúc](01-architecture-overview.md)

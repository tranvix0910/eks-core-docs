---
title: "Karpenter Consolidation và Spot Interruption"
---

# Kiểm tra Node Disruption {#understand-why-a-node-is-replaced}

Karpenter xử lý node theo các luồng: Consolidation khi node trống hoặc ít sử dụng, Drift khi cấu hình thay đổi, và Interruption khi AWS gửi sự kiện. Kiểm tra đúng luồng để tìm nguyên nhân node bị thay thế.

## 1. Kiểm tra Disruption Policy {#1-inspect-current-policy}

```bash
kubectl --context eks-workload get nodepool ms-od ms-spot batch-spot arm64 -o yaml
kubectl --context eks-workload get nodeclaims
kubectl --context eks-workload -n kube-system logs deployment/karpenter --since=10m
```

NodePool khai báo `expireAfter`, `consolidationPolicy`, `consolidateAfter` và Disruption Budget. NodePool Budget giới hạn các thao tác thay node được policy hỗ trợ; PDB kiểm soát eviction tự nguyện của Pod. Kiểm tra cả hai khi node chưa được dọn.

## 2. Kiểm tra Interruption Queue {#2-check-the-interruption-pipeline}

```bash
export WORKSHOP_QUEUE=$(terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_queue_name)
aws sqs get-queue-url --queue-name "$WORKSHOP_QUEUE"
aws events list-rules --name-prefix Karpenter --output table
```

Tên rule phụ thuộc module. Nếu bộ lọc không trả kết quả, xem tài nguyên trong Terraform state và đối chiếu target/queue policy. Không receive/delete message chỉ để xem queue vì có thể lấy mất event dành cho controller.

Spot interruption có thời gian báo trước hạn chế; không đảm bảo thời gian phục hồi cho mọi workload. PDB không ngăn được AWS thu hồi EC2; replica trên nhiều failure domain và capacity On-Demand nền giúp giảm ảnh hưởng.

## 3. Test Consolidation {#3-test-consolidation-safely}

Xóa Deployment Spot/ARM64 đã dùng ở bài test, rồi theo dõi NodeClaim, Node và Controller log. Để Karpenter tự quyết định Consolidation và terminate EC2; không dùng `kubectl delete node` để thay bài test này.

## 4. Test Spot Interruption {#4-test-an-actual-interruption}

Dùng lab riêng với AWS FIS hoặc cơ chế mô phỏng được tổ chức phê duyệt, giới hạn một node thử và tiêu chí dừng rõ ràng. Không chọn node chứa database/PV quan trọng chỉ để lấy bằng chứng kiểm tra cốt lõi. [Bài PDB](../04-apps-shopnow/07-availability-and-pdb.md) trước tiên kiểm thử disruption tự nguyện bằng eviction có kiểm soát.

**Báo cáo:** nguyên nhân disruption, node bị ảnh hưởng, replica trước/sau, thời gian phục hồi đo được, dữ liệu EFS còn tồn tại và tỷ lệ lỗi quan sát. Không khẳng định thời gian phục hồi cố định nếu chưa đo.

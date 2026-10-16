---
title: "Consolidation, Spot interruption và giới hạn availability"
---

# Hiểu lý do node bị thay thế {#understand-why-a-node-is-replaced}

Karpenter có thể hợp nhất node trống/ít sử dụng, thay node bị drift hoặc xử lý interruption. Đây là các luồng khác nhau, không phải một sự kiện autoscaling chung.

## 1. Xem policy hiện tại {#1-inspect-current-policy}

```bash
kubectl --context eks-workload get nodepool ms-od ms-spot batch-spot arm64 -o yaml
kubectl --context eks-workload get nodeclaims
kubectl --context eks-workload -n kube-system logs deployment/karpenter --since=10m
```

Pool khai báo `expireAfter`, `consolidationPolicy`, `consolidateAfter` và disruption budget. Budget NodePool giới hạn một số thao tác disruption của Karpenter; PDB giới hạn eviction Pod tự nguyện. Đây là hai loại budget khác nhau.

## 2. Kiểm tra luồng interruption {#2-check-the-interruption-pipeline}

```bash
export WORKSHOP_QUEUE=$(terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_queue_name)
aws sqs get-queue-url --queue-name "$WORKSHOP_QUEUE"
aws events list-rules --name-prefix Karpenter --output table
```

Tên rule phụ thuộc module. Nếu bộ lọc không trả kết quả, xem tài nguyên trong Terraform state và đối chiếu target/queue policy. Không receive/delete message chỉ để xem queue vì có thể lấy mất event dành cho controller.

Spot interruption có thời gian báo trước hạn chế; không đảm bảo thời gian phục hồi cho mọi workload. PDB không ngăn được AWS thu hồi EC2; replica trên nhiều failure domain và capacity On-Demand nền giúp giảm ảnh hưởng.

## 3. Kiểm thử consolidation an toàn {#3-test-consolidation-safely}

Dùng workload thử Spot/ARM64 trước đó, xóa Deployment rồi theo dõi NodeClaim/node và log controller. `kubectl delete node` không phải kiểm thử consolidation: xóa đối tượng node không chứng minh Karpenter quyết định giảm capacity và terminate EC2 đúng cách.

## 4. Kiểm thử interruption thực tế {#4-test-an-actual-interruption}

Dùng lab riêng với AWS FIS hoặc cơ chế mô phỏng được tổ chức phê duyệt, giới hạn một node thử và tiêu chí dừng rõ ràng. Không chọn node chứa database/PV quan trọng chỉ để lấy bằng chứng nghiệm thu cốt lõi. [Bài PDB](../04-apps-shopnow/07-availability-and-pdb.md) trước tiên kiểm thử disruption tự nguyện bằng eviction có kiểm soát.

**Báo cáo:** nguyên nhân disruption, node bị ảnh hưởng, replica trước/sau, thời gian phục hồi đo được, dữ liệu EFS còn tồn tại và tỷ lệ lỗi quan sát. Không khẳng định thời gian phục hồi cố định nếu chưa đo.

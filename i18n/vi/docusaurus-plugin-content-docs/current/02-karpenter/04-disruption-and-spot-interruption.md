---
title: "Karpenter Consolidation và Spot interruption"
---

# Kiểm tra node bị thay thế {#understand-why-a-node-is-replaced}

Karpenter thay đổi node trong vài trường hợp: consolidation khi node trống hoặc ít sử dụng, drift khi cấu hình node thay đổi và interruption khi AWS gửi sự kiện. Xem Events và controller log để biết node đang được xử lý theo trường hợp nào.

## 1. Kiểm tra disruption policy {#1-inspect-current-policy}

```bash
kubectl --context eks-workload get nodepool ms-od ms-spot batch-spot arm64 -o yaml
kubectl --context eks-workload get nodeclaims
kubectl --context eks-workload -n kube-system logs deployment/karpenter --since=10m
```

NodePool khai báo `expireAfter`, `consolidationPolicy`, `consolidateAfter` và disruption budget. NodePool Budget giới hạn các thao tác thay node được policy hỗ trợ; PDB kiểm soát eviction tự nguyện của Pod. Kiểm tra cả hai khi node chưa được dọn.

## 2. Kiểm tra interruption queue {#2-check-the-interruption-pipeline}

```bash
export WORKSHOP_QUEUE=$(terraform -chdir="$TF_DIR/20-cluster-workload" output -raw karpenter_queue_name)
aws sqs get-queue-url --queue-name "$WORKSHOP_QUEUE"
aws events list-rules --name-prefix Karpenter --output table
```

Tên rule phụ thuộc module. Nếu bộ lọc không trả kết quả, xem tài nguyên trong Terraform state và đối chiếu target/queue policy. Không receive/delete message chỉ để xem queue vì có thể lấy mất event dành cho controller.

Spot instance có thể bị AWS thu hồi với thời gian báo trước ngắn. PDB không ngăn được việc EC2 bị thu hồi, nên workload vẫn cần nhiều replica trên các node hoặc AZ khác nhau. Capacity On-Demand trong mixed pool giúp duy trì một phần node ổn định hơn.

## 3. Thử consolidation {#3-test-consolidation-safely}

Xóa Deployment Spot/ARM64 đã dùng ở bài test, rồi theo dõi NodeClaim, Node và controller log. Để Karpenter tự quyết định Consolidation và terminate EC2; không dùng `kubectl delete node` để thay bài test này.

## 4. Thử Spot interruption {#4-test-an-actual-interruption}

Nếu muốn thử Spot interruption thực tế, dùng môi trường lab riêng với AWS FIS hoặc cơ chế mô phỏng phù hợp. Chọn một node thử không chứa database hay dữ liệu cần giữ, ghi lại trạng thái trước khi chạy và điều kiện dừng. Với [bài PDB](../04-apps-shopnow/07-availability-and-pdb.md), chúng ta dùng eviction tự nguyện để kiểm tra budget trước.

Sau khi test, ghi nguyên nhân node bị thay, số replica trước/sau, thời gian Pod phục hồi và số request lỗi quan sát được. Đọc lại file EFS để kiểm tra dữ liệu còn tồn tại. Dùng thời gian đo được ở lần chạy đó để mô tả kết quả.
# Alden Path

Ứng dụng tiếng Việt dành cho một giáo viên. Site dùng quyền truy cập riêng tư của Sites và một không gian dữ liệu chung. Giữ Site ở chế độ chỉ chủ sở hữu. Không có đăng nhập ứng dụng riêng.

## Chạy và xem mã nguồn

Cần Node.js 24. Chạy `node scripts/build.mjs`, `node scripts/validate-artifact.mjs` và `node scripts/dev.mjs` từ thư mục này. Mở http://127.0.0.1:4197. Bản xem trước dùng SQLite và tệp trong thư mục tạm của máy, tách khỏi dữ liệu được triển khai. Đặt ALDEN_PREVIEW_DIR để chọn vị trí khác.

- `web/` chứa giao diện, biểu mẫu và luồng thao tác.
- `worker/api.js` xử lý lưu trữ, tải tệp, kiểm tra phiên bản và gửi yêu cầu AI.
- `worker/tutorflow.js` cung cấp một giao diện chỉ đọc cho dữ liệu mẫu. Buổi mẫu được tạo theo lịch tuần, ID gồm ngày và người học. Lịch hiện 3 tuần trước và 3 tuần tới, cùng mọi buổi đã có kế hoạch hoặc ghi nhận.
- `drizzle/` chứa migration D1. Trên Sites dùng binding DB cho dữ liệu và BUCKET cho tệp.
- Chạy `git archive -o Alden-Path-source.zip HEAD` trong bản checkout để xuất mã nguồn đã commit. Với bản ZIP bàn giao, giải nén rồi đưa cả thư mục cho Codex.

## Dữ liệu và AI

Giáo án, hoạt động, tài liệu, lộ trình mẫu, bản riêng, kế hoạch buổi, ghi nhận và đề xuất là các loại bản ghi riêng có phiên bản. Sao chép lộ trình và giáo án lưu ảnh chụp nội dung tại thời điểm chọn. Đường dẫn tài liệu trỏ đến tài nguyên dùng chung. Thư viện bắt đầu trống.

Để dùng AI, đặt OPENAI_API_KEY trong biến bí mật máy chủ Sites. AI_MODEL là tùy chọn. Nhà cung cấp được gọi tập trung tại hàm assist của worker/api.js. Mỗi tác vụ gửi dữ liệu sau khi giáo viên xem và bấm tạo. Tệp tải lên được lưu để mở lại. Ứng dụng chưa trích văn bản từ tệp. Lưu nháp, chấp nhận hoặc bỏ qua đề xuất là thao tác riêng của giáo viên.

## Kết nối TutorFlow

Cần tài liệu endpoint hoặc mã nguồn, mẫu dữ liệu ẩn danh, ID ổn định của học viên/nhóm/buổi, quan hệ nhóm, múi giờ, trạng thái và quy tắc cập nhật. Xác minh quyền đọc tối thiểu trên môi trường thử trước khi thay adapter mẫu. Không ghi ngược sang TutorFlow.

## Firebase upgrade
See FIREBASE_SETUP.md for the verified storage state, owner-only API protection, JSON backup, separate file backup, Firebase configuration and repeatable migration. DATA_BACKEND defaults to d1 until the Firebase project and permissions are verified. Files remain in R2.

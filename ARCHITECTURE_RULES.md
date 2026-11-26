# Quy tắc kiến trúc & Tách file mô-đun — Alden Path

Tài liệu này quy định nguyên tắc tổ chức mã nguồn bắt buộc cho mọi component và tính năng mới phát triển trên **Alden Path**, nhằm đảm bảo mã nguồn dễ đọc, dễ bảo trì và liên kết an toàn không phát sinh lỗi.

## 1. Quy tắc tách file bắt buộc cho tính năng và component mới

1. **Mỗi tính năng mới = 1 thư mục riêng:**
   - Đặt trong `src/features/<ten-tinh-nang>/` (ví dụ: `src/features/homework-tracker/`).
   - Mỗi thư mục tính năng có 1 tệp `index.ts` xuất công khai (barrel export) thành phần chính để `src/App.tsx` hoặc các màn hình khác liên kết gọn gàng.
2. **Mỗi component giao diện = 1 tệp `.tsx` riêng:**
   - Mọi hộp thoại (modal), ngăn kéo (drawer), biểu mẫu (form), tab con, thanh lọc hoặc khối hiển thị độc lập phải được tách ra tệp riêng (PascalCase, ví dụ: `LessonEditorModal.tsx`, `MaterialUploadModal.tsx`).
   - Không gộp nhiều màn hình con hoặc nhiều modal vào cùng một tệp lớn; giữ mỗi tệp tập trung vào một trách nhiệm rõ ràng.
3. **Tách biệt giao diện, logic thuần và kết nối dữ liệu:**
   - **Kiểu dữ liệu (Types):** Đặt trong `src/types/` (tách tệp riêng theo miền dữ liệu khi mở rộng).
   - **Logic xử lý thuần (Pure logic):** Đặt trong `src/lib/` (kèm tệp kiểm thử `*.test.ts` chạy bằng `node:test`).
   - **Tiện ích định dạng / hằng số:** Đặt trong `src/utils/`.
   - **Gọi API phía trình duyệt:** Đặt trong `src/services/` (tách theo nhóm tài nguyên khi cần).
   - **Tuyến API phía máy chủ (Backend routes):** Mọi nhóm API mới tách thành router riêng trong `server/routes/<ten-nhom>.ts` rồi gắn vào `server.ts`, tránh kéo dài tệp `server.ts`.

## 2. Cấu trúc thư mục chuẩn khi mở rộng

```text
├── server.ts                         # Điểm khởi chạy Express + gắn các router
├── server/
│   ├── aiProvider.ts                 # Lớp kết nối AI phía máy chủ
│   ├── storage.ts                    # Lớp lưu trữ bền vững (sẵn sàng chuyển sang Firestore)
│   ├── tutorflowAdapter.ts           # Lớp đọc chỉ đọc từ TutorFlow (cấm ghi/sửa/xóa)
│   └── routes/                       # Router tách riêng cho từng nhóm API mới
└── src/
    ├── App.tsx                       # Điều phối cấp cao & trạng thái dùng chung
    ├── components/                   # Component giao diện dùng chung & màn hình hiện có
    ├── features/                     # Thư mục tách riêng cho từng tính năng mới
    │   └── <ten-tinh-nang>/
    │       ├── index.ts
    │       ├── <FeatureMain>.tsx
    │       └── components/           # Các sub-component/modal/form của tính năng
    ├── lib/                          # Logic thuần + unit tests (*.test.ts)
    ├── services/                     # Hàm gọi API tới máy chủ
    ├── types/                        # Định nghĩa kiểu TypeScript
    └── utils/                        # Hàm định dạng và hằng số giao diện
```

## 3. Checklist liên kết an toàn sau mỗi lần tách hoặc thêm file

- Sử dụng đường dẫn import tương đối nhất quán và export tường minh (named export).
- Không để phụ thuộc vòng (circular dependency) giữa các component hoặc module logic.
- Chạy đầy đủ kiểm tra sau mỗi thay đổi:
  1. Kiểm tra kiểu TypeScript (`npm run lint`).
  2. Biên dịch ứng dụng (`npm run build`).
  3. Chạy unit test cho logic thuần (`npx --yes tsx --test src/lib/*.test.ts`).
- Luôn tuân thủ ranh giới bảo mật của Alden Path: không ghi ngược vào TutorFlow và không đưa khóa API bí mật vào mã nguồn phía trình duyệt.

# Thiết lập Firebase riêng cho Alden Path

## Trạng thái kiểm tra ngày 26/11/2026

Site hiện tại là Alden Path trên Sites, project appgprj_6b07f0fedf788191a2703f5095ecf889. Đã kiểm tra mã nguồn từ repository hiện tại trước khi sửa. Dữ liệu đang triển khai nằm trong bảng D1 records, nội dung tệp nằm trong R2 BUCKET. Bảng records đang có 0 dòng ở thời điểm kiểm tra, gồm cả tám nhóm lesson, activity, resource, template, path, plan, review, suggestion. Không có giáo án mẫu xác định để xóa, không có liên kết cần tháo. Mã nguồn không có seed giáo án. Dữ liệu QA trong bản xem trước cục bộ tách khỏi production.

Chưa tạo dự án Google. Tên, Project ID, IAM và quyền sở hữu Firebase chưa xác minh. Truy cập Google AI Studio chuyển đến accounts.google.com và bị ERR_CONNECTION_REFUSED. Không có phiên Google hợp lệ để thiết lập tự động cho ứng dụng hiện tại. Tài liệu Google mô tả tích hợp Firebase trong ứng dụng AI Studio, bao gồm Authentication. Ứng dụng này tiếp tục dùng mã nguồn Sites hiện tại.

## Sao lưu trước khi chuyển

1. Mở Alden Path, vào Kết nối TutorFlow, kéo xuống Lưu trữ & sao lưu.
2. Chọn Tải bản sao lưu JSON. Kiểm tra schemaVersion, exportedAt và records.
3. JSON chứa toàn bộ tám loại bản ghi, ID, phiên bản và liên kết. Mảng files ghi rõ included=false. Nội dung nhị phân của tệp không có trong JSON.
4. Tải từng tệp từ danh sách ngay dưới nút sao lưu. Giữ cả JSON và tệp gốc. Tài liệu dạng URL bên ngoài cần sao lưu tại dịch vụ nguồn.
5. R2 có thể chứa tệp mồ côi không có metadata sau lỗi cũ. Cần kiểm kê BUCKET ở hạ tầng nếu muốn xác minh cả tệp mồ côi. Bảng records trống chỉ xác nhận không có tệp được ứng dụng tham chiếu.

## Tạo dự án miễn phí bằng giao diện Google

1. Mở https://console.firebase.google.com/ bằng tài khoản Google của bạn, chọn tạo dự án và đặt tên Alden Path.
2. Tạo một project mới, ghi lại Project ID được Google cấp. Đối chiếu với Project ID TutorFlow. Tiếp tục chỉ khi hai ID khác nhau. Không chọn dự án sẵn có của TutorFlow.
3. Giữ gói Spark nếu được hỗ trợ, tắt Google Analytics nếu không cần. Nếu xuất hiện yêu cầu liên kết thanh toán, nâng cấp hoặc điều khoản chi phí, dừng và quyết định trước khi tiếp tục.
4. Trong Project settings > General, ghi tên, Project ID và đường dẫn Firebase Console. Đường dẫn dự án sẽ hiển thị trong thanh địa chỉ, không suy đoán ID.
5. Vào Firestore Database > Create database, chọn Standard edition, database (default), chọn vị trí phù hợp và Production mode. Nếu màn hình yêu cầu thanh toán, dừng tại đó.
6. Trong Rules, áp dụng firebase/firestore.rules để chặn đọc/ghi trực tiếp từ trình duyệt. Không bật test mode.
7. Trong Project settings > Users and permissions và Google Cloud IAM, xác minh tài khoản của bạn có quyền quản lý dự án, Firestore, IAM và thông tin thanh toán cần thiết. Chỉ báo quyền nào thực sự nhìn thấy.

## Quyền máy chủ

Tạo service account riêng cho Alden Path trong chính project mới. Chỉ cấp Cloud Datastore User (roles/datastore.user) cho thao tác dữ liệu. Không dùng khóa TutorFlow, không dùng vai trò Owner hoặc Editor cho máy chủ ứng dụng. Vai trò này áp dụng toàn bộ database trong dự án, nên dự án phải dành riêng cho Alden Path.

Quyền IAM bảo vệ lời gọi service account. Firestore Rules chặn truy cập client và không thay thế IAM. Mã dùng REST có OAuth service account phía máy chủ để tương thích Cloudflare Workers, không đưa SDK Admin hoặc khóa vào trình duyệt.

Nếu dùng khóa JSON, đặt trực tiếp trong phần biến bí mật máy chủ của Sites, không dán vào chat, Git hoặc file mã nguồn. Ưu tiên quản lý khóa có vòng đời và thu hồi phù hợp. Tên biến cần cấu hình:

- FIREBASE_ALDEN_PROJECT_ID — Project ID đã được xác minh của Alden Path.
- FIREBASE_SERVICE_ACCOUNT_JSON — toàn bộ service account JSON dưới dạng secret phía máy chủ.
- ALDEN_OWNER_EMAIL — email chủ sở hữu đã xác minh ở quyền Sites. Giá trị mặc định trong mã là email chủ sở hữu hiện tại.
- DATA_BACKEND — d1 trong quá trình chuẩn bị, firestore sau khi chuyển và kiểm tra thành công.
- DATA_MIGRATION_LOCK — true khi khóa ghi để chuyển, false sau khi hoàn tất.

Mã kiểm tra Project ID trùng với project trong credential và domain service account. Kiểm tra này ngăn cấu hình nhầm lẫn giữa các giá trị, còn việc dự án tách biệt TutorFlow phải xác minh ở Console trước khi lưu cấu hình.

## Chuyển dữ liệu sau khi có quyền và cấu hình

1. Sao lưu JSON và tệp trước. Giữ DATA_BACKEND=d1.
2. Đặt DATA_MIGRATION_LOCK=true và triển khai. Đợi các yêu cầu ghi của phiên bản trước kết thúc, đóng các tab cũ. Đây là điều kiện cần để nguồn không thay đổi trong quá trình sao chép.
3. Với phiên chủ sở hữu đã được Sites xác thực, gọi POST /api/firebase/migrate từ cùng origin. Có thể dùng Console trình duyệt với fetch('/api/firebase/migrate', {method:'POST'}).then(r => r.json()).then(console.log). Không có khóa trong lệnh.
4. Endpoint sao chép bằng ID ổn định kind__id, giữ data, version, updated và mọi ID liên kết. Chạy lại bỏ qua bản ghi giống nhau. Bản ghi khác nhau được báo conflict, không ghi đè. Lỗi giữa chừng có thể chạy lại.
5. Kiểm tra ready=true, mọi verified.ok=true và không còn conflict/retry. Với dữ liệu lớn, thời gian thực thi Worker có thể hết trước khi hoàn tất, tiếp tục từng lần và kiểm tra kết quả. Nguồn D1 không bị sửa hoặc xóa.
6. Chuyển DATA_BACKEND=firestore, vẫn giữ khóa ghi. Đối chiếu JSON nguồn với bản đọc từ Firestore.
7. Bỏ khóa ghi, triển khai và thử tạo/sửa giáo án, bản riêng lộ trình, kế hoạch, ghi nhận và tải tệp. Mở lại bằng trình duyệt hoặc thiết bị khác với cùng tài khoản ChatGPT được cấp quyền.
8. Khi có ghi mới trên Firestore, muốn quay về D1 cần đồng bộ dữ liệu mới trước. Giữ bản D1 gốc để đối chiếu. Không xóa nguồn trước khi nghiệm thu.

## Tệp và thanh toán

Firebase Storage hiện yêu cầu Blaze có tài khoản Cloud Billing. Chưa kích hoạt hoặc chuyển nội dung tệp sang Firebase Storage. R2 tiếp tục chứa tệp gốc và mọi tệp mới. Firestore lưu metadata và fileId, API máy chủ đọc fileId từ Firestore rồi mở nội dung R2 qua endpoint được bảo vệ.

firebase/storage.rules là mẫu chặn toàn bộ truy cập client, chưa được triển khai vào bất kỳ dự án nào. Nếu quyết định bật Storage sau khi xét chi phí, cần triển khai chuyển nội dung nhị phân, kiểm tra checksum từng tệp, giữ bản gốc và báo kết quả riêng. Chuyển metadata không được coi là chuyển tệp.

## Quyền truy cập thực tế

Sites hiện cấp quyền owner duy nhất, không có editor, viewer hoặc khách ngoài. Sites kiểm soát truy cập trước khi request đến Worker. Trong Worker, toàn bộ API kiểm tra header danh tính do nền tảng cung cấp và email chủ sở hữu. Endpoint workspace, backup, file, uploads, records, AI và migrate đều áp dụng cùng điều kiện. Không có màn hình đăng nhập/đăng ký/đăng xuất do ứng dụng tạo, không có đường dẫn dữ liệu theo tài khoản.

Người chưa có phiên ChatGPT vẫn gặp cổng đăng nhập của Sites. Nếu yêu cầu tuyệt đối không xác thực ở bất kỳ lớp nào, phương án hiện tại cần thay bằng mạng riêng hoặc cổng truy cập khác. Trên Internet công khai, dữ liệu riêng cần một lớp xác thực hoặc giới hạn mạng.

ALDEN_LOCAL_PREVIEW=true chỉ dùng trong scripts/dev.mjs và bài kiểm tra cục bộ. Không đặt biến này trong môi trường được triển khai. Các header danh tính chỉ đáng tin sau Sites dispatch, không dùng Worker này trên host công khai khác mà không thiết kế lại kiểm soát truy cập.

## Giới hạn đã biết

Chưa xác minh Firebase thật, IAM, Rules đã triển khai, đọc/ghi Firestore thật hoặc mở trên thiết bị thứ hai. Kiểm thử REST dùng phản hồi giả lập chỉ xác minh giao thức và hành vi mã. AI vẫn cần cấu hình riêng. TutorFlow giữ adapter dữ liệu mẫu chỉ đọc.
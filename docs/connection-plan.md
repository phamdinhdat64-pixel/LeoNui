# Kế hoạch hoàn thiện kết nối ESP32

## Phạm vi

Hoàn thiện Wi-Fi AP, captive portal, WebSocket, đăng ký thiết bị và quyền Host cho một phiên chạy trong RAM; đồng thời phục vụ game trình duyệt từ LittleFS. Game hiện vẫn chạy cục bộ trên một thiết bị, chưa có trạng thái game dùng chung hay lệnh điều khiển qua WebSocket.

## Thiết kế

1. `ConnectionCore` là mã C++ độc lập với Arduino, giữ danh sách tối đa 12 thiết bị và bản ghi Host trong RAM. Mọi thay đổi chỉ diễn ra từ vòng lặp chính. IP luôn lấy từ WebSocket.
2. `main.cpp` cấu hình AP/DNS/HTTP/WebSocket. Callback WebSocket chỉ sao chép sự kiện vào hàng đợi FreeRTOS; vòng lặp chính đọc hàng đợi, kiểm tra JSON và gọi `ConnectionCore` theo thứ tự.
3. `WebPage.h` chứa trang kết nối tự đóng gói và liên kết `/game/`. Các tệp `data/game/` được phục vụ từ LittleFS. Trình duyệt lưu `deviceId` trong localStorage và dấu đã vào phòng theo `bootId` trong sessionStorage. Khi thấy `bootId` mới, trang xóa vai trò cũ và chờ người dùng bấm vào phòng.

## Các bước kiểm chứng

1. Dùng kiểm tra C++ hiện có và bổ sung các trường hợp IP mới, socket cũ, Host offline và IP cũ sau chuyển quyền. Chạy kiểm tra ở trạng thái đỏ trước khi viết `ConnectionCore`, rồi chạy lại sau khi triển khai.
2. Dùng kiểm tra JavaScript hiện có và bổ sung chuyển quyền thủ công, mất phiên, lệnh `hello` chỉ sau thao tác vào phòng. Chạy đỏ trước khi viết `WebPage.h`, rồi chạy xanh sau khi triển khai.
3. Build PlatformIO cho `esp32dev`; kiểm tra mã biên dịch của HTTP/WebSocket/DNS và cập nhật README với giao thức, vòng đời Host, bộ nhớ và danh sách thử trên bo thật.

## Giới hạn kiểm chứng

Kiểm tra tự động xác nhận logic và mã web. Build xác nhận firmware biên dịch. Chất lượng sóng, hành vi cửa sổ captive portal của từng điện thoại và số máy kết nối đồng thời cần thử trên ESP32 thật.

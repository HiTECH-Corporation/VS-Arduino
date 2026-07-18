<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/HiTECH-Corporation/VS-Arduino@latest/media/icons/logo.png" alt="VS Arduino Logo" width="128" />
</p>

<h1 align="center">VS Arduino</h1>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-%5E1.80.0-blue" alt="VS Code" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Platform-Arduino-00979D?logo=arduino" alt="Arduino" />
  <img src="https://img.shields.io/badge/Assisted%20by-Claude%20Code-D97757?logo=claudecode" alt="Claude Code" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=HiTECH-Corporation.vs-arduino"><img src="https://img.shields.io/badge/Install%20from-VS%20Marketplace-blue" alt="Install from Visual Studio Marketplace" /></a>
  <a href="https://open-vsx.org/extension/HiTECH-Corporation/vs-arduino"><img src="https://img.shields.io/badge/Install%20from-Open%20VSX-purple" alt="Install from Open VSX" /></a>
</p>

---

<p align="center">
  <a href="README.md"><b>English</b></a> |
  <b>Tiếng Việt</b> |
  <a href="README_ja.md"><b>日本語</b></a> |
  <a href="README_zh.md"><b>中文</b></a>
</p>

<p align="center">
  Môi trường phát triển Arduino hoàn chỉnh ngay trong Visual Studio Code — Biên dịch, nạp code, giám sát, vẽ đồ thị và gỡ lỗi mà không cần rời khỏi trình soạn thảo.
</p>

<p align="center">
  © 2026 HiTECH Corporation. Bảo lưu mọi quyền.
</p>

---

## Tính năng

### Biên dịch & Nạp code
- **Compile/Verify** và **Upload** chỉ với một cú nhấp ngay trên thanh công cụ, vận hành bởi `arduino-cli`.
- Log biên dịch và nạp code hiển thị trực tiếp trong kênh `Output > VS Arduino`.
- Sketch đang mở được tự động nhận diện — nhấp chuột phải vào bất kỳ file `.ino` nào để biên dịch hoặc nạp trực tiếp.

### Serial Monitor
- Hoạt động ở cả dạng **panel** phía dưới lẫn **tab** toàn màn hình.
- **Dấu thời gian** theo từng dòng, tuỳ chỉnh **ký tự xuống dòng** và **tốc độ baud**.
- Giao tiếp hai chiều: gửi lệnh xuống board ngay trong cửa sổ monitor.

### Serial Plotter
- Năm loại biểu đồ: **Waveform**, **Multi-line**, **Sensor**, **Digital Pulse** và **Bit Stream**.
- **Phóng to**, **kéo** và **xem chi tiết điểm dữ liệu** khi di chuột.
- **Xuất CSV** một chạm để phân tích ngoại tuyến.

### Gỡ lỗi phần cứng
- Bộ máy **Cortex-Debug** được nhúng sẵn bên trong extension — không cần cài thêm extension phụ trợ nào.
- Nhấn *Debug Sketch*, VS Arduino tự động xác định toolchain, GDB server và file SVD, rồi dừng gọn gàng tại hàm `setup()` của sketch.
- Đầy đủ công cụ gỡ lỗi: các view **Peripherals (SVD)**, **Registers**, **Memory**, **Disassembly** và **RTOS**.

### Board & Library Manager
- Tìm kiếm, cài đặt, cập nhật, hạ cấp và gỡ platform lẫn thư viện qua giao diện hiện đại.
- Chọn từng phiên bản cụ thể để kiểm soát chính xác các phụ thuộc.

### IntelliSense tự động
- Cấu hình C/C++ được sinh và làm mới âm thầm mỗi khi tập `#include` thay đổi, nên gợi ý code luôn khớp với board đang chọn.

### Control Panel
- Chọn **Board**, **Port** và **Programmer** từ view riêng trên Activity Bar.
- Mọi lựa chọn được lưu lại qua các phiên làm việc.

## Cài đặt

Cài từ một trong hai kho:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HiTECH-Corporation.vs-arduino)** — tìm `VS Arduino` trong khung Extensions (`Ctrl+Shift+X`).
- **[Open VSX Registry](https://open-vsx.org/extension/HiTECH-Corporation/vs-arduino)** — dành cho VSCodium và các trình soạn thảo tương thích khác.
- **Cài thủ công** — tải file `.vsix` và chạy `code --install-extension vs-arduino-<version>.vsix`.

> `arduino-cli` được extension tự động tải và quản lý. Nếu muốn dùng bản cài riêng, bạn có thể chỉ định đường dẫn trong phần settings.

## Bắt đầu nhanh

1. Mở thư mục chứa sketch của bạn (`.ino`).
2. Nhấp biểu tượng **VS Arduino** trên Activity Bar.
3. Lần đầu dùng dòng board mới? Mở **Board Manager** và cài platform tương ứng (ví dụ *Arduino AVR Boards*).
4. Chọn **Board**, **Port** và (tuỳ chọn) **Programmer** trong Control Panel.
5. Nhấn **Compile/Verify** (✓) để biên dịch, hoặc **Upload** (→) để nạp sketch.
6. Mở **Serial Monitor** hoặc **Serial Plotter** từ Command Palette để theo dõi dữ liệu trực tiếp.
7. Chạy **VS Arduino: Debug Sketch** để bắt đầu phiên gỡ lỗi phần cứng — chương trình dừng tại `setup()`, sẵn sàng chạy từng bước.

## Yêu cầu

| Thành phần | Yêu cầu |
| --- | --- |
| Visual Studio Code | `^1.80.0` |
| Hệ điều hành | Windows, macOS hoặc Linux |
| Board | Bất kỳ board tương thích Arduino nào cho biên dịch/nạp/giám sát |
| Gỡ lỗi phần cứng | Board dùng nhân ARM Cortex-M kèm mạch nạp debug (ST-Link, J-Link hoặc CMSIS-DAP tích hợp) |

## Cài đặt Extension

| Setting | Mô tả | Mặc định |
| --- | --- | --- |
| `vs-arduino.arduinoCliPath` | Đường dẫn tới file thực thi `arduino-cli` | `""` |
| `vs-arduino.board` | FQBN của board Arduino đang chọn | `""` |
| `vs-arduino.boardName` | Tên hiển thị của board đang chọn | `""` |
| `vs-arduino.port` | Cổng serial đang chọn | `""` |
| `vs-arduino.programmer` | ID của programmer đang chọn | `""` |
| `vs-arduino.programmerName` | Tên hiển thị của programmer đang chọn | `""` |
| `vs-arduino.sketchbookPath` | Đường dẫn thư mục sketchbook, dùng để tìm thư viện tự tạo | `""` |
| `vs-arduino.arduinoDataDir` | Thư mục dữ liệu Arduino tuỳ chỉnh cho thư viện và sketch | `""` |
| `vs-arduino.baudRate` | Tốc độ baud mặc định cho Serial Monitor và Plotter | `"115200"` |

Các hành vi gỡ lỗi nâng cao (đường dẫn toolchain, GDB server, định dạng thanh ghi, panel RTOS) có thể tinh chỉnh trong mục settings **Cortex-Debug**.

## Lệnh & Phím tắt

| Lệnh | Chức năng |
| --- | --- |
| `VS Arduino: Select Board` | Chọn board đích (FQBN) |
| `VS Arduino: Select Port` | Chọn cổng serial |
| `VS Arduino: Select Programmer` | Chọn programmer để nạp/gỡ lỗi |
| `VS Arduino: Compile/Verify` | Biên dịch sketch hiện tại |
| `VS Arduino: Upload` | Biên dịch và nạp sketch hiện tại |
| `VS Arduino: Compile/Verify Sketch` | Biên dịch sketch từ menu chuột phải |
| `VS Arduino: Upload Sketch` | Nạp sketch từ menu chuột phải |
| `VS Arduino: Open Serial Monitor` | Mở Serial Monitor |
| `VS Arduino: Open Serial Plotter` | Mở Serial Plotter |
| `VS Arduino: Debug Sketch` | Bắt đầu phiên gỡ lỗi phần cứng |
| `Open VS Arduino` | Mở view VS Arduino trên Activity Bar |

| Phím tắt | Chức năng |
| --- | --- |
| `Ctrl+Shift+X` (trong phiên debug) | Bật/tắt hiển thị hex trong cửa sổ Variables |

Các lệnh gỡ lỗi bổ sung (xem bộ nhớ, disassembly, làm mới peripheral, panel RTOS) xuất hiện trong menu ngữ cảnh khi phiên debug đang chạy.

## Hỏi đáp & Khắc phục sự cố

**Không thấy cổng của board.**
Kiểm tra cáp USB có hỗ trợ truyền dữ liệu không (không phải cáp chỉ sạc) và driver USB của board đã được cài. Chạy lại `VS Arduino: Select Port` sau khi cắm board.

**Biên dịch báo lỗi "platform not installed".**
Mở **Board Manager**, cài platform khớp với board của bạn (ví dụ *esp32*, *Arduino AVR Boards*) rồi biên dịch lại.

**Nạp thành công nhưng Serial Monitor hiện ký tự lạ.**
Kiểm tra tốc độ baud của monitor có trùng với giá trị truyền vào `Serial.begin()` trong sketch không.

**Debugger không kết nối được.**
Gỡ lỗi phần cứng yêu cầu board ARM Cortex-M và mạch nạp debug. Kiểm tra mạch nạp đã cắm, driver đã cài và programmer đúng đã được chọn trong Control Panel.

**IntelliSense báo thiếu `#include <Arduino.h>`.**
Cấu hình tự sinh lại vài giây sau khi chọn board. Nếu cảnh báo vẫn còn, biên dịch một lần để đường dẫn toolchain được xác định.

## Đóng góp

Mọi đóng góp đều được chào đón! Vui lòng đọc [Hướng dẫn đóng góp](CONTRIBUTING.md) để biết cách thiết lập môi trường phát triển, quy ước code và quy trình pull request.

## Báo lỗi & Góp ý

Phát hiện lỗi hoặc có ý tưởng? [Mở issue](https://github.com/HiTECH-Corporation/VS-Arduino/issues) với template **Bug Report** hoặc **Feature Request**. Khi báo lỗi, vui lòng kèm phiên bản extension, phiên bản VS Code, hệ điều hành và board đang dùng.

## Giấy phép & Ghi công

Phát hành theo Giấy phép MIT. Xem chi tiết tại [LICENSE](LICENSE).
Ghi công bên thứ ba được liệt kê trong [ThirdPartyNotices.txt](ThirdPartyNotices.txt).

VS Arduino được xây dựng trên nền các dự án mã nguồn mở xuất sắc:

- [cortex-debug](https://github.com/Marus/cortex-debug) của Marcel Ball (marus25) — bộ máy gỡ lỗi nhúng.
- [vscode-arduino-intellisense](https://github.com/svnty/vscode-arduino-intellisense) của svnty — ý tưởng tích hợp IntelliSense.
- [arduino-cli](https://github.com/arduino/arduino-cli) của Arduino — xương sống cho biên dịch, nạp code và quản lý thư viện.

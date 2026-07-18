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
  <a href="README_vi.md"><b>Tiếng Việt</b></a> |
  <a href="README_ja.md"><b>日本語</b></a> |
  <b>中文</b>
</p>

<p align="center">
  Visual Studio Code 中的完整 Arduino 开发环境 — 无需离开编辑器即可编译、烧录、监视、绘图和调试。
</p>

<p align="center">
  © 2026 HiTECH Corporation. 保留所有权利。
</p>

---

## 功能特性

### 编译与烧录
- 通过编辑器工具栏一键 **Compile/Verify** 和 **Upload**,底层由 `arduino-cli` 驱动。
- 编译和烧录日志实时输出到 `Output > VS Arduino` 通道。
- 自动识别当前草图 — 右键任意 `.ino` 文件即可直接编译或烧录。

### 串口监视器
- 同时支持底部**面板**和**编辑器标签页**两种视图。
- 逐行**时间戳**,可配置**行结束符**和**波特率**。
- 双向通信:无需离开监视器即可向开发板发送指令。

### 串口绘图器
- 五种图表类型:**Waveform**、**Multi-line**、**Sensor**、**Digital Pulse** 和 **Bit Stream**。
- 支持交互式**缩放**、**平移**和悬停**查看数据点详情**。
- 一键**导出 CSV**,便于离线分析。

### 硬件调试
- 扩展内置 **Cortex-Debug** 调试引擎 — 无需安装任何配套扩展。
- 点击 *Debug Sketch*,VS Arduino 会自动解析工具链、GDB 服务器和 SVD 文件,并精确停在草图的 `setup()` 函数处。
- 完整的调试工具:**Peripherals (SVD)**、**Registers**、**Memory**、**Disassembly** 和 **RTOS** 视图。

### 开发板与库管理器
- 通过现代化界面搜索、安装、更新、降级和卸载平台与库。
- 支持按版本选择,精确控制依赖。

### 自动 IntelliSense
- 每当 `#include` 集合发生变化时,C/C++ 配置会静默生成并刷新,代码补全始终与所选开发板保持一致。

### 控制面板
- 在专属的活动栏视图中选择**开发板**、**端口**和**烧录器**。
- 所有选择在会话之间持久保存。

## 安装

可从任一商店安装:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HiTECH-Corporation.vs-arduino)** — 在扩展视图(`Ctrl+Shift+X`)中搜索 `VS Arduino`。
- **[Open VSX Registry](https://open-vsx.org/extension/HiTECH-Corporation/vs-arduino)** — 适用于 VSCodium 及其他兼容编辑器。
- **手动安装** — 下载 `.vsix` 文件并运行 `code --install-extension vs-arduino-<version>.vsix`。

> `arduino-cli` 由扩展自动下载和管理。如需使用自己的版本,可在设置中指定二进制路径。

## 快速上手

1. 打开包含草图(`.ino`)的文件夹。
2. 点击活动栏中的 **VS Arduino** 图标。
3. 首次使用新系列开发板?请先打开**开发板管理器**安装对应平台(如 *Arduino AVR Boards*)。
4. 在控制面板中选择**开发板**、**端口**以及(可选)**烧录器**。
5. 点击 **Compile/Verify**(✓)编译,或 **Upload**(→)烧录草图。
6. 从命令面板打开**串口监视器**或**串口绘图器**查看实时数据。
7. 运行 **VS Arduino: Debug Sketch** 开始硬件调试 — 程序停在 `setup()` 处,随时可单步执行。

## 系统要求

| 组件 | 要求 |
| --- | --- |
| Visual Studio Code | `^1.80.0` |
| 操作系统 | Windows、macOS 或 Linux |
| 开发板 | 编译/烧录/监视支持任何 Arduino 兼容开发板 |
| 硬件调试 | 基于 ARM Cortex-M 的开发板及调试探头(ST-Link、J-Link 或板载 CMSIS-DAP) |

## 扩展设置

| 设置 | 说明 | 默认值 |
| --- | --- | --- |
| `vs-arduino.arduinoCliPath` | `arduino-cli` 可执行文件路径 | `""` |
| `vs-arduino.board` | 所选 Arduino 开发板的 FQBN | `""` |
| `vs-arduino.boardName` | 所选开发板的显示名称 | `""` |
| `vs-arduino.port` | 所选串口 | `""` |
| `vs-arduino.programmer` | 所选烧录器 ID | `""` |
| `vs-arduino.programmerName` | 所选烧录器的显示名称 | `""` |
| `vs-arduino.sketchbookPath` | Arduino 草图本目录路径,用于查找自定义库 | `""` |
| `vs-arduino.arduinoDataDir` | 用于库和草图的自定义 Arduino 用户目录 | `""` |
| `vs-arduino.baudRate` | 串口监视器和绘图器的默认波特率 | `"115200"` |

高级调试行为(工具链路径、GDB 服务器、寄存器显示格式、RTOS 面板)可在 **Cortex-Debug** 设置分区中调整。

## 命令与快捷键

| 命令 | 功能 |
| --- | --- |
| `VS Arduino: Select Board` | 选择目标开发板(FQBN) |
| `VS Arduino: Select Port` | 选择串口 |
| `VS Arduino: Select Programmer` | 选择烧录/调试用烧录器 |
| `VS Arduino: Compile/Verify` | 编译当前草图 |
| `VS Arduino: Upload` | 编译并烧录当前草图 |
| `VS Arduino: Compile/Verify Sketch` | 从右键菜单编译草图 |
| `VS Arduino: Upload Sketch` | 从右键菜单烧录草图 |
| `VS Arduino: Open Serial Monitor` | 打开串口监视器 |
| `VS Arduino: Open Serial Plotter` | 打开串口绘图器 |
| `VS Arduino: Debug Sketch` | 开始硬件调试会话 |
| `Open VS Arduino` | 聚焦活动栏中的 VS Arduino 视图 |

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl+Shift+X`(调试会话期间) | 切换 Variables 窗口的十六进制显示 |

其他调试命令(内存查看器、反汇编、外设刷新、RTOS 面板)会在调试会话进行时出现在上下文菜单中。

## 常见问题与故障排查

**看不到开发板的端口。**
确认 USB 线支持数据传输(不是仅充电线),且已安装开发板的 USB 驱动。插入开发板后重新运行 `VS Arduino: Select Port`。

**编译报错 "platform not installed"。**
打开**开发板管理器**,安装与您的开发板匹配的平台(如 *esp32*、*Arduino AVR Boards*),然后重新编译。

**烧录成功但串口监视器显示乱码。**
检查监视器的波特率是否与草图中 `Serial.begin()` 传入的值一致。

**调试器无法连接。**
硬件调试需要 ARM Cortex-M 开发板和调试探头。请确认探头已连接、驱动已安装,且控制面板中选择了正确的烧录器。

**IntelliSense 提示找不到 `#include <Arduino.h>`。**
选择开发板后几秒钟内配置会自动重新生成。如果警告仍然存在,编译一次即可解析工具链路径。

## 参与贡献

欢迎贡献!请阅读[贡献指南](CONTRIBUTING.md)了解开发环境搭建、代码规范和 Pull Request 流程。

## 问题反馈

发现 Bug 或有新想法?请使用 **Bug Report** 或 **Feature Request** 模板[提交 issue](https://github.com/HiTECH-Corporation/VS-Arduino/issues)。报告 Bug 时请附上扩展版本、VS Code 版本、操作系统和所用开发板。

## 许可证与致谢

基于 MIT 许可证分发。详见 [LICENSE](LICENSE)。
第三方版权声明见 [ThirdPartyNotices.txt](ThirdPartyNotices.txt)。

VS Arduino 建立在优秀的开源项目之上:

- [cortex-debug](https://github.com/Marus/cortex-debug) — 作者 Marcel Ball (marus25),内置调试引擎。
- [vscode-arduino-intellisense](https://github.com/svnty/vscode-arduino-intellisense) — 作者 svnty,IntelliSense 集成思路。
- [arduino-cli](https://github.com/arduino/arduino-cli) — 作者 Arduino,编译、烧录与库管理的基石。

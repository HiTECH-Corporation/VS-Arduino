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
  <b>English</b> |
  <a href="README_vi.md"><b>Tiếng Việt</b></a> |
  <a href="README_ja.md"><b>日本語</b></a> |
  <a href="README_zh.md"><b>中文</b></a>
</p>

<p align="center">
  A complete Arduino development environment inside Visual Studio Code — Build, upload, monitor, plot, and debug without leaving your editor.
</p>

<p align="center">
  © 2026 HiTECH Corporation. All rights reserved.
</p>

---

## Features

### Build & Upload
- One-click **Compile/Verify** and **Upload** straight from the editor toolbar, powered by `arduino-cli`.
- Build and upload logs stream live into the `Output > VS Arduino` channel.
- The active sketch is detected automatically — right-click any `.ino` file to compile or upload it directly.

### Serial Monitor
- Available as both a bottom **panel** and a full **editor tab**.
- Per-line **timestamps**, configurable **line endings**, and adjustable **baud rate**.
- Two-way communication: send commands to your board without leaving the monitor.

### Serial Plotter
- Five chart types: **Waveform**, **Multi-line**, **Sensor**, **Digital Pulse**, and **Bit Stream**.
- Interactive **zoom**, **pan**, and **hover inspection** of data points.
- One-click **CSV export** for offline analysis.

### Hardware Debugging
- An embedded **Cortex-Debug** engine ships inside the extension — no companion extensions to install.
- Press *Debug Sketch* and VS Arduino resolves the toolchain, GDB server, and SVD file automatically, then halts cleanly at your sketch's `setup()` function.
- Full debug tooling: **Peripherals (SVD)**, **Registers**, **Memory**, **Disassembly**, and **RTOS** views.

### Board & Library Managers
- Search, install, update, downgrade, and uninstall platforms and libraries through a modern UI.
- Per-version selection for precise dependency control.

### Automatic IntelliSense
- C/C++ configurations are generated and refreshed silently whenever your `#include` set changes, so code completion always matches the selected board.

### Control Panel
- Pick your **Board**, **Port**, and **Programmer** from a dedicated activity-bar view.
- Every selection persists across sessions.

## Installation

Install from either store:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HiTECH-Corporation.vs-arduino)** — search for `VS Arduino` in the Extensions view (`Ctrl+Shift+X`).
- **[Open VSX Registry](https://open-vsx.org/extension/HiTECH-Corporation/vs-arduino)** — for VSCodium and other compatible editors.
- **Manual install** — download the `.vsix` file and run `code --install-extension vs-arduino-<version>.vsix`.

> `arduino-cli` is downloaded and managed by the extension automatically. A custom binary path can be supplied via settings if you prefer your own installation.

## Getting Started

1. Open a folder containing your sketch (`.ino`).
2. Click the **VS Arduino** icon in the Activity Bar.
3. First time on a new board family? Open the **Board Manager** and install the matching platform (e.g. *Arduino AVR Boards*).
4. Select your **Board**, **Port**, and (optionally) **Programmer** in the Control Panel.
5. Press **Compile/Verify** (✓) to build, or **Upload** (→) to flash the sketch.
6. Open the **Serial Monitor** or **Serial Plotter** from the Command Palette to watch live data.
7. Run **VS Arduino: Debug Sketch** to start a hardware debug session — execution halts at `setup()`, ready to step.

## Requirements

| Component | Requirement |
| --- | --- |
| Visual Studio Code | `^1.80.0` |
| Operating system | Windows, macOS, or Linux |
| Board | Any Arduino-compatible board for build/upload/monitor |
| Hardware debugging | An ARM Cortex-M based board plus a debug probe (ST-Link, J-Link, or onboard CMSIS-DAP) |

## Extension Settings

| Setting | Description | Default |
| --- | --- | --- |
| `vs-arduino.arduinoCliPath` | Path to the `arduino-cli` executable | `""` |
| `vs-arduino.board` | Selected Arduino board FQBN | `""` |
| `vs-arduino.boardName` | Display name of the selected board | `""` |
| `vs-arduino.port` | Selected serial port | `""` |
| `vs-arduino.programmer` | Selected programmer ID | `""` |
| `vs-arduino.programmerName` | Display name of the selected programmer | `""` |
| `vs-arduino.sketchbookPath` | Path to your Arduino sketchbook directory, used to locate custom libraries | `""` |
| `vs-arduino.arduinoDataDir` | Custom Arduino user directory for libraries and sketches | `""` |
| `vs-arduino.baudRate` | Default baud rate for Serial Monitor and Plotter | `"115200"` |

Advanced debugging behavior (toolchain paths, GDB server binaries, register formatting, RTOS panel) can be tuned under the **Cortex-Debug** settings section.

## Commands & Keybindings

| Command | Action |
| --- | --- |
| `VS Arduino: Select Board` | Choose the target board (FQBN) |
| `VS Arduino: Select Port` | Choose the serial port |
| `VS Arduino: Select Programmer` | Choose the upload/debug programmer |
| `VS Arduino: Compile/Verify` | Build the current sketch |
| `VS Arduino: Upload` | Build and flash the current sketch |
| `VS Arduino: Compile/Verify Sketch` | Build a sketch from the file context menu |
| `VS Arduino: Upload Sketch` | Flash a sketch from the file context menu |
| `VS Arduino: Open Serial Monitor` | Open the Serial Monitor |
| `VS Arduino: Open Serial Plotter` | Open the Serial Plotter |
| `VS Arduino: Debug Sketch` | Start a hardware debug session |
| `Open VS Arduino` | Focus the VS Arduino activity-bar view |

| Keybinding | Action |
| --- | --- |
| `Ctrl+Shift+X` (during a debug session) | Toggle hex display in the Variables window |

Additional debug commands (memory viewer, disassembly, peripheral refresh, RTOS panel) appear in context menus while a debug session is active.

## FAQ & Troubleshooting

**My board's port doesn't show up.**
Make sure the USB cable supports data transfer (not charge-only) and the board's USB driver is installed. Re-run `VS Arduino: Select Port` after plugging in.

**Compilation fails with "platform not installed".**
Open the **Board Manager** and install the platform matching your board (e.g. *esp32*, *Arduino AVR Boards*), then compile again.

**Upload succeeds but the Serial Monitor shows garbage.**
Check that the monitor's baud rate matches the value passed to `Serial.begin()` in your sketch.

**The debugger doesn't attach.**
Hardware debugging requires an ARM Cortex-M board and a debug probe. Verify the probe is connected, its driver is installed, and the correct programmer is selected in the Control Panel.

**IntelliSense flags `#include <Arduino.h>` as missing.**
Configurations regenerate automatically a few seconds after a board is selected. If the warning persists, recompile once so the toolchain paths are resolved.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](CONTRIBUTING.md) for development setup, coding conventions, and the pull-request process.

## Issues & Feedback

Found a bug or have an idea? [Open an issue](https://github.com/HiTECH-Corporation/VS-Arduino/issues) using the **Bug Report** or **Feature Request** template. Please include your extension version, VS Code version, OS, and board when reporting bugs.

## License & Credits

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
Third-party attributions are listed in [ThirdPartyNotices.txt](ThirdPartyNotices.txt).

VS Arduino stands on the shoulders of excellent open-source projects:

- [cortex-debug](https://github.com/Marus/cortex-debug) by Marcel Ball (marus25) — the embedded debugging engine.
- [vscode-arduino-intellisense](https://github.com/svnty/vscode-arduino-intellisense) by svnty — IntelliSense integration concepts.
- [arduino-cli](https://github.com/arduino/arduino-cli) by Arduino — the build, upload, and library backbone.

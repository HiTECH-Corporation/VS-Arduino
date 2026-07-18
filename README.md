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
  <a href="https://open-vsx.org/extension/HiTECH-Corp/vs-arduino"><img src="https://img.shields.io/badge/Install%20from-Open%20VSX-purple" alt="Install from Open VSX" /></a>
</p>

<p align="center">
  A complete Arduino development environment inside Visual Studio Code — Build, upload, monitor, plot, and debug without leaving your editor.
</p>

<p align="center">
  © 2026 HiTECH Corporation. All rights reserved.
</p>

---

## Features

- **Blazing-Fast Compile & Upload** — Verify and flash sketches straight from the editor toolbar, powered by `arduino-cli`. Build output streams live into the `Output > VS Arduino` channel.
- **Integrated Serial Tools** — A full-featured Serial Monitor (panel and tab views) with timestamping and line-ending control, plus a Serial Plotter offering multiple chart types (Waveform, Multi-line, Sensor, Digital Pulse, Bit Stream), zoom/pan, hover inspection, and one-click CSV export.
- **Zero-Config Hardware Debugging** — An embedded Cortex-Debug engine ships inside the extension. Press *Debug Sketch* and VS Arduino resolves the toolchain, GDB server, and SVD file automatically, then stops cleanly at your sketch's `setup()` function. No companion extensions to install.
- **Board & Library Managers** — Search, install, update, downgrade, and uninstall platforms and libraries through a modern UI with per-version selection.
- **Automatic IntelliSense** — C/C++ configurations are generated and refreshed silently whenever your `#include` set changes, so code completion always matches the selected board.
- **Control Panel** — Pick your board, port, and programmer from a dedicated activity-bar view; every selection persists across sessions.

## Requirements

- **Visual Studio Code** `^1.80.0`
- **Arduino-compatible hardware** (a board with debug support and a probe such as ST-Link, J-Link, or an onboard CMSIS-DAP is required for hardware debugging)
- `arduino-cli` is managed by the extension; a custom binary path can be supplied via settings

## Quick Start

1. Install **VS Arduino** from the Marketplace.
2. Open a folder containing your sketch (`.ino`).
3. Click the **VS Arduino** icon in the Activity Bar and select your **Board**, **Port**, and (optionally) **Programmer**.
4. Press **Compile/Verify** (✓) to build, or **Upload** (→) to flash the sketch.
5. Open **Serial Monitor** or **Serial Plotter** from the Command Palette to watch live data.
6. Run **VS Arduino: Debug Sketch** to start a hardware debug session — execution halts at `setup()`, ready to step.

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

## Commands

| Command | Action |
| --- | --- |
| `VS Arduino: Select Board` | Choose the target board (FQBN) |
| `VS Arduino: Select Port` | Choose the serial port |
| `VS Arduino: Select Programmer` | Choose the upload/debug programmer |
| `VS Arduino: Compile/Verify` | Build the current sketch |
| `VS Arduino: Upload` | Build and flash the current sketch |
| `VS Arduino: Open Serial Monitor` | Open the Serial Monitor |
| `VS Arduino: Open Serial Plotter` | Open the Serial Plotter |
| `VS Arduino: Debug Sketch` | Start a hardware debug session |

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
Third-party attributions are listed in [ThirdPartyNotices.txt](ThirdPartyNotices.txt).

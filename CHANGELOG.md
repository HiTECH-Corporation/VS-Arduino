# Changelog

All notable changes to the **VS Arduino** extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2026.7.17]

### Added

- **Compile & Upload pipeline** driven by `arduino-cli`, with live build output streamed to the `Output > VS Arduino` channel and one-click toolbar actions for `.ino` files.
- **Control Panel** activity-bar view for selecting Board (FQBN), Port, and Programmer, with selections persisted across sessions.
- **Board Manager** with search, per-version selection, and Install / Update / Downgrade / Uninstall actions.
- **Library Manager** with the same version-aware action model as the Board Manager.
- **Serial Monitor** available as both a bottom panel and an editor tab, with pinned input row, timestamping, and configurable baud rate and line endings.
- **Serial Plotter** with five distinct chart types (Waveform, Multi-line, Sensor, Digital Pulse, Bit Stream), smooth/step/linear interpolation, zoom and pan, precise hover inspection, and CSV export in `Point, Series...` format.
- **Zero-config Hardware Debugging** via an embedded Cortex-Debug core — no companion extension required. Debug sessions resolve the toolchain, GDB server, and SVD file automatically and stop at the sketch's `setup()` function, skipping core static initializers.
- **Cortex debug views**: Peripherals, Registers, Memory viewer, Disassembly, and an optional RTOS panel.
- **Automatic IntelliSense** generation that regenerates C/C++ configurations whenever the sketch's `#include` set changes, without polluting the output channel.

### Changed

- Board Manager and Library Manager primary action now reads **Install** instead of **Download**.
- Package-management operations (install, update, downgrade, uninstall) surface their progress in `Output > VS Arduino`.

### Removed

- The separate Cortex-Debug VSIX installation flow — the debugger core now ships inside the extension.

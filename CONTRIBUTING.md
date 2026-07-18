# Contributing to VS Arduino

Thank you for your interest in improving VS Arduino! This guide covers everything you need to get a development environment running and to submit changes.

## Development Setup

### Prerequisites

- **Node.js** 20 or newer
- **Visual Studio Code** `^1.80.0`
- **Git**

### Getting the Code

```bash
git clone https://github.com/HiTECH-Corporation/VS-Arduino.git
cd VS-Arduino
npm ci
```

### Building and Running

```bash
npm run compile     # Compile the TypeScript extension sources into out/
npm run watch       # Recompile automatically on file changes
```

To try your changes, open the repository in VS Code and press **F5** — an Extension Development Host window launches with the extension loaded.

### Project Layout

| Path | Purpose |
| --- | --- |
| `src/` | Extension host sources (TypeScript) |
| `src/debugger/cortex-debug-core/` | Embedded Cortex-Debug engine (ships in the extension) |
| `media/` | Prebuilt Webview UI bundles and icons (committed build artifacts) |
| `scripts/` | Build and release helper scripts |
| `out/` | Compiled extension output (generated, not committed) |

> **Note on the Webview UI:** the `media/` bundles are committed build artifacts. The original UI design sources are maintained privately, so please do not hand-edit the bundled files in `media/` — describe the UI change you need in an issue instead.

## Coding Conventions

- Code and comments are written in **English**.
- Prefer **self-documenting code** — clear names over explanatory comments.
- Follow the style of the surrounding code (formatting, naming, module structure).
- Do not introduce new runtime dependencies without discussing them in an issue first.
- Keep the existing Webview messaging architecture and `arduino-cli` invocation logic intact unless the change explicitly targets them.

## Submitting Changes

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/serial-monitor-timestamps
   ```
2. Make your changes and verify that the extension compiles cleanly:
   ```bash
   npm run compile
   ```
3. Test your changes in the Extension Development Host (**F5**).
4. Commit with a clear, imperative message describing *what* and *why*:
   ```
   Fix timestamp drift in Serial Monitor panel view
   ```
5. Push your branch and open a **Pull Request** against `main`. Describe the problem, the approach, and any testing performed.

## Reporting Issues

Use the [issue templates](https://github.com/HiTECH-Corporation/VS-Arduino/issues/new/choose):

- **Bug Report** — include your extension version, VS Code version, OS, board, and the relevant `Output > VS Arduino` log.
- **Feature Request** — describe the problem you are trying to solve, not only the proposed solution.

## Releases

Releases are tag-driven and fully automated. Maintainers publish by updating the version in `package.json` and `CHANGELOG.md`, then pushing a matching `v<version>` tag — the CI pipeline builds, verifies, and publishes to both the Visual Studio Marketplace and Open VSX.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

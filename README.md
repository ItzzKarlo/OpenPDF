# OpenPDF

OpenPDF is a free, offline-first desktop PDF editor built with Tauri 2, Rust, React, TypeScript, PDF.js, and pdf-lib. Documents stay on the local computer: the application has no account system, telemetry, cloud storage, or network-backed document processing.

## Downloads and supported systems

Installers are published on [GitHub Releases](https://github.com/ItzzKarlo/OpenPDF/releases).

| Operating system | Package | Status |
| --- | --- | --- |
| macOS 11+ on Apple Silicon | `aarch64` DMG | Supported; ad-hoc signed unless release credentials are configured |
| macOS 11+ on Intel | `x86_64` DMG | Supported; ad-hoc signed unless release credentials are configured |
| Windows 10/11 x64 | NSIS `.exe`, MSI | Supported; WebView2 is downloaded by the installer when missing |
| Linux x64 | AppImage, Debian `.deb` | Supported build target; Ubuntu 22.04 is the packaging baseline |
| Linux ARM64 | AppImage, Debian `.deb` | Experimental; built natively and architecture-checked in CI |

Package filenames include the application version, operating system, and architecture. There is no universal macOS build; keeping the two native DMGs separate makes signing and failures easier to diagnose.

### Installation

- **macOS:** open the architecture-matching DMG and drag OpenPDF to Applications. Ad-hoc signing is not Apple notarization. For an unsigned/unnotarized community build, macOS may require approval in System Settings → Privacy & Security. Only releases built with the optional Apple secrets are Developer ID signed and notarized.
- **Windows:** run the NSIS installer (recommended) or MSI. The default current-user install supports normal uninstall through Windows Settings. Unsigned releases can trigger Microsoft SmartScreen; review the GitHub release source before choosing “Run anyway.”
- **Linux:** install the `.deb` with your package manager, or mark the AppImage executable and run it. AppImage portability is limited by glibc, WebKitGTK integration, FUSE availability, GPU drivers, and distribution policy; it is not claimed to work on every distribution.

## What works

- Native file dialogs, drag-and-drop, password entry, multiple document tabs, unsaved-state tracking, and safe local saving
- High-DPI, lazy, multi-page PDF rendering; selectable text; search; zoom and fit modes; thumbnails and page navigation
- Editable text, PNG/JPEG images, shapes, ink, signatures, highlights, underlines, comments, and labelled visual redaction covers
- Object selection, move, resize, property editing, delete, undo, and redo
- Page insertion, deletion, duplication, rotation, reordering, merge, extraction, and range-based splitting
- Common AcroForm text, checkbox, radio, and choice fields when exposed compatibly by the source PDF
- Standard PDF export with original vector pages preserved and added content embedded

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for precise limits. OpenPDF 0.1 does not rewrite existing text operators, securely remove existing content, preserve an editable project after export, or support every encrypted/malformed PDF.

## Contributor quick start

Install Node.js 22+, Rust 1.90+, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for the host OS.

```sh
npm ci
npm run fixtures
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run tauri dev
```

Native release builds are platform-specific. See [DEVELOPMENT.md](DEVELOPMENT.md) for build commands and [RELEASE.md](RELEASE.md) for the release checklist.

## Keyboard shortcuts

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Open | `Command+O` | `Ctrl+O` |
| Save / Save As | `Command+S` / `Shift+Command+S` | `Ctrl+S` / `Shift+Ctrl+S` |
| Undo / redo | `Command+Z` / `Shift+Command+Z` | `Ctrl+Z` / `Ctrl+Y` |
| Delete selected object | `Delete` or `Backspace` | `Delete` or `Backspace` |
| Select, text, image | `V`, `T`, `I` | `V`, `T`, `I` |
| Highlight, underline | `H`, `U` | `H`, `U` |
| Rectangle, ellipse, line | `R`, `O`, `L` | `R`, `O`, `L` |
| Draw, erase, signature, comment | `D`, `E`, `G`, `C` | `D`, `E`, `G`, `C` |

## Privacy and security

The main window receives only core Tauri and native dialog capabilities. It has no broad frontend filesystem permission. Rust commands restrict reads to PDF/PNG/JPEG and writes to PDF. Saves are flushed to a temporary file beside the destination, then replaced atomically with Unix rename or Windows `ReplaceFileW`. PDF.js workers are bundled locally, and embedded PDF JavaScript is not requested or executed.

Untrusted PDFs remain a parser attack surface. Keep Tauri, PDF.js, WebKit/WebView2, and Rust dependencies current and treat security updates as release blockers.

## License

OpenPDF source is provided under the MIT license. Third-party packages retain their respective licenses.

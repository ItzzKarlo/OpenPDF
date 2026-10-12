# OpenPDF

OpenPDF is a free, offline-first desktop PDF editor built with Tauri 2, Rust, React, TypeScript, PDF.js, and pdf-lib. Documents stay on the local computer: the application has no account system, telemetry, cloud storage, or network-backed document processing.

## What works

- Native file dialogs, drag-and-drop, password entry, multiple document tabs, unsaved-state tracking, and safe local saving
- High-DPI, lazy, multi-page PDF rendering; selectable/copyable text; document search; zoom and fit modes; thumbnails and page navigation
- Editable document-space objects: text, PNG/JPEG images, rectangles, ellipses, lines, ink, signatures, highlight, underline, comments, and clearly labelled visual redaction covers
- Object selection, move, resize, rotate/property editing, delete, undo, and redo
- Blank-page insertion, deletion, duplication, rotation, drag reorder, PDF merge, selected-page extraction, and range-based splitting
- AcroForm detection and ordinary text/checkbox/radio/choice value editing when the source PDF exposes compatible fields
- Real PDF export with original vector content preserved through page copying and added text/images/shapes embedded into the output
- Light/dark appearance, resizable side panels, and keyboard shortcuts

See [FEATURE_STATUS.md](FEATURE_STATUS.md) for precise limitations. In particular, OpenPDF 0.1 does not claim to rewrite existing text operators or securely remove existing content.

## Quick start

Prerequisites: Node.js 22 or newer, Rust 1.90 or newer, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system.

```sh
npm install
npm run fixtures
npm test
npm run tauri dev
```

For a browser-only development shell, run `npm run dev`. Native file paths and atomic writes require the Tauri build.

## Build

```sh
npm run build
npm run tauri build -- --bundles app,dmg
```

On Apple Silicon this produces an `.app` and `.dmg` below `src-tauri/target/release/bundle/`. Cross-platform details are in [DEVELOPMENT.md](DEVELOPMENT.md).

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Open | `⌘/Ctrl O` |
| Save / Save As | `⌘/Ctrl S` / `⇧⌘/Ctrl S` |
| Undo / redo | `⌘/Ctrl Z` / `⇧⌘/Ctrl Z` |
| Delete selected object | `Delete` or `Backspace` |
| Select, text, image | `V`, `T`, `I` |
| Highlight, underline | `H`, `U` |
| Rectangle, ellipse, line | `R`, `O`, `L` |
| Draw, erase, signature, comment | `D`, `E`, `G`, `C` |

## Privacy and security

The Tauri capability file grants the main window only core defaults and native open/save/message dialogs. Arbitrary frontend filesystem access is not enabled. Binary reads and PDF writes pass through narrow Rust commands which validate extensions. Writes use a temporary file in the destination directory, flush it, and atomically replace the destination where the platform supports it. PDF.js JavaScript actions are never requested or executed.

Untrusted PDFs remain a parser attack surface. Keep Tauri/WebKit, PDF.js, and Rust dependencies current and treat security updates as release blockers.

## License

OpenPDF source is provided under the MIT license. Third-party packages retain their respective licenses.

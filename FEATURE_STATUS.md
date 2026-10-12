# Feature status — 0.1.0

| Area | Status | Notes |
| --- | --- | --- |
| Local open/drop and tabs | Complete | Native picker, multi-select, browser fallback, Tauri and browser drop paths |
| Multi-page viewer | Complete | Lazy activation, high-DPI canvases, zoom, fit width/page, navigation |
| Text selection/search | Complete | PDF.js extraction and selectable text layer; page-level search results |
| Password loading | Partial | PDF.js can view supported encryption; pdf-lib cannot export every encrypted input |
| Thumbnails | Complete | Rendered source previews and blank-page previews |
| Text/image/shapes/ink/signature | Complete | Structured objects, move/resize, properties, delete, undo/redo, embedded on export |
| Highlight/underline/comments | Overlay implementation | Exported as visible PDF content, not native annotation dictionaries |
| Visual redaction cover | Limited by design | Visible black cover only; underlying content is not securely removed |
| Existing text/image editing | Unsupported | Genuine source operator/resource rewriting awaits a native content engine |
| Page operations | Complete | Insert, delete, duplicate, rotate, reorder, merge, split, and extract while preserving vector source pages |
| Forms | Partial | Common fields work; XFA, signatures, malformed forms, and some structural rebuilds are unsupported |
| Save As / PDF export | Complete | Standard PDF, selectable source text, embedded edits, platform-safe native write path |
| Editable project persistence | Planned | Standard PDF reopen treats exported overlays as source content |
| Unsaved close protection | Complete | Per-tab confirmation plus webview unload guard |
| Keyboard/window behavior | Cross-platform | Native decorations on Windows/Linux, macOS overlay, platform-correct primary modifiers |
| macOS packages | Configured | Separate Apple Silicon and Intel DMGs; ad-hoc signing by default, optional Developer ID/notarization |
| Windows packages | Configured | NSIS current-user installer and MSI, WebView2 bootstrapper, optional Authenticode secrets |
| Linux x64 packages | Configured | Ubuntu 22.04-built AppImage and Debian package; package architecture checked |
| Linux ARM64 packages | Experimental | Native ARM64 GitHub runner; AppImage and Debian package architecture checked |

## Validation boundaries

Every CI target runs PDF engine tests that load the checked-in fixture, add an edit, export it, save it, and reopen the result. Rust tests cover the native replacement path. CI then compiles and briefly starts the platform executable. Release jobs additionally verify package presence and binary/package architecture.

These checks are build and headless-runtime verification, not full human GUI acceptance. Native file-picker behavior, installer/uninstaller UX, Gatekeeper/SmartScreen prompts, printing, accessibility, GPU-specific rendering, and broad Linux distribution compatibility still require manual testing on real machines.

## Non-claims

OpenPDF 0.1 does not call a rectangle “existing text editing” or “secure redaction.” It does not rasterize full pages to simulate modifications. Existing source content remains selectable whenever the input and page-copy path permit it. An ad-hoc signed macOS artifact is not notarized, and an unsigned Windows artifact is not SmartScreen-trusted.

## Next release priorities

1. Add an editable `.openpdf` project container with source hashes and migrations.
2. Prototype source operator and resource replacement behind `DocumentContentEngine`.
3. Add native annotation dictionaries and secure content redaction.
4. Preserve complete AcroForm trees during arbitrary merge/reorder operations.
5. Expand real-machine installation and accessibility coverage.

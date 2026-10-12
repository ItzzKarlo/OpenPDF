# Development

## Requirements

- Node.js 22+ and npm 11+
- Rust 1.90+
- macOS: Xcode Command Line Tools
- Windows: Microsoft C++ Build Tools and WebView2
- Linux: the WebKitGTK and system libraries listed in the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Commands

```sh
npm install              # install pinned frontend tooling
npm run fixtures         # regenerate deterministic sample and form PDFs
npm run dev              # webview UI only
npm run tauri dev        # complete desktop development build
npm run typecheck
npm run lint
npm test
npm run test:e2e         # install Playwright Chromium first if needed
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## macOS Apple Silicon release

```sh
rustup target add aarch64-apple-darwin
npm ci
npm run tauri build -- --target aarch64-apple-darwin --bundles app,dmg
```

Artifacts are written to `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/` and `.../dmg/`. An unsigned local build can be opened for testing. Public distribution requires an Apple Developer ID certificate, hardened runtime signing, notarization, and stapling; configure those through Tauri’s macOS bundle settings and CI secrets rather than committing credentials.

For Intel macOS use `x86_64-apple-darwin`. Build both targets and combine native sidecars only if a universal application is required. The TypeScript application is architecture-neutral.

## Windows and Linux

Use `npm run tauri build` on the target OS. Tauri is configured for MSI on Windows and DEB/AppImage on Linux. The Rust safe-write implementation uses atomic rename on Unix; Windows uses a recoverable backup/rename sequence because replacing an existing file has different semantics.

## Tests

Unit tests cover all rotations and multiple zoom levels, page operations and ranges, undo/redo, dirty transitions, and vector PDF export/reopen. `scripts/generate-samples.mjs` creates a three-page source document and a two-field AcroForm at `tests/fixtures/`.

The Playwright smoke test verifies the startup shell and privacy copy. More document UI scenarios should be run against the Tauri driver in CI; browser tests cannot exercise native dialogs or Rust writes.

## Adding an editing tool

1. Add its discriminated model to `src/types/document.ts`.
2. Store only PDF-point coordinates.
3. Add its interactive overlay to `PageCanvas.tsx`.
4. Add exporter behavior to `PdfExporter.ts` without rasterizing the page.
5. Expose meaningful inspector properties and add undo/export tests.

## Dependency and security policy

Use stable Tauri 2 releases, audit npm and Cargo changes, and avoid introducing network clients or broad filesystem permissions. Do not add AGPL libraries—including MuPDF—without an explicit licensing decision documented for the entire product.

# Development

## Requirements

- Node.js 22+ and npm 11+
- Rust 1.90+
- macOS: Xcode Command Line Tools
- Windows: Microsoft C++ Build Tools. Windows 10/11 normally includes WebView2; the packaged installer downloads the evergreen bootstrapper when it is absent.
- Debian/Ubuntu Linux: `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libfuse2 xdg-utils`

Use `npm ci` for reproducible installs. The lockfiles for npm and Cargo are committed.

## Validation commands

```sh
npm ci
npm run fixtures            # regenerate deterministic sample and form PDFs
npm run typecheck
npm run lint
npm test                    # includes fixture open/edit/export/save/reopen
npx playwright install chromium
npm run test:e2e            # browser rendering/search smoke tests
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml -- -D warnings
npm run tauri dev
```

Browser tests exercise the platform-neutral PDF workflow but cannot test native dialogs. Rust tests exercise extension validation and the platform save/replace path. CI also compiles and starts the actual Tauri executable on each target. A headless startup smoke test proves that the process initializes and stays alive; it is not a substitute for manual GUI acceptance testing.

## Native builds

Build each package on its native OS. Platform overrides live in `src-tauri/tauri.macos.conf.json`, `tauri.windows.conf.json`, and `tauri.linux.conf.json`; Tauri merges the applicable file automatically.

```sh
# macOS Apple Silicon
rustup target add aarch64-apple-darwin
npm run tauri build -- --target aarch64-apple-darwin --bundles dmg

# macOS Intel, on an Intel runner/host
rustup target add x86_64-apple-darwin
npm run tauri build -- --target x86_64-apple-darwin --bundles dmg

# Windows x64, in PowerShell
rustup target add x86_64-pc-windows-msvc
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis,msi

# Linux x64
rustup target add x86_64-unknown-linux-gnu
npm run tauri build -- --target x86_64-unknown-linux-gnu --bundles deb,appimage

# Linux ARM64 on an ARM64 Linux host
rustup target add aarch64-unknown-linux-gnu
npm run tauri build -- --target aarch64-unknown-linux-gnu --bundles deb,appimage
```

Artifacts are below `src-tauri/target/<target>/release/bundle/`. Run `node scripts/verify-bundles.mjs <target>` after a packaged build. It validates executable and AppImage headers, required installer types, Debian architecture metadata, and the macOS app signature.

The Linux packages are built on Ubuntu 22.04 because a newer glibc baseline reduces portability. This still does not guarantee every distribution: validate representative Debian/Ubuntu, Fedora-family, and AppImage environments before expanding support claims.

## Platform compatibility notes

- The base window uses native decorations. Only the macOS override enables the overlay title bar and traffic-light placement.
- Shortcuts use Command on Apple platforms and Control on Windows/Linux; Windows/Linux redo also supports `Ctrl+Y`.
- Paths are passed as native strings to Rust. Display names recognize both slash styles, extensions are case-insensitive, and no drive letter or home-directory layout is assumed.
- PDF.js loads its worker through Vite’s local asset pipeline. The production CSP permits self/blob workers but no remote worker CDN.
- CSS uses system font fallbacks (`-apple-system`, `Segoe UI`, generic sans-serif). Exported text uses PDF standard fonts, so it does not depend on host font installation.
- Unix saves preserve existing file permissions before atomic rename. Windows uses `ReplaceFileW` with write-through semantics so an existing destination is not deleted before replacement.

## Adding an editing tool

1. Add its discriminated model to `src/types/document.ts`.
2. Store only PDF-point coordinates.
3. Add its interactive overlay to `PageCanvas.tsx`.
4. Add exporter behavior to `PdfExporter.ts` without rasterizing the page.
5. Expose meaningful inspector properties and add undo/export tests.

## Dependency and security policy

Use stable Tauri 2 releases, audit npm and Cargo changes, and avoid network clients or broad filesystem permissions. Do not add AGPL libraries—including MuPDF—without an explicit licensing decision for the whole product.

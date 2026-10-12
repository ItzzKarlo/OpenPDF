# Architecture

## Layering

```text
React components
  ├─ Zustand application/document state
  ├─ PDF.js adapter (read, render, text, search, forms)
  ├─ document-content engine interface (future source rewriting)
  └─ pdf-lib exporter (page composition and edit embedding)
       └─ Tauri Rust commands (validated reads and safe atomic writes)
```

The UI never treats canvas pixels as the document model. Edit objects use PDF points in the unrotated page coordinate system, with a bottom-left origin. `coordinates.ts` is the sole conversion boundary between PDF space and zoomed/rotated viewport space. Device pixel ratio only affects the backing canvas and never stored coordinates.

## Four content concepts

1. **Original content** — immutable source bytes in `SourceDocument`. PDF.js renders and extracts them.
2. **User-created objects** — structured `EditObject` values in Zustand. They remain independently selectable during the open editing session.
3. **Native annotations/forms** — existing source annotations remain in original PDFs where pdf-lib can preserve them; AcroForm widget annotations are detected through PDF.js and values are applied through pdf-lib.
4. **Exported content** — pdf-lib copies original pages without rasterization, applies page order/rotation, then embeds edit objects in a standard PDF.

Snapshots contain pages, edits, and form values. Every document mutation first records a bounded snapshot for undo. Dirty state is a deterministic comparison with the last saved snapshot; selection and viewport state do not make a document dirty.

## Engines

`DocumentContentEngine` is the future-facing contract for source-level extraction, text/image replacement, and secure redaction. The current `PdfJsAdapter` truthfully advertises extraction only. The exporter is separately replaceable and accepts the engine-neutral document model.

PDF.js documents and render tasks are cached/cancelled by source. Page canvases are activated with `IntersectionObserver` and use a bounded device-pixel ratio for high-DPI output without unbounded memory growth.

## Export behavior

If page identity/order is unchanged, export loads the original document directly, preserving its catalog and forms as far as pdf-lib supports. If pages were inserted, removed, duplicated, reordered, or merged, a new PDF is assembled by copying source page objects. New content is drawn as PDF operators; source pages are never converted into images.

The current standard-PDF save is the durable output. Structured overlay editability lasts for the open application session; after reopening an exported PDF, embedded overlays are ordinary source content. A future `.openpdf` project container may retain the edit graph alongside immutable sources.

## Security boundary

- No network API is used for documents.
- The webview receives no general filesystem capability.
- Rust reads only `.pdf`, `.png`, `.jpg`, and `.jpeg`; writes only `.pdf`.
- Safe writes occur beside the destination and are flushed before replacement.
- Embedded PDF JavaScript is not evaluated or dispatched.
- CSP limits sources to application assets, local IPC, data/blob images, and the PDF.js worker.

## Native content-engine research

- **MuPDF** has strong parsing, editing, annotation, and redaction capabilities, but its open-source distribution is AGPL; Artifex explicitly requires a commercial license for non-AGPL product embedding. It is not included. See [MuPDF releases and licensing](https://mupdf.com/releases).
- **PDFium** uses a permissive BSD-style base license plus third-party notices. Its supported public C API is deliberately narrower than Chromium internals, and source-operator rewriting would require careful work beyond the stable embedder surface. See the [PDFium license](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/LICENSE) and [embedding guidance](https://pdfium.googlesource.com/pdfium/+/refs/heads/main/README.md#embedding-pdfium-in-your-own-projects).
- **PoDoFo** is a C++17 manipulation library under LGPL-2.0-or-later or MPL-2.0 for the library (tools are GPL). It is the most plausible next prototype for object-stream/resource edits, but font subsetting, text reflow, and cross-platform packaging need a dedicated spike. See [PoDoFo licensing](https://github.com/podofo/podofo/blob/master/README.md#licensing).

Recommended next step: prototype a Rust/C++ bridge behind `DocumentContentEngine`, beginning with content-stream token replacement plus font/resource validation in PoDoFo. Evaluate PDFium separately for hardened parsing/rendering. MuPDF must not enter the dependency graph unless the whole distribution accepts AGPL obligations or obtains a commercial license.

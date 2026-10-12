# Feature status — 0.1.0

| Area | Status | Notes |
| --- | --- | --- |
| Local open/drop and tabs | Complete | Native picker, multi-select, browser fallback, Tauri and browser drop paths |
| Multi-page viewer | Complete | Lazy activation, Retina backing canvases, zoom, fit width/page, navigation |
| Text selection/search | Complete | PDF.js extraction and transparent selectable text layer; page-level search results |
| Password loading | Partial | Password-protected PDFs can be viewed when PDF.js supports their encryption; pdf-lib cannot export every encrypted input |
| Thumbnails | Complete | Rendered source previews and blank-page previews |
| Text/image/shapes/ink/signature | Complete | Structured objects, move/resize, properties, delete, undo/redo, embedded on export |
| Highlight/underline/comments | Complete as editable overlays | Exported as visible PDF content, not authored as new native annotation dictionaries |
| Visual redaction cover | Limited by design | A black exported cover only. It is prominently labelled **not secure** and does not remove underlying operators |
| Existing text/image editing | Unsupported | Extraction and selection exist; genuine operator/resource rewriting awaits a native content engine |
| Page insert/delete/duplicate/rotate/reorder | Complete | Source pages remain vector content |
| Merge | Complete | Appends one or more PDFs as page sources |
| Split/extract | Complete | Page-range split export and selected-thumbnail extraction |
| Forms | Partial | Detect/fill common AcroForm widgets and preserve values on ordinary saves; XFA, signatures, and some malformed forms are unsupported; structural page rebuilds may not preserve full form trees |
| Save As / PDF export | Complete | Valid ordinary PDF, selectable source text preserved, edit objects embedded, safe Rust write path |
| Editable project persistence | Planned | Edit graph remains editable during the open session; standard PDF reopen treats exported overlays as source content |
| Unsaved close protection | Complete | Per-tab confirmation plus browser/webview unload guard |
| Light/dark and panel resizing | Complete | Platform-neutral macOS-inspired shell |
| macOS packaging | Configured | `.app` and `.dmg`; signing/notarization credentials are release-operator concerns |

## Non-claims

OpenPDF 0.1 does not call a white/black rectangle “text editing” or “secure redaction.” It does not rasterize full pages to simulate modifications. Existing source content remains selectable whenever the source PDF and page-copy path permit it.

## Next release priorities

1. Add an editable `.openpdf` project container with source hashes and migration/versioning.
2. Prototype PoDoFo-backed source operator and resource replacement behind `DocumentContentEngine`.
3. Add true annotation dictionary authoring and secure content redaction.
4. Preserve complete AcroForm trees during arbitrary merge/reorder operations.
5. Add signed/notarized CI artifacts and a corpus/fuzzing pipeline for hostile PDFs.

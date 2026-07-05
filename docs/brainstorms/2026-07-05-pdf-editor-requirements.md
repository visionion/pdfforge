# PDF Editor / Builder — Requirements

**Date:** 2026-07-05
**Status:** Brainstorm complete → planning
**Owner:** Vaibhav

## What we're building

A **100% client-side, browser-based PDF editor and builder** hosted as a static site at a subdomain of `visionion.dev` (GitHub Pages + CNAME, matching the existing `*-site` deploy pattern). No backend, no uploads — every PDF is opened, edited, OCR'd, and saved entirely in the user's browser. The wedge is **privacy + no limits**: files never leave the device, no signup, no watermark, no per-day task cap, no file-size cap that a server would impose.

The flagship is a **full editor** (the differentiator: genuinely edit existing PDF text, plus annotate, sign, form-fill, build from scratch). Single-purpose **tool landing pages** (merge, split, compress, rotate, convert, OCR…) are thin wrappers over the same engine, added later as SEO satellites once the engine exists.

## Why (problem & positioning)

- The free PDF-tool category (iLovePDF, Smallpdf, Sejda, Adobe online) is enormous but almost all incumbents **upload your file to a server**, gate free usage (Sejda: 3 tasks/day, size caps), and watermark or require signup for the good stuff.
- Their server dependency is structural — their business needs it — so **"nothing leaves your browser" is a positioning they can't easily copy.**
- What earns word-of-mouth (Product Hunt / HN / Reddit — our realistic near-term channels, since a fresh subdomain has ~zero SEO authority) is a *remarkable single app with a story*, not a suite of me-too pages. The story here: **a free, private, unlimited PDF editor that actually edits text.**

## Users & primary job

- **Primary actor:** anyone who needs to edit/assemble a PDF and is uncomfortable uploading it (contracts, IDs, medical/financial docs) or is tired of paywalls and watermarks.
- **Core outcome:** open a PDF (or start blank), make the change they need, download the result — without an account, an upload, or a watermark.

## Scope — v1 capabilities ("all functionalities")

The user's directive is the full feature set. Grouped by engine capability:

**Page operations**
- Merge multiple PDFs; split by range/every-N/bookmarks; extract pages; delete/duplicate pages; reorder (drag); rotate; insert blank pages; insert pages from another PDF.

**Content editing**
- Edit existing text (extract, modify, re-lay); add text boxes with font/size/color; whiteout/redact regions; add/replace/move/resize images; draw shapes and freehand ink; add/edit links.

**Annotation & markup**
- Highlight, underline, strikethrough; sticky notes/comments; freehand pen; shapes; text callouts; measuring/eyedropper optional-later.

**Forms & signing**
- Fill existing AcroForm fields; flatten forms; draw/type/upload signature; place signature + date; (advanced: create form fields — later).

**Build from scratch**
- Blank canvas → add pages, text, images, shapes → export as PDF. Import images (PNG/JPG) → PDF. Basic "print to PDF" style assembly.

**Convert**
- Images ↔ PDF; PDF page → image (PNG/JPG) export. (Office/HTML→PDF and PDF→Word are deep — later.)

**Compress / optimize**
- Downsample images, strip metadata, re-encode to reduce size.

**OCR**
- Run OCR on scanned/image PDFs to produce a searchable text layer and/or extract text. Client-side (Tesseract.js / WASM). Multi-language support where feasible. This is the marquee "even OCR" feature.

**Security & metadata**
- Password-protect / decrypt (where client crypto allows); edit document metadata; flatten; remove metadata.

**Quality-of-life**
- Undo/redo, zoom, thumbnails sidebar, keyboard shortcuts, dark mode, drag-drop open, autosave to local storage, works offline (PWA).

## Scope boundaries

**In v1:** everything above delivered in the flagship editor, prioritized so the hardest, most differentiating pieces (edit-existing-text, sign, OCR) are proven first.

**Deferred (satellites, post-v1):** individual SEO tool pages per operation; PDF→Word/Excel structured conversion; Office/HTML→PDF; collaborative/multi-user; cloud sync; e-signature legal audit trails; AcroForm *authoring*; batch/queue processing UI.

**Outside this product's identity:** anything requiring a server round-trip for the core edit path (would break the privacy wedge); accounts/login for core use; watermarks; AI features (per portfolio convention, this tool has no AI).

## Success criteria

- A user can open an existing PDF, edit its text, sign it, and download — all offline, no upload, no watermark.
- OCR turns a scanned PDF into selectable/searchable text in-browser.
- Handles a realistically large file (e.g. 50–100+ pages) without crashing the tab.
- Launch-ready story: "free, private, unlimited, no-signup PDF editor" is literally true.
- Ships as a static site on a `visionion.dev` subdomain with SEO basics (canonical, OG, JSON-LD `SoftwareApplication`) per convention.

## Key risks / unknowns (for planning to resolve)

- **Editing existing PDF text is the hard problem** — font embedding/subsetting, text reflow, matching original fonts. Likely needs a hybrid (pdf.js for render/extract + pdf-lib for write) and may fall back to "whiteout + retype" when true in-place edit isn't safe. Planning must define the realistic fidelity bar.
- **Library stack:** pdf.js (render/parse), pdf-lib (create/modify/forms), Tesseract.js (OCR), fontkit (fonts), possibly a WASM tool (mupdf/qpdf/Ghostscript-WASM) for compression/repair. Trade-offs are a planning decision.
- **Bundle size / load time** with WASM (Tesseract, fonts) — lazy-load per feature; PWA caching.
- **Encryption/decryption** limits of pure-JS crypto for protected PDFs.
- **Performance** on very large PDFs in a single tab (workers, streaming).
- **Subdomain name** not yet chosen.

## Open questions

- Product/subdomain name.
- Which 3 capabilities are "must be flawless at launch" vs "present but rough is OK" (user said all; planning should still sequence).
- Monetization deferred (traffic play first) — revisit after launch.

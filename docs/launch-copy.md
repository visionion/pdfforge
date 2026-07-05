# pdfforge — launch copy

Positioning: a **free, 100% private PDF editor** that runs entirely in the browser. Files never leave the device — no upload, no signup, no watermark, no limits. The privacy angle is the wedge server-based competitors can't match.

Live at: https://editpdf.visionion.dev

## Product Hunt

**Tagline:** A free, private PDF editor that never uploads your files

**Description:**
pdfforge is a powerful PDF editor and builder that runs 100% in your browser. Edit text, annotate, fill & sign forms, merge/split/rotate pages, OCR scanned documents into searchable text, build PDFs from scratch, compress, redact, and edit metadata — all without uploading a single file.

Most "free" PDF tools send your documents to a server, cap your usage, and stamp a watermark. pdfforge does none of that: your files are opened, edited and saved on your device. No account, no watermark, no daily limits. Install it and it works offline.

**First comment:** I built pdfforge because every free PDF tool either uploads your files or watermarks the output. This one does everything locally — contracts, IDs, medical forms never leave your machine. Would love feedback on the text-editing and OCR.

## Hacker News (Show HN)

**Title:** Show HN: pdfforge – a private, in-browser PDF editor (no uploads)

**Body:**
pdfforge is a PDF editor that does everything client-side — editing text, annotating, signing, merging/splitting, OCR (Tesseract.js), converting to/from images, compressing and redacting — with no server round-trip. Your PDF never leaves the browser.

Stack: pdf.js for rendering, pdf-lib for writing, Konva for the annotation overlay, Tesseract.js for OCR. All permissively licensed. It's a static site (GitHub Pages) and installs as a PWA for offline use.

The hard part was editing existing text: there's no reliable way to do true content-stream text replacement in the browser, so it uses whiteout-and-retype driven by pdf.js text geometry. Redaction rasterizes the page so covered text can't be recovered.

Happy to answer questions about the approach.

## Reddit (r/privacy, r/software, r/pdf)

Made a free PDF editor that never uploads your files — everything runs in your browser (editing, signing, OCR, merge/split, redaction). No account, no watermark, no limits. Would appreciate a look: https://editpdf.visionion.dev

## X / short

Tired of PDF tools that upload your files and slap on a watermark? pdfforge edits, signs, OCRs and merges PDFs 100% in your browser. Nothing leaves your device. Free, no signup. → editpdf.visionion.dev

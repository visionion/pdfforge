# pdfforge

A powerful, 100% client-side PDF editor and builder that runs entirely in your browser — no uploads, no signup, no watermark. Served at [editpdf.visionion.dev](https://editpdf.visionion.dev).

Your files never leave your device. Edit text, annotate, fill & sign forms, merge/split pages, OCR scanned documents, build PDFs from scratch, compress, and more — all processed locally in-browser.

## Status

Early development. See the implementation plan for the full feature roadmap.

## Stack

- **Build:** Vite + TypeScript (PWA)
- **Render/parse:** pdf.js
- **Build/modify/export:** pdf-lib + fontkit
- **Annotation overlay:** Konva
- **OCR:** PP-OCRv6 (primary) + Tesseract.js (fallback)
- **Deploy:** static site on GitHub Pages

All dependencies are permissively licensed (Apache/MIT); AGPL engines are excluded by design.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm test         # unit tests (Vitest)
```

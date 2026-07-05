import { PDFDocument, StandardFonts, degrees, type PDFPage } from 'pdf-lib';
import type { PageModel } from '../doc/ops';
import { type AnnotationModel, annotationsForPage } from '../overlay/annotations';
import { drawAnnotation } from './annotations';

export type SourceBytes = ArrayBuffer | Uint8Array;

/** A page flattened to a PNG raster (used to guarantee redaction removes text). */
export interface RasterPage {
  readonly bytes: Uint8Array;
  readonly widthPts: number;
  readonly heightPts: number;
}

export interface ExportOptions {
  annotations?: AnnotationModel;
  /** Per-slot (by PageRef id) rasterized replacements — e.g. redacted pages. */
  rasters?: Map<string, RasterPage>;
}

/**
 * Bake a page model into output PDF bytes via pdf-lib. Pages are copied from
 * their sources (or replaced by a raster for redacted pages), rotation is
 * applied, and each slot's annotations are drawn on top. Fully in-browser.
 */
export async function exportPdf(
  model: PageModel,
  sources: Map<string, SourceBytes>,
  options: ExportOptions = {},
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();
  const annotations = options.annotations ?? [];
  const rasters = options.rasters ?? new Map<string, RasterPage>();
  const font = await out.embedFont(StandardFonts.Helvetica);

  async function source(id: string): Promise<PDFDocument> {
    const cached = loaded.get(id);
    if (cached) return cached;
    const bytes = sources.get(id);
    if (!bytes) throw new Error(`Missing source bytes for "${id}"`);
    const doc = await PDFDocument.load(bytes);
    loaded.set(id, doc);
    return doc;
  }

  async function drawFor(pageId: string, page: PDFPage): Promise<void> {
    for (const ann of annotationsForPage(annotations, pageId)) await drawAnnotation(out, page, ann, font);
  }

  for (const ref of model) {
    const raster = rasters.get(ref.id);
    if (raster && !ref.blank) {
      // Redacted page: place the flattened raster (no extractable text remains).
      const img = await out.embedPng(raster.bytes);
      const page = out.addPage([raster.widthPts, raster.heightPts]);
      page.drawImage(img, { x: 0, y: 0, width: raster.widthPts, height: raster.heightPts });
      if (ref.rotation) page.setRotation(degrees(ref.rotation));
      await drawFor(ref.id, page);
      continue;
    }
    if (ref.blank) {
      const page = out.addPage([ref.blank.width, ref.blank.height]);
      if (ref.rotation) page.setRotation(degrees(ref.rotation));
      await drawFor(ref.id, page);
      continue;
    }
    if (ref.sourceId === undefined || ref.sourceIndex === undefined) {
      throw new Error('Page ref has neither a source nor a blank spec');
    }
    const src = await source(ref.sourceId);
    const [copied] = await out.copyPages(src, [ref.sourceIndex]);
    if (ref.rotation) {
      const existing = copied.getRotation().angle;
      copied.setRotation(degrees((existing + ref.rotation) % 360));
    }
    out.addPage(copied);
    await drawFor(ref.id, copied);
  }

  return out.save();
}

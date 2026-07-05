import { PDFDocument, StandardFonts, degrees, type PDFPage } from 'pdf-lib';
import type { PageModel } from '../doc/ops';
import { type AnnotationModel, annotationsForPage } from '../overlay/annotations';
import { drawAnnotation } from './annotations';

export type SourceBytes = ArrayBuffer | Uint8Array;

export interface ExportOptions {
  annotations?: AnnotationModel;
}

/**
 * Bake a page model into output PDF bytes via pdf-lib. Pages are copied from
 * their source documents in model order, blank slots are created fresh, the
 * per-slot rotation is added to the source page's own rotation, and each slot's
 * annotations are drawn on top. Everything runs in-browser; nothing is uploaded.
 */
export async function exportPdf(
  model: PageModel,
  sources: Map<string, SourceBytes>,
  options: ExportOptions = {},
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();
  const annotations = options.annotations ?? [];
  const font = annotations.length ? await out.embedFont(StandardFonts.Helvetica) : null;

  async function source(id: string): Promise<PDFDocument> {
    const cached = loaded.get(id);
    if (cached) return cached;
    const bytes = sources.get(id);
    if (!bytes) throw new Error(`Missing source bytes for "${id}"`);
    const doc = await PDFDocument.load(bytes);
    loaded.set(id, doc);
    return doc;
  }

  function drawFor(pageId: string, page: PDFPage): void {
    if (!font) return;
    for (const ann of annotationsForPage(annotations, pageId)) drawAnnotation(page, ann, font);
  }

  for (const ref of model) {
    if (ref.blank) {
      const page = out.addPage([ref.blank.width, ref.blank.height]);
      if (ref.rotation) page.setRotation(degrees(ref.rotation));
      drawFor(ref.id, page);
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
    drawFor(ref.id, copied);
  }

  return out.save();
}

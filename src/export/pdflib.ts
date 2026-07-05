import { PDFDocument, degrees } from 'pdf-lib';
import type { PageModel } from '../doc/ops';

export type SourceBytes = ArrayBuffer | Uint8Array;

/**
 * Bake a page model into output PDF bytes via pdf-lib. Pages are copied from
 * their source documents in model order, blank slots are created fresh, and the
 * per-slot rotation is added to the source page's own rotation. Everything runs
 * in-browser; nothing is uploaded.
 */
export async function exportPdf(
  model: PageModel,
  sources: Map<string, SourceBytes>,
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();

  async function source(id: string): Promise<PDFDocument> {
    const cached = loaded.get(id);
    if (cached) return cached;
    const bytes = sources.get(id);
    if (!bytes) throw new Error(`Missing source bytes for "${id}"`);
    const doc = await PDFDocument.load(bytes);
    loaded.set(id, doc);
    return doc;
  }

  for (const ref of model) {
    if (ref.blank) {
      const page = out.addPage([ref.blank.width, ref.blank.height]);
      if (ref.rotation) page.setRotation(degrees(ref.rotation));
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
  }

  return out.save();
}

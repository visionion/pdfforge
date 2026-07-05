import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { exportPdf, type RasterPage } from '../../src/export/pdflib';
import { dataUrlToBytes } from '../../src/export/annotations';
import { modelFromSource, type PageModel } from '../../src/doc/ops';
import { pagesWithRedactions, type Annotation } from '../../src/overlay/annotations';

// 1x1 red PNG.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_DATAURL = `data:image/png;base64,${PNG_B64}`;

async function makeSource(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  return doc.save();
}

describe('objects export (images, links, redaction)', () => {
  it('embeds an image annotation', async () => {
    const sources = new Map([['main', await makeSource()]]);
    const model = modelFromSource('main', 1);
    const annotations: Annotation[] = [
      { id: 'img1', pageId: model[0].id, type: 'image', color: '#000', x: 20, y: 20, width: 80, height: 80, dataUrl: PNG_DATAURL, format: 'png' },
    ];
    const out = await exportPdf(model, sources, { annotations });
    const reparsed = await PDFDocument.load(out);
    expect(reparsed.getPageCount()).toBe(1);
  });

  it('adds a clickable link annotation to the page', async () => {
    const sources = new Map([['main', await makeSource()]]);
    const model = modelFromSource('main', 1);
    const annotations: Annotation[] = [
      { id: 'l1', pageId: model[0].id, type: 'link', color: '#000', x: 10, y: 10, width: 100, height: 14, url: 'https://example.com' },
    ];
    const out = await exportPdf(model, sources, { annotations });
    const reparsed = await PDFDocument.load(out);
    const annots = reparsed.getPage(0).node.Annots();
    expect(annots && annots.size()).toBeGreaterThanOrEqual(1);
  });

  it('pagesWithRedactions identifies redacted slots', () => {
    const model: PageModel = modelFromSource('main', 2);
    const anns: Annotation[] = [
      { id: 'r1', pageId: model[1].id, type: 'redact', color: '#000', x: 0, y: 0, width: 50, height: 20, strokeWidth: 0, fill: true },
    ];
    const set = pagesWithRedactions(anns);
    expect(set.has(model[1].id)).toBe(true);
    expect(set.has(model[0].id)).toBe(false);
  });

  it('replaces a redacted page with its raster (no source text survives)', async () => {
    const sources = new Map([['main', await makeSource()]]);
    const model = modelFromSource('main', 1);
    const raster: RasterPage = { bytes: dataUrlToBytes(PNG_DATAURL), widthPts: 300, heightPts: 400 };
    const rasters = new Map([[model[0].id, raster]]);
    const out = await exportPdf(model, sources, { rasters });
    const reparsed = await PDFDocument.load(out);
    expect(reparsed.getPageCount()).toBe(1);
    const size = reparsed.getPage(0).getSize();
    expect(Math.round(size.width)).toBe(300);
    expect(Math.round(size.height)).toBe(400);
  });
});

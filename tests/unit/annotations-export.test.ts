import { describe, it, expect } from 'vitest';
import { PDFDocument, rgb } from 'pdf-lib';
import { hexToRgb } from '../../src/export/annotations';
import { exportPdf } from '../../src/export/pdflib';
import { modelFromSource } from '../../src/doc/ops';
import type { Annotation } from '../../src/overlay/annotations';

async function makeSource(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  return doc.save();
}

describe('annotation export', () => {
  it('parses hex colors to pdf-lib rgb', () => {
    expect(hexToRgb('#ff0000')).toEqual(rgb(1, 0, 0));
    expect(hexToRgb('00ff00')).toEqual(rgb(0, 1, 0));
    expect(hexToRgb('bad')).toEqual(rgb(0, 0, 0)); // fallback
  });

  it('bakes annotations into the output and stays a valid, larger PDF', async () => {
    const sources = new Map([['main', await makeSource()]]);
    const model = modelFromSource('main', 1);
    const pageId = model[0].id;

    const plain = await exportPdf(model, sources);

    const annotations: Annotation[] = [
      { id: 'h1', pageId, type: 'highlight', color: '#ffeb3b', x: 20, y: 20, width: 100, height: 20, strokeWidth: 2, fill: true },
      { id: 'i1', pageId, type: 'ink', color: '#e53935', points: [10, 10, 40, 60, 80, 20], strokeWidth: 2 },
      { id: 'a1', pageId, type: 'arrow', color: '#111111', x1: 10, y1: 10, x2: 200, y2: 300, strokeWidth: 2 },
      { id: 't1', pageId, type: 'text', color: '#0000ff', x: 30, y: 350, text: 'Hello annotation', fontSize: 14 },
    ];
    const annotated = await exportPdf(model, sources, { annotations });

    // Still a single valid page, and drawing added content (bigger than plain).
    const reparsed = await PDFDocument.load(annotated);
    expect(reparsed.getPageCount()).toBe(1);
    expect(annotated.length).toBeGreaterThan(plain.length);
  });

  it('only draws annotations for pages that exist in the model', async () => {
    const sources = new Map([['main', await makeSource()]]);
    const model = modelFromSource('main', 1);
    const orphan: Annotation[] = [
      { id: 'o1', pageId: 'nonexistent', type: 'rect', color: '#ff0000', x: 0, y: 0, width: 10, height: 10, strokeWidth: 2, fill: false },
    ];
    const out = await exportPdf(model, sources, { annotations: orphan });
    const reparsed = await PDFDocument.load(out);
    expect(reparsed.getPageCount()).toBe(1); // no crash, orphan ignored
  });
});

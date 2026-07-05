import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { exportPdf } from '../../src/export/pdflib';
import {
  modelFromSource,
  deletePage,
  duplicatePage,
  rotatePage,
  movePage,
  insertBlankPage,
  mergeModels,
  splitEveryN,
} from '../../src/doc/ops';

/**
 * Build a source PDF whose pages have distinct widths, so page identity and
 * order survive into the exported bytes and can be asserted after re-parsing.
 * Page i has width 100 + i*10.
 */
async function makeSource(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([100 + i * 10, 200]);
  return doc.save();
}

async function exportedWidths(model: Parameters<typeof exportPdf>[0], sources: Map<string, Uint8Array>) {
  const bytes = await exportPdf(model, sources);
  const reparsed = await PDFDocument.load(bytes);
  return reparsed.getPages().map((p) => Math.round(p.getSize().width));
}

describe('export round-trip through pdf-lib', () => {
  it('Covers R2. merges two sources preserving order', async () => {
    const a = await makeSource(2); // widths 100,110
    const b = await makeSource(3); // widths 100,110,120
    const sources = new Map([
      ['a', a],
      ['b', b],
    ]);
    const model = mergeModels(modelFromSource('a', 2), modelFromSource('b', 3));
    expect(await exportedWidths(model, sources)).toEqual([100, 110, 100, 110, 120]);
  });

  it('deletes a page and keeps the rest in order', async () => {
    const sources = new Map([['main', await makeSource(3)]]); // 100,110,120
    const model = deletePage(modelFromSource('main', 3), 1);
    expect(await exportedWidths(model, sources)).toEqual([100, 120]);
  });

  it('reorders pages and the exported order matches', async () => {
    const sources = new Map([['main', await makeSource(3)]]);
    const model = movePage(modelFromSource('main', 3), 0, 2); // 110,120,100
    expect(await exportedWidths(model, sources)).toEqual([110, 120, 100]);
  });

  it('duplicates a page', async () => {
    const sources = new Map([['main', await makeSource(2)]]); // 100,110
    const model = duplicatePage(modelFromSource('main', 2), 0);
    expect(await exportedWidths(model, sources)).toEqual([100, 100, 110]);
  });

  it('inserts a blank page of the requested size', async () => {
    const sources = new Map([['main', await makeSource(1)]]); // 100
    const model = insertBlankPage(modelFromSource('main', 1), 1, { width: 555, height: 777 });
    const bytes = await exportPdf(model, sources);
    const reparsed = await PDFDocument.load(bytes);
    const sizes = reparsed.getPages().map((p) => Math.round(p.getSize().width));
    expect(sizes).toEqual([100, 555]);
  });

  it('applies rotation on top of the source page rotation', async () => {
    const sources = new Map([['main', await makeSource(1)]]);
    const model = rotatePage(modelFromSource('main', 1), 0, 90);
    const bytes = await exportPdf(model, sources);
    const reparsed = await PDFDocument.load(bytes);
    expect(reparsed.getPage(0).getRotation().angle).toBe(90);
  });

  it('splits into independent documents', async () => {
    const sources = new Map([['main', await makeSource(3)]]); // 100,110,120
    const chunks = splitEveryN(modelFromSource('main', 3), 2);
    expect(chunks).toHaveLength(2);
    expect(await exportedWidths(chunks[0], sources)).toEqual([100, 110]);
    expect(await exportedWidths(chunks[1], sources)).toEqual([120]);
  });

  it('throws when a page references missing source bytes', async () => {
    const model = modelFromSource('ghost', 1);
    await expect(exportPdf(model, new Map())).rejects.toThrow(/Missing source bytes/);
  });
});

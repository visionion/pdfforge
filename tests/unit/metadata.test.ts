import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { readMetadata, applyMetadata, EMPTY_METADATA } from '../../src/features/metadata/metadata';

async function pdfWithMetadata(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('Original Title');
  doc.setAuthor('Jane Doe');
  doc.setKeywords(['alpha', 'beta']);
  return doc.save();
}

describe('metadata', () => {
  it('reads document metadata', async () => {
    const m = await readMetadata(await pdfWithMetadata());
    expect(m.title).toBe('Original Title');
    expect(m.author).toBe('Jane Doe');
    expect(m.keywords).toContain('alpha');
  });

  it('applies edited metadata', async () => {
    const doc = await PDFDocument.load(await pdfWithMetadata());
    applyMetadata(doc, { ...EMPTY_METADATA, title: 'New Title', author: 'Bob', keywords: 'x, y, z' });
    const out = await doc.save();
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getTitle()).toBe('New Title');
    expect(reloaded.getAuthor()).toBe('Bob');
    expect(reloaded.getKeywords()).toContain('x');
  });

  it('removes metadata when values are empty', async () => {
    const doc = await PDFDocument.load(await pdfWithMetadata());
    applyMetadata(doc, EMPTY_METADATA);
    const reloaded = await PDFDocument.load(await doc.save());
    expect(reloaded.getTitle() ?? '').toBe('');
    expect(reloaded.getAuthor() ?? '').toBe('');
  });
});

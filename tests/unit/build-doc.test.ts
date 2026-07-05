import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { CommandStack } from '../../src/store/commandStack';
import { DocEditor } from '../../src/doc/editor';
import { exportPdf } from '../../src/export/pdflib';

const PNG_DATAURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('build-from-scratch and images to PDF', () => {
  it('startBlank creates a single blank page', () => {
    const editor = new DocEditor(new CommandStack());
    editor.startBlank(400, 500);
    const pages = editor.pages.get();
    expect(pages).toHaveLength(1);
    expect(pages[0].blank).toEqual({ width: 400, height: 500 });
  });

  it('appendBlank adds pages and is undoable', () => {
    const stack = new CommandStack();
    const editor = new DocEditor(stack);
    editor.startBlank();
    editor.appendBlank();
    expect(editor.pages.get()).toHaveLength(2);
    stack.undo();
    expect(editor.pages.get()).toHaveLength(1);
  });

  it('imagesToPdf builds one page + image annotation per image', () => {
    const editor = new DocEditor(new CommandStack());
    editor.imagesToPdf([
      { dataUrl: PNG_DATAURL, format: 'png', wpx: 200, hpx: 100 },
      { dataUrl: PNG_DATAURL, format: 'png', wpx: 300, hpx: 300 },
    ]);
    expect(editor.pages.get()).toHaveLength(2);
    expect(editor.pages.get()[0].blank).toEqual({ width: 200, height: 100 });
    expect(editor.annotations.get()).toHaveLength(2);
    expect(editor.annotations.get().every((a) => a.type === 'image')).toBe(true);
  });

  it('exports a blank built doc with an image to a valid PDF', async () => {
    const editor = new DocEditor(new CommandStack());
    editor.imagesToPdf([{ dataUrl: PNG_DATAURL, format: 'png', wpx: 250, hpx: 250 }]);
    const bytes = await exportPdf(editor.pages.get(), new Map(), { annotations: editor.annotations.get() });
    const reparsed = await PDFDocument.load(bytes);
    expect(reparsed.getPageCount()).toBe(1);
    expect(Math.round(reparsed.getPage(0).getSize().width)).toBe(250);
  });
});

import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { Signal } from '../store/store';
import type { CommandStack } from '../store/commandStack';
import type { OpenedDoc } from './documentModel';
import {
  type PageModel,
  type PageRef,
  modelFromSource,
  newPageId,
  rotatePage,
  deletePage,
  duplicatePage,
  movePage,
  insertBlankPage,
  mergeModels,
} from './ops';
import type { SourceBytes } from '../export/pdflib';
import {
  type AnnotationModel,
  type Annotation,
  addAnnotation,
  removeAnnotation,
  updateAnnotation,
  annotationsForPage,
  pagesWithRedactions,
  newAnnotationId,
} from '../overlay/annotations';

interface Source {
  readonly pdf: PDFDocumentProxy;
  readonly bytes: Uint8Array;
}

/**
 * Owns the current document's page model and the set of loaded source PDFs.
 * Page operations are applied as undoable commands, so rotate/delete/reorder
 * all participate in the shared undo/redo history. Export bakes the model
 * through pdf-lib.
 */
export class DocEditor {
  readonly pages = new Signal<PageModel>([]);
  readonly annotations = new Signal<AnnotationModel>([]);
  private readonly sources = new Map<string, Source>();
  private name = 'document.pdf';
  private sourceSeq = 0;

  constructor(private readonly commands: CommandStack) {}

  /** Replace the whole document with a freshly opened primary source. */
  loadPrimary(doc: OpenedDoc): void {
    this.sources.clear();
    this.sourceSeq = 0;
    this.sources.set('main', { pdf: doc.pdf, bytes: doc.bytes });
    this.name = doc.name;
    this.annotations.set([]);
    this.pages.set(modelFromSource('main', doc.numPages));
  }

  hasDoc(): boolean {
    return this.pages.get().length > 0;
  }

  /** Start a new blank document with a single empty page. */
  startBlank(width = 595, height = 842): void {
    this.sources.clear();
    this.sourceSeq = 0;
    this.name = 'untitled.pdf';
    this.commands.clear();
    this.annotations.set([]);
    this.pages.set([{ id: newPageId(), rotation: 0, blank: { width, height } }]);
  }

  /** Append a blank page (build-from-scratch / insert). */
  appendBlank(width = 595, height = 842): void {
    this.apply([...this.pages.get(), { id: newPageId(), rotation: 0, blank: { width, height } }], 'Add blank page');
  }

  /** Build a fresh document from images — one page per image, sized to it. */
  imagesToPdf(images: Array<{ dataUrl: string; format: 'png' | 'jpg'; wpx: number; hpx: number }>): void {
    const pages: PageRef[] = [];
    const anns: Annotation[] = [];
    for (const img of images) {
      const width = img.wpx;
      const height = img.hpx;
      const id = newPageId();
      pages.push({ id, rotation: 0, blank: { width, height } });
      anns.push({
        id: newAnnotationId(),
        pageId: id,
        type: 'image',
        color: '#000000',
        x: 0,
        y: 0,
        width,
        height,
        dataUrl: img.dataUrl,
        format: img.format,
      });
    }
    this.sources.clear();
    this.sourceSeq = 0;
    this.name = 'images.pdf';
    this.commands.clear();
    this.annotations.set(anns);
    this.pages.set(pages);
  }

  private register(doc: OpenedDoc): string {
    this.sourceSeq += 1;
    const id = `src${this.sourceSeq}`;
    this.sources.set(id, { pdf: doc.pdf, bytes: doc.bytes });
    return id;
  }

  private apply(next: PageModel, label: string): void {
    const prev = this.pages.get();
    this.commands.execute({
      label,
      apply: () => this.pages.set(next),
      invert: () => this.pages.set(prev),
    });
  }

  rotate(index: number, delta: number): void {
    this.apply(rotatePage(this.pages.get(), index, delta), `Rotate page ${index + 1}`);
  }

  remove(index: number): void {
    if (this.pages.get().length <= 1) return; // never leave an empty doc
    this.apply(deletePage(this.pages.get(), index), `Delete page ${index + 1}`);
  }

  duplicate(index: number): void {
    this.apply(duplicatePage(this.pages.get(), index), `Duplicate page ${index + 1}`);
  }

  move(from: number, to: number): void {
    if (from === to) return;
    this.apply(movePage(this.pages.get(), from, to), `Move page ${from + 1} → ${to + 1}`);
  }

  insertBlank(index: number): void {
    this.apply(insertBlankPage(this.pages.get(), index), `Insert blank page`);
  }

  /** Add an annotation as an undoable command. */
  addAnnotation(annotation: Annotation): void {
    const prev = this.annotations.get();
    const next = addAnnotation(prev, annotation);
    this.commands.execute({
      label: `Add ${annotation.type}`,
      apply: () => this.annotations.set(next),
      invert: () => this.annotations.set(prev),
    });
  }

  /** Add several annotations as one undoable command (e.g. whiteout + retyped text). */
  addAnnotations(annotations: Annotation[], label: string): void {
    if (annotations.length === 0) return;
    const prev = this.annotations.get();
    const next = annotations.reduce<AnnotationModel>((m, a) => addAnnotation(m, a), prev);
    this.commands.execute({
      label,
      apply: () => this.annotations.set(next),
      invert: () => this.annotations.set(prev),
    });
  }

  removeAnnotation(id: string): void {
    const prev = this.annotations.get();
    const next = removeAnnotation(prev, id);
    this.commands.execute({
      label: 'Delete annotation',
      apply: () => this.annotations.set(next),
      invert: () => this.annotations.set(prev),
    });
  }

  /** Update an annotation's geometry (image drag/resize) as an undoable command. */
  updateGeometry(id: string, geo: { x: number; y: number; width: number; height: number }): void {
    const prev = this.annotations.get();
    const next = updateAnnotation(prev, id, geo as Partial<Annotation>);
    this.commands.execute({
      label: 'Move object',
      apply: () => this.annotations.set(next),
      invert: () => this.annotations.set(prev),
    });
  }

  /** Append another opened PDF's pages (merge / insert-from-file). */
  addFile(doc: OpenedDoc): void {
    const id = this.register(doc);
    this.apply(
      mergeModels(this.pages.get(), modelFromSource(id, doc.numPages)),
      `Add ${doc.numPages} page(s)`,
    );
  }

  /** Resolve the pdf.js page proxy for a ref, or null for a blank slot. */
  async renderPage(ref: PageRef): Promise<PDFPageProxy | null> {
    if (ref.blank || ref.sourceId === undefined || ref.sourceIndex === undefined) return null;
    const source = this.sources.get(ref.sourceId);
    if (!source) return null;
    return source.pdf.getPage(ref.sourceIndex + 1);
  }

  /** Read AcroForm fields from the primary source. */
  async detectForm(): Promise<import('../features/forms/forms').FieldInfo[]> {
    const src = this.sources.get('main');
    if (!src) return [];
    const { detectFields } = await import('../features/forms/forms');
    return detectFields(src.bytes);
  }

  /** Fill (and optionally flatten) the form, then reload so filled values render. */
  async applyForm(values: import('../features/forms/forms').FormValues, flatten: boolean): Promise<void> {
    const src = this.sources.get('main');
    if (!src) return;
    const { fillForm } = await import('../features/forms/forms');
    const filled = await fillForm(src.bytes, values, flatten);
    const { openPdf } = await import('./documentModel');
    const ab = filled.buffer.slice(filled.byteOffset, filled.byteOffset + filled.byteLength) as ArrayBuffer;
    const reopened = await openPdf(ab, this.name);
    this.sources.set('main', { pdf: reopened.pdf, bytes: reopened.bytes });
    this.commands.clear(); // document bytes changed — prior history no longer valid
    this.pages.set(this.pages.get().slice()); // force a re-render from the new source
  }

  async export(): Promise<Uint8Array> {
    // Lazy-load the pdf-lib export engine so it isn't in the initial bundle.
    const { exportPdf } = await import('../export/pdflib');
    const anns = this.annotations.get();
    const rasters = await this.rasterizeRedactedPages(anns);
    const bytes = new Map<string, SourceBytes>();
    for (const [id, source] of this.sources) bytes.set(id, source.bytes);
    return exportPdf(this.pages.get(), bytes, { annotations: anns, rasters });
  }

  /**
   * Redacting a page flattens it to a raster so covered text cannot be
   * extracted. Renders each redacted page and bakes black boxes into the image.
   */
  private async rasterizeRedactedPages(
    anns: AnnotationModel,
  ): Promise<Map<string, import('../export/pdflib').RasterPage>> {
    const rasters = new Map<string, import('../export/pdflib').RasterPage>();
    const redacted = pagesWithRedactions(anns);
    if (redacted.size === 0) return rasters;
    const { rasterizePage } = await import('../render/pdfjs');
    for (const ref of this.pages.get()) {
      if (!redacted.has(ref.id) || ref.blank) continue;
      const page = await this.renderPage(ref);
      if (!page) continue;
      const rects = annotationsForPage(anns, ref.id)
        .filter((a) => a.type === 'redact')
        .map((a) => ({ x: (a as { x: number }).x, y: (a as { y: number }).y, width: (a as { width: number }).width, height: (a as { height: number }).height }));
      const heightPts = page.getViewport({ scale: 1 }).height;
      rasters.set(ref.id, await rasterizePage(page, 2, rects, heightPts));
    }
    return rasters;
  }

  exportName(): string {
    return `${this.name.replace(/\.pdf$/i, '')}-edited.pdf`;
  }
}

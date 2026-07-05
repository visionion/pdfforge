import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { Signal } from '../store/store';
import type { CommandStack } from '../store/commandStack';
import type { OpenedDoc } from './documentModel';
import {
  type PageModel,
  type PageRef,
  modelFromSource,
  rotatePage,
  deletePage,
  duplicatePage,
  movePage,
  insertBlankPage,
  mergeModels,
} from './ops';
import type { SourceBytes } from '../export/pdflib';

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
    this.pages.set(modelFromSource('main', doc.numPages));
  }

  hasDoc(): boolean {
    return this.pages.get().length > 0;
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

  async export(): Promise<Uint8Array> {
    // Lazy-load the pdf-lib export engine so it isn't in the initial bundle.
    const { exportPdf } = await import('../export/pdflib');
    const bytes = new Map<string, SourceBytes>();
    for (const [id, source] of this.sources) bytes.set(id, source.bytes);
    return exportPdf(this.pages.get(), bytes);
  }

  exportName(): string {
    return `${this.name.replace(/\.pdf$/i, '')}-edited.pdf`;
  }
}

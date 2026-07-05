import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Wire pdf.js to its worker via Vite's ?worker import so rendering never blocks
// the main thread.
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export interface OpenedDoc {
  readonly pdf: PDFDocumentProxy;
  readonly name: string;
  readonly numPages: number;
}

export class PasswordRequiredError extends Error {
  constructor() {
    super('This PDF is password protected.');
    this.name = 'PasswordRequiredError';
  }
}

export class InvalidPdfError extends Error {
  constructor() {
    super('This file could not be opened as a PDF.');
    this.name = 'InvalidPdfError';
  }
}

/**
 * Open a PDF from raw bytes, entirely in-browser. Encrypted docs raise
 * PasswordRequiredError so the caller can route to the unlock flow (U15);
 * non-PDF input raises InvalidPdfError.
 */
export async function openPdf(data: ArrayBuffer, name: string): Promise<OpenedDoc> {
  try {
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    return { pdf, name, numPages: pdf.numPages };
  } catch (err: unknown) {
    const name_ = (err as { name?: string })?.name;
    if (name_ === 'PasswordException') throw new PasswordRequiredError();
    if (name_ === 'InvalidPDFException') throw new InvalidPdfError();
    throw err;
  }
}

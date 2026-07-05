import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Let pdf.js instantiate its own worker from a bundled URL. This is the robust
// Vite setup for both dev and production; a `?worker` module-worker port breaks
// render-task messaging in the production bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface OpenedDoc {
  readonly pdf: PDFDocumentProxy;
  readonly name: string;
  readonly numPages: number;
  /** Retained copy of the original bytes, for pdf-lib export. */
  readonly bytes: Uint8Array;
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
export async function openPdf(data: ArrayBuffer, name: string, password?: string): Promise<OpenedDoc> {
  // Keep our own copy for pdf-lib export; hand the original buffer to pdf.js
  // (matching the render path that is known to work).
  const bytes = new Uint8Array(data.slice(0));
  try {
    const pdf = await pdfjsLib.getDocument({
      data,
      password,
      // Serve non-embedded standard-14 fonts and CJK cmaps locally, so pages
      // that reference them render (and don't stall waiting on font data).
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
    }).promise;
    return { pdf, name, numPages: pdf.numPages, bytes };
  } catch (err: unknown) {
    const name_ = (err as { name?: string })?.name;
    if (name_ === 'PasswordException') throw new PasswordRequiredError();
    if (name_ === 'InvalidPDFException') throw new InvalidPdfError();
    throw err;
  }
}

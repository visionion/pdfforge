import { createWorker, type Worker } from 'tesseract.js';
import type { OcrEngine, OcrResult, OcrProgress } from './OcrEngine';
import { flattenWords } from './words';

/**
 * Tesseract.js OCR engine. Runs in a Web Worker with WASM; language data loads
 * on demand. The user's PDF never leaves the browser — only the OCR engine code
 * is fetched. Reuses one worker across pages; re-created when the language changes.
 */
export class TesseractEngine implements OcrEngine {
  readonly name = 'Tesseract';
  private worker: Worker | null = null;
  private lang = '';

  private async ensure(lang: string, onProgress?: (p: OcrProgress) => void): Promise<Worker> {
    if (this.worker && this.lang === lang) return this.worker;
    if (this.worker) await this.worker.terminate();
    this.worker = await createWorker(lang, 1, {
      logger: (m: { status?: string; progress?: number }) =>
        onProgress?.({ status: m.status ?? '', progress: typeof m.progress === 'number' ? m.progress : 0 }),
    });
    this.lang = lang;
    return this.worker;
  }

  async recognize(source: HTMLCanvasElement, lang: string, onProgress?: (p: OcrProgress) => void): Promise<OcrResult> {
    const worker = await this.ensure(lang, onProgress);
    const { data } = await worker.recognize(source, {}, { blocks: true });
    return { text: data.text ?? '', words: flattenWords(data as unknown as Parameters<typeof flattenWords>[0]) };
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

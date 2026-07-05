/**
 * OCR engine abstraction. Word bounding boxes are returned in source-image pixel
 * coordinates (origin top-left); the searchable-layer export converts them to
 * PDF points. The interface lets us swap engines (Tesseract.js today, PP-OCRv6
 * via WebGPU as a future primary) without touching callers.
 */
export interface OcrWord {
  readonly text: string;
  readonly bbox: { x0: number; y0: number; x1: number; y1: number };
  readonly confidence: number;
}

export interface OcrResult {
  readonly text: string;
  readonly words: OcrWord[];
}

export interface OcrProgress {
  readonly status: string;
  readonly progress: number; // 0..1
}

export interface OcrEngine {
  readonly name: string;
  recognize(
    source: HTMLCanvasElement,
    lang: string,
    onProgress?: (p: OcrProgress) => void,
  ): Promise<OcrResult>;
  terminate(): Promise<void>;
}

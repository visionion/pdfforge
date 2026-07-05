import type { OcrEngine } from './OcrEngine';

/**
 * Resolve the best available OCR engine. PP-OCRv6 (ONNX Runtime Web + WebGPU)
 * is the intended primary when wired; Tesseract.js is the reliable,
 * permissively-licensed fallback and the current default. Lazy-loaded so the
 * OCR engine is not in the initial bundle.
 */
export async function getOcrEngine(): Promise<OcrEngine> {
  const { TesseractEngine } = await import('./tesseract');
  return new TesseractEngine();
}

export type { OcrEngine, OcrResult, OcrWord, OcrProgress } from './OcrEngine';

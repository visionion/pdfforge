import { describe, it, expect } from 'vitest';
import { wordToPdfText, wordsToSearchable } from '../../src/engines/ocr/searchable';
import type { OcrWord } from '../../src/engines/ocr/OcrEngine';

function word(x0: number, y0: number, x1: number, y1: number, text = 'hi'): OcrWord {
  return { text, confidence: 90, bbox: { x0, y0, x1, y1 } };
}

describe('OCR bbox → PDF-point conversion', () => {
  const pageHeightPts = 800;
  const ocrScale = 2; // page rendered at 144 DPI

  it('converts a top-left pixel bbox to a bottom-left PDF placement', () => {
    // A word from pixels (100,40)-(180,80) on a 2x render.
    const w = wordToPdfText(word(100, 40, 180, 80), ocrScale, pageHeightPts);
    expect(w.x).toBe(50); // 100 / 2
    expect(w.size).toBe(20); // (80-40)/2
    // baseline y = pageHeight - bboxBottom/scale = 800 - 40 = 760
    expect(w.y).toBe(760);
    expect(w.text).toBe('hi');
  });

  it('never returns a zero/negative font size', () => {
    const w = wordToPdfText(word(10, 50, 20, 50), ocrScale, pageHeightPts); // zero-height bbox
    expect(w.size).toBeGreaterThanOrEqual(1);
  });

  it('maps a list of words', () => {
    const words = wordsToSearchable([word(0, 0, 10, 10), word(20, 20, 40, 40)], ocrScale, pageHeightPts);
    expect(words).toHaveLength(2);
  });
});

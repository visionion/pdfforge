import type { OcrWord } from './OcrEngine';
import type { SearchableWord } from '../../export/pdflib';

/**
 * Convert an OCR word (pixel bbox, origin top-left, from a page rendered at
 * `ocrScale` = dpi/72) into an invisible text placement in PDF points (origin
 * bottom-left). The baseline is taken at the bbox bottom; font size from bbox
 * height. This is the coordinate core of the searchable-layer export.
 */
export function wordToPdfText(word: OcrWord, ocrScale: number, pageHeightPts: number): SearchableWord {
  const x = word.bbox.x0 / ocrScale;
  const yBottom = word.bbox.y1 / ocrScale;
  const size = Math.max(1, (word.bbox.y1 - word.bbox.y0) / ocrScale);
  return { text: word.text, x, y: pageHeightPts - yBottom, size };
}

export function wordsToSearchable(words: OcrWord[], ocrScale: number, pageHeightPts: number): SearchableWord[] {
  return words.map((w) => wordToPdfText(w, ocrScale, pageHeightPts));
}

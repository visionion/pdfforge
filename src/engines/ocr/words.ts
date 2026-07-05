import type { OcrWord } from './OcrEngine';

interface RawWord {
  text?: string;
  confidence?: number;
  bbox?: { x0?: number; y0?: number; x1?: number; y1?: number };
}
interface RawData {
  words?: RawWord[];
  blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ words?: RawWord[] }> }> }>;
}

function toWord(w: RawWord): OcrWord {
  return {
    text: (w.text ?? '').trim(),
    confidence: w.confidence ?? 0,
    bbox: { x0: w.bbox?.x0 ?? 0, y0: w.bbox?.y0 ?? 0, x1: w.bbox?.x1 ?? 0, y1: w.bbox?.y1 ?? 0 },
  };
}

/**
 * Flatten a Tesseract result into words. Newer builds expose `words` directly;
 * others nest them under blocks → paragraphs → lines. Empty words are dropped.
 */
export function flattenWords(data: RawData): OcrWord[] {
  const raw: RawWord[] = [];
  if (Array.isArray(data.words) && data.words.length) {
    raw.push(...data.words);
  } else {
    for (const block of data.blocks ?? [])
      for (const para of block.paragraphs ?? [])
        for (const line of para.lines ?? []) raw.push(...(line.words ?? []));
  }
  return raw.map(toWord).filter((w) => w.text.length > 0);
}

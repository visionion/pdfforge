import { describe, it, expect } from 'vitest';
import { flattenWords } from '../../src/engines/ocr/words';

describe('OCR word extraction', () => {
  it('uses a flat words array when present', () => {
    const words = flattenWords({
      words: [
        { text: 'Hello', confidence: 95, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } },
        { text: '  ', confidence: 10, bbox: {} },
        { text: 'World', confidence: 90, bbox: { x0: 5, y0: 6, x1: 7, y1: 8 } },
      ],
    });
    expect(words.map((w) => w.text)).toEqual(['Hello', 'World']); // blank dropped
    expect(words[0].bbox).toEqual({ x0: 1, y0: 2, x1: 3, y1: 4 });
  });

  it('falls back to blocks → paragraphs → lines → words', () => {
    const words = flattenWords({
      blocks: [
        {
          paragraphs: [
            { lines: [{ words: [{ text: 'Nested', confidence: 88, bbox: { x0: 0, y0: 0, x1: 10, y1: 10 } }] }] },
          ],
        },
      ],
    });
    expect(words).toHaveLength(1);
    expect(words[0].text).toBe('Nested');
  });

  it('returns empty for no data', () => {
    expect(flattenWords({})).toEqual([]);
  });
});

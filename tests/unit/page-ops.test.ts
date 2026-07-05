import { describe, it, expect } from 'vitest';
import {
  modelFromSource,
  deletePage,
  duplicatePage,
  rotatePage,
  movePage,
  insertBlankPage,
  extractPages,
  mergeModels,
  insertModel,
  splitEveryN,
  splitByRanges,
} from '../../src/doc/ops';

describe('page model operations', () => {
  it('modelFromSource creates one slot per page with ascending indices', () => {
    const m = modelFromSource('main', 3);
    expect(m).toHaveLength(3);
    expect(m.map((r) => r.sourceIndex)).toEqual([0, 1, 2]);
    expect(m.every((r) => r.sourceId === 'main' && r.rotation === 0)).toBe(true);
    expect(new Set(m.map((r) => r.id)).size).toBe(3); // unique ids
  });

  it('deletePage removes the slot at the index', () => {
    const m = modelFromSource('main', 3);
    const after = deletePage(m, 1);
    expect(after.map((r) => r.sourceIndex)).toEqual([0, 2]);
  });

  it('duplicatePage inserts a copy after, sharing the source but with a new id', () => {
    const m = modelFromSource('main', 2);
    const after = duplicatePage(m, 0);
    expect(after).toHaveLength(3);
    expect(after[1].sourceIndex).toBe(0);
    expect(after[1].id).not.toBe(m[0].id);
    expect(after[2].sourceIndex).toBe(1);
  });

  it('rotatePage cycles through 90-degree steps and normalizes negatives', () => {
    let m = modelFromSource('main', 1);
    m = rotatePage(m, 0, 90);
    expect(m[0].rotation).toBe(90);
    m = rotatePage(m, 0, 90);
    m = rotatePage(m, 0, 90);
    expect(m[0].rotation).toBe(270);
    m = rotatePage(m, 0, 90);
    expect(m[0].rotation).toBe(0);
    m = rotatePage(m, 0, -90);
    expect(m[0].rotation).toBe(270);
  });

  it('movePage reorders and treats same-index / out-of-range as no-ops', () => {
    const m = modelFromSource('main', 3); // indices 0,1,2
    const moved = movePage(m, 0, 2); // -> 1,2,0
    expect(moved.map((r) => r.sourceIndex)).toEqual([1, 2, 0]);
    expect(movePage(m, 1, 1)).toBe(m);
    expect(movePage(m, 5, 0)).toBe(m);
  });

  it('insertBlankPage inserts a blank slot of the given size', () => {
    const m = modelFromSource('main', 2);
    const after = insertBlankPage(m, 1, { width: 200, height: 300 });
    expect(after).toHaveLength(3);
    expect(after[1].blank).toEqual({ width: 200, height: 300 });
    expect(after[1].sourceId).toBeUndefined();
  });

  it('extractPages returns the requested pages in order, ignoring bad indices', () => {
    const m = modelFromSource('main', 4);
    const out = extractPages(m, [3, 1, 9]);
    expect(out.map((r) => r.sourceIndex)).toEqual([3, 1]);
  });

  it('mergeModels and insertModel combine models', () => {
    const a = modelFromSource('a', 2);
    const b = modelFromSource('b', 1);
    expect(mergeModels(a, b)).toHaveLength(3);
    const inserted = insertModel(a, b, 1);
    expect(inserted.map((r) => r.sourceId)).toEqual(['a', 'b', 'a']);
  });

  it('splitEveryN chunks and rejects sizes below 1', () => {
    const m = modelFromSource('main', 5);
    const chunks = splitEveryN(m, 2);
    expect(chunks.map((c) => c.length)).toEqual([2, 2, 1]);
    expect(() => splitEveryN(m, 0)).toThrow();
  });

  it('splitByRanges slices inclusive ranges', () => {
    const m = modelFromSource('main', 4);
    const parts = splitByRanges(m, [
      { start: 0, end: 1 },
      { start: 2, end: 3 },
    ]);
    expect(parts.map((p) => p.map((r) => r.sourceIndex))).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

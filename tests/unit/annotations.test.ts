import { describe, it, expect } from 'vitest';
import {
  type Annotation,
  addAnnotation,
  removeAnnotation,
  updateAnnotation,
  annotationsForPage,
  pruneAnnotations,
} from '../../src/overlay/annotations';

function rect(id: string, pageId: string): Annotation {
  return { id, pageId, type: 'rect', color: '#ff0000', x: 0, y: 0, width: 10, height: 10, strokeWidth: 2, fill: false };
}

describe('annotation model', () => {
  it('adds and filters by page', () => {
    let m = addAnnotation([], rect('a1', 'p1'));
    m = addAnnotation(m, rect('a2', 'p2'));
    m = addAnnotation(m, rect('a3', 'p1'));
    expect(m).toHaveLength(3);
    expect(annotationsForPage(m, 'p1').map((a) => a.id)).toEqual(['a1', 'a3']);
    expect(annotationsForPage(m, 'p2').map((a) => a.id)).toEqual(['a2']);
  });

  it('removes by id', () => {
    const m = [rect('a1', 'p1'), rect('a2', 'p1')];
    expect(removeAnnotation(m, 'a1').map((a) => a.id)).toEqual(['a2']);
  });

  it('updates a field', () => {
    const m = [rect('a1', 'p1')];
    const updated = updateAnnotation(m, 'a1', { color: '#00ff00' });
    expect(updated[0].color).toBe('#00ff00');
  });

  it('prunes annotations whose page no longer exists', () => {
    const m = [rect('a1', 'p1'), rect('a2', 'gone')];
    expect(pruneAnnotations(m, new Set(['p1'])).map((a) => a.id)).toEqual(['a1']);
  });
});

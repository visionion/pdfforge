import { describe, it, expect } from 'vitest';
import { Signal } from '../../src/store/store';

describe('Signal', () => {
  it('holds and updates a value', () => {
    const s = new Signal(1);
    expect(s.get()).toBe(1);
    s.set(2);
    expect(s.get()).toBe(2);
  });

  it('notifies subscribers with next and previous values', () => {
    const s = new Signal('a');
    const seen: Array<[string, string]> = [];
    s.subscribe((next, prev) => seen.push([next, prev]));
    s.set('b');
    expect(seen).toEqual([['b', 'a']]);
  });

  it('does not notify when the value is unchanged (Object.is)', () => {
    const s = new Signal(5);
    let count = 0;
    s.subscribe(() => (count += 1));
    s.set(5);
    expect(count).toBe(0);
  });

  it('supports functional update', () => {
    const s = new Signal(10);
    s.update((n) => n + 5);
    expect(s.get()).toBe(15);
  });

  it('unsubscribed listeners stop firing', () => {
    const s = new Signal(0);
    let count = 0;
    const off = s.subscribe(() => (count += 1));
    s.set(1);
    off();
    s.set(2);
    expect(count).toBe(1);
  });
});

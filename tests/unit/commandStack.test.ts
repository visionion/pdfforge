import { describe, it, expect } from 'vitest';
import { CommandStack, type Command } from '../../src/store/commandStack';

/** Test command that mutates a shared counter object. */
function counterCommand(state: { n: number }, delta: number, label = 'add'): Command {
  return {
    label,
    apply: () => {
      state.n += delta;
    },
    invert: () => {
      state.n -= delta;
    },
  };
}

describe('CommandStack', () => {
  it('applies a command and reverses it exactly on undo', () => {
    const state = { n: 0 };
    const stack = new CommandStack();
    stack.execute(counterCommand(state, 5));
    expect(state.n).toBe(5);
    stack.undo();
    expect(state.n).toBe(0);
  });

  it('reapplies on redo', () => {
    const state = { n: 0 };
    const stack = new CommandStack();
    stack.execute(counterCommand(state, 3));
    stack.undo();
    stack.redo();
    expect(state.n).toBe(3);
  });

  it('undo past the start and redo past the end are no-ops', () => {
    const state = { n: 1 };
    const stack = new CommandStack();
    stack.undo();
    stack.undo();
    expect(state.n).toBe(1);
    expect(stack.canUndo()).toBe(false);
    stack.redo();
    expect(state.n).toBe(1);
    expect(stack.canRedo()).toBe(false);
  });

  it('a new command after undo truncates the redo branch', () => {
    const state = { n: 0 };
    const stack = new CommandStack();
    stack.execute(counterCommand(state, 1));
    stack.execute(counterCommand(state, 10));
    stack.undo(); // n = 1, redo branch has the +10
    stack.execute(counterCommand(state, 100)); // should clear redo
    expect(state.n).toBe(101);
    expect(stack.canRedo()).toBe(false);
  });

  it('tracks canUndo/canRedo and the undo label', () => {
    const state = { n: 0 };
    const stack = new CommandStack();
    expect(stack.canUndo()).toBe(false);
    stack.execute(counterCommand(state, 1, 'increment'));
    expect(stack.canUndo()).toBe(true);
    expect(stack.peekUndoLabel()).toBe('increment');
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    expect(stack.peekUndoLabel()).toBe(null);
  });

  it('notifies subscribers on every change and stops after unsubscribe', () => {
    const stack = new CommandStack();
    let count = 0;
    const unsubscribe = stack.subscribe(() => {
      count += 1;
    });
    stack.execute(counterCommand({ n: 0 }, 1));
    stack.undo();
    expect(count).toBe(2);
    unsubscribe();
    stack.redo();
    expect(count).toBe(2);
  });
});

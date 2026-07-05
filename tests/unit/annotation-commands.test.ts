import { describe, it, expect } from 'vitest';
import { CommandStack } from '../../src/store/commandStack';
import { DocEditor } from '../../src/doc/editor';
import type { Annotation } from '../../src/overlay/annotations';

function rect(id: string): Annotation {
  return { id, pageId: 'p1', type: 'rect', color: '#ff0000', x: 0, y: 0, width: 10, height: 10, strokeWidth: 2, fill: false };
}

describe('annotation commands on DocEditor', () => {
  it('addAnnotations groups into a single undo', () => {
    const editor = new DocEditor(new CommandStack());
    editor.addAnnotations([rect('a'), rect('b')], 'Edit text');
    expect(editor.annotations.get()).toHaveLength(2);
    // one undo removes both
    editor['commands'].undo();
    expect(editor.annotations.get()).toHaveLength(0);
  });

  it('single add/remove annotation is undoable', () => {
    const stack = new CommandStack();
    const editor = new DocEditor(stack);
    editor.addAnnotation(rect('a'));
    expect(editor.annotations.get()).toHaveLength(1);
    editor.removeAnnotation('a');
    expect(editor.annotations.get()).toHaveLength(0);
    stack.undo(); // undo the remove
    expect(editor.annotations.get()).toHaveLength(1);
  });
});

import type { AppState, Tool } from './appState';

interface ToolDef {
  tool: Tool;
  label: string;
  title: string;
}

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Select', title: 'Select & select text' },
  { tool: 'highlight', label: 'Highlight', title: 'Highlight' },
  { tool: 'ink', label: 'Draw', title: 'Freehand pen' },
  { tool: 'rect', label: 'Rect', title: 'Rectangle' },
  { tool: 'ellipse', label: 'Oval', title: 'Ellipse' },
  { tool: 'line', label: 'Line', title: 'Line' },
  { tool: 'arrow', label: 'Arrow', title: 'Arrow' },
  { tool: 'text', label: 'Text', title: 'Text box' },
  { tool: 'note', label: 'Note', title: 'Sticky note' },
];

/** Annotation tool palette. Selecting a tool sets state.activeTool. */
export function createToolStrip(state: AppState): HTMLElement {
  const root = document.createElement('div');
  root.className = 'toolstrip';

  const buttons = new Map<Tool, HTMLButtonElement>();
  for (const def of TOOLS) {
    const btn = document.createElement('button');
    btn.className = 'tool';
    btn.textContent = def.label;
    btn.title = def.title;
    btn.addEventListener('click', () => state.activeTool.set(def.tool));
    buttons.set(def.tool, btn);
    root.appendChild(btn);
  }

  const color = document.createElement('input');
  color.type = 'color';
  color.className = 'tool-color';
  color.value = state.toolColor.get();
  color.title = 'Annotation color';
  color.addEventListener('input', () => state.toolColor.set(color.value));
  root.appendChild(color);

  function sync(): void {
    const active = state.activeTool.get();
    for (const [tool, btn] of buttons) btn.classList.toggle('active', tool === active);
  }
  state.activeTool.subscribe(sync);
  sync();

  return root;
}

import { Signal } from '../store/store';
import { CommandStack } from '../store/commandStack';
import { DocEditor } from '../doc/editor';

export type Theme = 'light' | 'dark';
export type Tool =
  | 'select'
  | 'edit-text'
  | 'highlight'
  | 'ink'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'text'
  | 'note';

/**
 * Shared application state. A single instance is created at bootstrap and passed
 * to each shell component, which subscribes to the signals it cares about.
 */
export class AppState {
  readonly scale = new Signal<number>(1.25);
  readonly currentPage = new Signal<number>(1);
  readonly theme = new Signal<Theme>(readInitialTheme());
  readonly commands = new CommandStack();
  readonly editor = new DocEditor(this.commands);
  readonly activeTool = new Signal<Tool>('select');
  readonly toolColor = new Signal<string>('#e5393a');

  readonly minScale = 0.25;
  readonly maxScale = 4;

  zoomIn(): void {
    this.scale.update((s) => Math.min(this.maxScale, round2(s + 0.25)));
  }

  zoomOut(): void {
    this.scale.update((s) => Math.max(this.minScale, round2(s - 0.25)));
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pdfforge.theme', theme);
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }

  toggleTheme(): void {
    this.setTheme(this.theme.get() === 'dark' ? 'light' : 'dark');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('pdfforge.theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

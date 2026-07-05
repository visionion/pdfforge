/**
 * Command-stack undo/redo. Every reversible edit in the app (page ops,
 * annotations, text edits, form fills) is expressed as a Command so the whole
 * app shares one history.
 */
export interface Command {
  /** Human-readable label, e.g. "Rotate page 3". */
  readonly label: string;
  /** Perform the edit. Called on execute() and again on redo(). */
  apply(): void;
  /** Reverse the edit. Called on undo(). Must restore the exact prior state. */
  invert(): void;
}

export class CommandStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly listeners = new Set<() => void>();

  /** Run a command and record it. Clears the redo branch. */
  execute(command: Command): void {
    command.apply();
    this.undoStack.push(command);
    this.redoStack = [];
    this.notify();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.invert();
    this.redoStack.push(command);
    this.notify();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.apply();
    this.undoStack.push(command);
    this.notify();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Label of the edit that undo() would reverse, or null. */
  peekUndoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/**
 * Minimal signal-style reactive primitive. The whole app leans on this instead
 * of a UI framework: UI chrome subscribes to signals and re-renders the small
 * piece that changed, keeping the byte budget for the WASM engines.
 */
export type Listener<T> = (value: T, prev: T) => void;

export class Signal<T> {
  private value: T;
  private readonly listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  get(): T {
    return this.value;
  }

  set(next: T): void {
    if (Object.is(next, this.value)) return;
    const prev = this.value;
    this.value = next;
    // Copy so a listener that unsubscribes mid-notify can't corrupt iteration.
    for (const listener of [...this.listeners]) listener(next, prev);
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.value));
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

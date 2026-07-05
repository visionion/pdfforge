import type { AppState } from '../shell/appState';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

/**
 * PWA wiring: request persistent storage (so cached OCR models/fonts survive
 * eviction — critical on iOS), and capture the install prompt so the toolbar can
 * offer "Install". Installing to the home screen is what keeps offline data on iOS.
 */
export function initPwa(state: AppState): void {
  if (navigator.storage?.persist) {
    void navigator.storage.persist().catch(() => {
      /* best-effort */
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.installPrompt.set(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => state.installPrompt.set(null));
}

/** Trigger the captured install prompt, then clear it. */
export async function promptInstall(state: AppState): Promise<void> {
  const prompt = state.installPrompt.get() as BeforeInstallPromptEvent | null;
  if (!prompt) return;
  await prompt.prompt();
  state.installPrompt.set(null);
}

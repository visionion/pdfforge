type Gtag = (...args: unknown[]) => void;

/**
 * Fire a Google Analytics event for tool usage. Never sends file content — only
 * the action name (e.g. "download", "ocr_searchable"). The user's PDF stays on
 * device; this just measures which tools get used.
 */
export function track(event: string, params?: Record<string, unknown>): void {
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  try {
    gtag?.('event', event, params ?? {});
  } catch {
    /* analytics is best-effort and must never break a tool */
  }
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire a GA4 custom event (DebugView / Explorations). No-op if gtag is missing. */
export function trackGaEvent(eventName: string, params?: Record<string, unknown>): void {
  window.gtag?.('event', eventName, params ?? {});
}

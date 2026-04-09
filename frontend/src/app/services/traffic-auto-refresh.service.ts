import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

/**
 * Emits a monotonic tick on an interval so analytics pages can refetch APIs
 * (near–real-time aggregates without WebSockets).
 */
@Injectable({ providedIn: 'root' })
export class TrafficAutoRefreshService {
  readonly pulse = signal(0);

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    if (!isPlatformBrowser(platformId)) return;
    const intervalMs = 30_000;
    window.setInterval(() => this.pulse.update(n => n + 1), intervalMs);
  }
}

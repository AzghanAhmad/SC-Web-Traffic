import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { GA_MEASUREMENT_ID } from '../config/google-analytics';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * SPA page_view via gtag config on each NavigationEnd.
 * Ensure index.html loads gtag.js for {@link GA_MEASUREMENT_ID}.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAnalyticsService {
  private readonly measurementId = GA_MEASUREMENT_ID;

  constructor() {
    const router = inject(Router);
    const destroyRef = inject(DestroyRef);

    router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(e => {
        const path = e.urlAfterRedirects || e.url;
        window.gtag?.('config', this.measurementId, { page_path: path });
      });
  }
}

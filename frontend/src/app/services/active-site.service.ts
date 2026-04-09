import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import type { SiteDto } from '../models/analytics.types';

@Injectable({ providedIn: 'root' })
export class ActiveSiteService {
  private static readonly storageKey = 'scribecount_active_site_id';
  private readonly http = inject(HttpClient);

  readonly site = signal<SiteDto | null>(null);
  /** All properties you have registered (for the header switcher). */
  readonly sites = signal<SiteDto[]>([]);
  readonly loading = signal(false);

  refresh(): void {
    this.loading.set(true);
    this.http.get<SiteDto[]>('/api/sites').subscribe({
      next: sites => {
        this.sites.set(sites);
        const stored = localStorage.getItem(ActiveSiteService.storageKey);
        const match = stored ? sites.find(s => s.siteId === stored) : undefined;
        const pick = match ?? sites[0] ?? null;
        this.site.set(pick);
        if (pick) {
          localStorage.setItem(ActiveSiteService.storageKey, pick.siteId);
        } else {
          localStorage.removeItem(ActiveSiteService.storageKey);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Switch analytics scope to another registered site. */
  selectSiteById(siteId: string): void {
    const s = this.sites().find(x => x.siteId === siteId);
    if (!s) return;
    this.site.set(s);
    localStorage.setItem(ActiveSiteService.storageKey, s.siteId);
  }

  register(url: string): Observable<SiteDto> {
    return this.http.post<SiteDto>('/api/sites', { url }).pipe(
      tap(s => {
        this.site.set(s);
        localStorage.setItem(ActiveSiteService.storageKey, s.siteId);
        this.sites.update(list => (list.some(x => x.siteId === s.siteId) ? list : [...list, s]));
      }),
    );
  }

  clear(): void {
    this.site.set(null);
    this.sites.set([]);
    localStorage.removeItem(ActiveSiteService.storageKey);
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import type { SiteDto } from '../models/analytics.types';

@Injectable({ providedIn: 'root' })
export class ActiveSiteService {
  private static readonly storageKey = 'scribecount_active_site_id';
  private readonly http = inject(HttpClient);

  readonly site = signal<SiteDto | null>(null);
  readonly loading = signal(false);

  refresh(): void {
    this.loading.set(true);
    this.http.get<SiteDto[]>('/api/sites').subscribe({
      next: sites => {
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

  register(url: string): Observable<SiteDto> {
    return this.http.post<SiteDto>('/api/sites', { url }).pipe(
      tap(s => {
        this.site.set(s);
        localStorage.setItem(ActiveSiteService.storageKey, s.siteId);
      })
    );
  }

  clear(): void {
    this.site.set(null);
    localStorage.removeItem(ActiveSiteService.storageKey);
  }
}

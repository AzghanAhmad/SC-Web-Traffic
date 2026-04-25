import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, catchError } from 'rxjs/operators';
import { of, interval, Subscription } from 'rxjs';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import type { SiteDto, LiveStatsDto } from '../../models/analytics.types';

@Component({
  selector: 'app-websites',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Websites</h1>
          <p class="page-sub">Add a website, open it with live tracking, and watch metrics update in real time.</p>
        </div>
        <button class="btn-primary" (click)="showAddForm.set(!showAddForm())">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add Website
        </button>
      </div>

      <!-- Add Website Form -->
      @if (showAddForm()) {
        <div class="add-card">
          <h3 class="add-title">Register a new website</h3>
          <p class="add-hint">Paste the full URL — e.g. <code>https://priceoye.pk</code></p>
          <form class="add-form" (ngSubmit)="onAdd()">
            <input
              class="url-input"
              type="url"
              [(ngModel)]="newUrl"
              name="newUrl"
              placeholder="https://priceoye.pk"
              autocomplete="url"
              [disabled]="adding()"
            />
            <button class="btn-primary" type="submit" [disabled]="adding() || !newUrl.trim()">
              {{ adding() ? 'Adding…' : 'Track this site' }}
            </button>
            <button class="btn-ghost" type="button" (click)="showAddForm.set(false)">Cancel</button>
          </form>
          @if (addError()) {
            <p class="form-error">{{ addError() }}</p>
          }
        </div>
      }

      <!-- Sites List -->
      @if (loading()) {
        <div class="empty-state">
          <div class="spinner"></div>
          <p>Loading your websites…</p>
        </div>
      } @else if (sites().length === 0) {
        <div class="empty-state">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <circle cx="32" cy="32" r="28"/>
            <path d="M4 32h56M32 4a44 44 0 0 1 0 56M32 4a44 44 0 0 0 0 56"/>
          </svg>
          <p>No websites yet. Click <strong>Add Website</strong> to get started.</p>
        </div>
      } @else {
        <div class="sites-grid">
          @for (site of sites(); track site.siteId) {
            <div class="site-card" [class.site-card--active]="activeSiteId() === site.siteId">

              <!-- Card Header -->
              <div class="site-card-header">
                <div class="site-favicon">
                  <img
                    [src]="'https://www.google.com/s2/favicons?domain=' + site.domain + '&sz=32'"
                    [alt]="site.domain"
                    width="20" height="20"
                    (error)="onFaviconError($event)"
                  />
                </div>
                <div class="site-info">
                  <div class="site-domain">{{ site.domain }}</div>
                  <div class="site-id-badge">ID: {{ site.siteId.slice(0, 8) }}…</div>
                </div>
                <div class="site-actions">
                  @if (activeSiteId() !== site.siteId) {
                    <button class="btn-sm btn-outline" (click)="selectSite(site)">Select</button>
                  } @else {
                    <span class="active-badge">Active</span>
                  }
                </div>
              </div>

              <!-- Tracked Link -->
              <div class="tracked-link-row">
                <span class="tracked-link-label">Tracked link</span>
                <a
                  class="tracked-link"
                  [href]="'https://' + site.domain"
                  target="_blank"
                  rel="noopener"
                  (click)="onTrackedLinkClick($event, site)"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  https://{{ site.domain }}
                </a>
                <span class="click-hint">Click to open &amp; start tracking</span>
              </div>

              <!-- Live Stats -->
              <div class="live-stats-row">
                <div class="live-dot-wrap">
                  <span class="live-dot"></span>
                  <span class="live-label">Live (today)</span>
                </div>
                @if (liveMap()[site.siteId]; as stats) {
                  <div class="stats-chips">
                    <div class="chip chip--green">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {{ stats.activeVisitors }} active
                    </div>
                    <div class="chip chip--blue">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {{ stats.todayPageViews }} views
                    </div>
                    <div class="chip chip--purple">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
                      {{ stats.todayClicks }} clicks
                    </div>
                    <div class="chip chip--orange">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      {{ stats.engagementRate }}% engaged
                    </div>
                    <div class="chip chip--teal">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {{ stats.todayConversions }} conv.
                    </div>
                  </div>
                } @else {
                  <div class="stats-loading">
                    <div class="mini-spinner"></div>
                    <span>Loading stats…</span>
                  </div>
                }
              </div>

              <!-- View Analytics Button -->
              <div class="card-footer">
                <button class="btn-sm btn-primary-sm" (click)="viewAnalytics(site)">
                  View Analytics →
                </button>
                <span class="events-today">
                  {{ liveMap()[site.siteId]?.todayEvents ?? '—' }} events today
                </span>
              </div>

            </div>
          }
        </div>
      }

      <!-- Toast -->
      @if (toast()) {
        <div class="toast" [class.toast--error]="toastType() === 'error'">
          {{ toast() }}
        </div>
      }

    </div>
  `,
  styles: [`
    .page {
      padding: 28px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 28px;
      gap: 16px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }

    .page-sub {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
    }

    /* Buttons */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      background: rgb(var(--color-accent));
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 150ms;
      white-space: nowrap;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.88; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-ghost {
      padding: 9px 16px;
      background: transparent;
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      color: rgb(var(--color-text-secondary));
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-ghost:hover { background: rgb(var(--color-surface-elevated)); }

    .btn-sm {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .btn-outline {
      background: transparent;
      border: 1px solid rgb(var(--color-border)) !important;
      color: rgb(var(--color-text-secondary));
    }
    .btn-outline:hover { background: rgb(var(--color-surface-elevated)); }

    .btn-primary-sm {
      background: rgb(var(--color-accent));
      color: #fff;
    }
    .btn-primary-sm:hover { opacity: 0.88; }

    /* Add Card */
    .add-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .add-title {
      font-size: 15px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      margin-bottom: 4px;
    }

    .add-hint {
      font-size: 12px;
      color: rgb(var(--color-text-muted));
      margin-bottom: 16px;
    }

    .add-hint code {
      background: rgb(var(--color-surface-elevated));
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
    }

    .add-form {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .url-input {
      flex: 1;
      min-width: 260px;
      height: 40px;
      padding: 0 14px;
      border-radius: 10px;
      border: 1px solid rgb(var(--color-border));
      background: rgb(var(--color-bg));
      color: rgb(var(--color-text-primary));
      font-size: 13px;
      outline: none;
    }
    .url-input:focus {
      border-color: rgb(var(--color-accent));
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
    }
    .url-input:disabled { opacity: 0.6; }

    .form-error {
      margin-top: 10px;
      font-size: 12px;
      color: rgb(248, 113, 113);
    }

    /* Empty / Loading */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 80px 20px;
      color: rgb(var(--color-text-muted));
      font-size: 14px;
      text-align: center;
    }

    /* Sites Grid */
    .sites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
      gap: 20px;
    }

    /* Site Card */
    .site-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: box-shadow 200ms, border-color 200ms;
    }
    .site-card:hover {
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }
    .site-card--active {
      border-color: rgba(99,102,241,0.5);
      box-shadow: 0 0 0 2px rgba(99,102,241,0.12);
    }

    .site-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .site-favicon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgb(var(--color-surface-elevated));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .site-info {
      flex: 1;
      min-width: 0;
    }

    .site-domain {
      font-size: 15px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .site-id-badge {
      font-size: 11px;
      color: rgb(var(--color-text-muted));
      margin-top: 2px;
      font-family: monospace;
    }

    .active-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      background: rgba(52,211,153,0.12);
      color: rgb(52,211,153);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }

    /* Tracked Link */
    .tracked-link-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      padding: 10px 14px;
      flex-wrap: wrap;
    }

    .tracked-link-label {
      font-size: 11px;
      font-weight: 600;
      color: rgb(var(--color-text-muted));
      text-transform: uppercase;
      letter-spacing: 0.06em;
      flex-shrink: 0;
    }

    .tracked-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-weight: 600;
      color: rgb(var(--color-accent));
      text-decoration: none;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tracked-link:hover { text-decoration: underline; }

    .click-hint {
      font-size: 11px;
      color: rgb(var(--color-text-muted));
      flex-shrink: 0;
    }

    /* Live Stats */
    .live-stats-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .live-dot-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgb(52,211,153);
      box-shadow: 0 0 0 0 rgba(52,211,153,0.4);
      animation: pulse-dot 2s infinite;
      flex-shrink: 0;
    }

    @keyframes pulse-dot {
      0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
      70%  { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
      100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
    }

    .live-label {
      font-size: 12px;
      font-weight: 600;
      color: rgb(52,211,153);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .stats-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .chip--green  { background: rgba(52,211,153,0.1);  color: rgb(52,211,153); }
    .chip--blue   { background: rgba(96,165,250,0.1);  color: rgb(96,165,250); }
    .chip--purple { background: rgba(167,139,250,0.1); color: rgb(167,139,250); }
    .chip--orange { background: rgba(251,146,60,0.1);  color: rgb(251,146,60); }
    .chip--teal   { background: rgba(45,212,191,0.1);  color: rgb(45,212,191); }

    .stats-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: rgb(var(--color-text-muted));
    }

    /* Card Footer */
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 4px;
      border-top: 1px solid rgb(var(--color-border));
    }

    .events-today {
      font-size: 12px;
      color: rgb(var(--color-text-muted));
    }

    /* Spinners */
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgb(var(--color-border));
      border-top-color: rgb(var(--color-accent));
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .mini-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgb(var(--color-border));
      border-top-color: rgb(var(--color-accent));
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-left: 4px solid rgb(52,211,153);
      border-radius: 12px;
      padding: 14px 20px;
      font-size: 13px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slide-in 0.25s ease;
    }
    .toast--error {
      border-left-color: rgb(248,113,113);
    }

    @keyframes slide-in {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    @media (max-width: 768px) {
      .page { padding: 16px; }
      .sites-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; }
    }
  `]
})
export class WebsitesComponent implements OnInit, OnDestroy {
  private readonly api = inject(TrafficApiService);
  readonly activeSite = inject(ActiveSiteService);
  private readonly router = inject(Router);

  sites = signal<SiteDto[]>([]);
  loading = signal(true);
  showAddForm = signal(false);
  newUrl = '';
  adding = signal(false);
  addError = signal('');
  activeSiteId = signal<string | null>(null);

  /** Map of siteId -> live stats */
  liveMap = signal<Record<string, LiveStatsDto>>({});

  toast = signal('');
  toastType = signal<'success' | 'error'>('success');

  private liveInterval: Subscription | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadSites();
    // Sync active site from service
    const active = this.activeSite.site();
    if (active) this.activeSiteId.set(active.siteId);
  }

  ngOnDestroy(): void {
    this.liveInterval?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadSites(): void {
    this.loading.set(true);
    this.api.listSites().pipe(
      finalize(() => this.loading.set(false)),
      catchError(() => of<SiteDto[]>([]))
    ).subscribe(sites => {
      this.sites.set(sites);
      const active = this.activeSite.site();
      if (active) this.activeSiteId.set(active.siteId);
      this.startLivePolling(sites);
    });
  }

  onAdd(): void {
    const url = this.newUrl.trim();
    if (!url) return;
    this.addError.set('');
    this.adding.set(true);

    this.activeSite.register(url).pipe(
      finalize(() => this.adding.set(false)),
      catchError(err => {
        const msg = err?.error?.message ?? err?.message ?? 'Failed to add website.';
        this.addError.set(msg);
        return of(null);
      })
    ).subscribe(site => {
      if (!site) return;
      this.newUrl = '';
      this.showAddForm.set(false);
      this.activeSiteId.set(site.siteId);
      // Refresh list
      this.api.listSites().pipe(catchError(() => of<SiteDto[]>([]))).subscribe(sites => {
        this.sites.set(sites);
        this.startLivePolling(sites);
      });
      this.showToast(`${site.domain} added and selected!`, 'success');
    });
  }

  selectSite(site: SiteDto): void {
    this.activeSite.selectSiteById(site.siteId);
    this.activeSiteId.set(site.siteId);
    this.showToast(`Switched to ${site.domain}`, 'success');
  }

  viewAnalytics(site: SiteDto): void {
    this.selectSite(site);
    void this.router.navigate(['/']);
  }

  onTrackedLinkClick(event: MouseEvent, site: SiteDto): void {
    // Fire a PageView tracking event for this site
    this.api.collectEvent({
      siteId: site.siteId,
      eventType: 1, // PageView
      pageUrl: `https://${site.domain}/`,
      metadata: { source: 'dashboard_tracked_link', trigger: 'manual_click' },
      timestamp: new Date().toISOString(),
    }).pipe(catchError(() => of(null))).subscribe(() => {
      this.showToast(`Tracking started for ${site.domain}`, 'success');
      // Refresh live stats immediately
      this.fetchLiveStats(site.siteId);
    });
    // Let the link open normally (target="_blank")
  }

  onFaviconError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  private startLivePolling(sites: SiteDto[]): void {
    this.liveInterval?.unsubscribe();
    if (!sites.length) return;

    // Fetch immediately
    sites.forEach(s => this.fetchLiveStats(s.siteId));

    // Then every 15 seconds
    this.liveInterval = interval(15000).subscribe(() => {
      this.sites().forEach(s => this.fetchLiveStats(s.siteId));
    });
  }

  private fetchLiveStats(siteId: string): void {
    this.api.liveStats(siteId).pipe(
      catchError(() => of(null))
    ).subscribe(stats => {
      if (!stats) return;
      this.liveMap.update(map => ({ ...map, [siteId]: stats }));
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set(msg);
    this.toastType.set(type);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3500);
  }
}

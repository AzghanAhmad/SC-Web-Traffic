import { Component, DestroyRef, Injector, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { HeatmapPointDto, PagePointDto } from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { TrafficAutoRefreshService } from '../../services/traffic-auto-refresh.service';
import { httpErrorMessage, timeRangeToDays } from '../../utils/analytics.helpers';

@Component({
  selector: 'app-heatmaps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Heatmaps</h1>
        <p class="page-subtitle">Click coordinates and scroll depth from tracked events</p>
      </div>

      <div class="toolbar animate-in" style="animation-delay: 80ms">
        <label class="field-label" for="heatmap-page">Page URL</label>
        <select id="heatmap-page" class="page-select" [(ngModel)]="selectedPageUrl" (ngModelChange)="onPageChange()">
          @for (p of pageOptions(); track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select>
        <div class="toggle-group">
          <button type="button" [class.active]="activeTab() === 'click'" (click)="activeTab.set('click'); loadHeatmap()">Click map</button>
          <button type="button" [class.active]="activeTab() === 'scroll'" (click)="activeTab.set('scroll'); loadHeatmap()">Scroll depth</button>
        </div>
      </div>

      @if (activeTab() === 'click') {
        <section class="card heatmap-card animate-in" style="animation-delay: 150ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Click density</h3>
              <p class="chart-subtitle">Normalized positions (aggregated X/Y buckets)</p>
            </div>
            <div class="heatmap-stats">
              <div class="stat">
                <span class="stat-value">{{ totalClicks() | number }}</span>
                <span class="stat-label">Total clicks</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ points().length | number }}</span>
                <span class="stat-label">Cells</span>
              </div>
            </div>
          </div>

          <div class="heatmap-viewport">
            <div class="heatmap-canvas">
              @for (pt of points(); track $index) {
                <div
                  class="heat-dot"
                  [style.left.%]="pt.xPct"
                  [style.top.%]="pt.yPct"
                  [style.opacity]="pt.opacity"
                  [title]="pt.count + ' clicks'">
                </div>
              }
            </div>
          </div>
          <p class="hint" *ngIf="!points().length && activeSite.site()">No heatmap data for this page in the selected range.</p>
        </section>
      }

      @if (activeTab() === 'scroll') {
        <section class="card heatmap-card animate-in" style="animation-delay: 150ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Scroll depth buckets</h3>
              <p class="chart-subtitle">From average scroll depth per click cell</p>
            </div>
          </div>
          <div class="scroll-buckets">
            @for (b of scrollBuckets(); track b.depth) {
              <div class="bucket" [style.flex]="b.weight || 1">
                <span class="bucket-depth">{{ b.depth }}%</span>
                <span class="bucket-count">{{ b.count }} pts</span>
              </div>
            }
          </div>
          <p class="hint" *ngIf="!scrollBuckets().length && activeSite.site()">No scroll samples for this page.</p>
        </section>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 28px; max-width: 1440px; margin: 0 auto; }
    .error-banner {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid rgb(var(--color-border));
      background: rgba(248, 113, 113, 0.1);
      color: rgb(248, 113, 113);
    }
    .page-header { margin-bottom: 28px; }
    .page-title { font-size: 24px; font-weight: 700; color: rgb(var(--color-text-primary)); letter-spacing: -0.02em; }
    .page-subtitle { font-size: 14px; color: rgb(var(--color-text-muted)); margin-top: 4px; }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 20px;
    }
    .field-label { font-size: 12px; font-weight: 600; color: rgb(var(--color-text-muted)); display: block; margin-bottom: 6px; }
    .page-select {
      min-width: 280px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgb(var(--color-border));
      background: rgb(var(--color-surface));
      color: rgb(var(--color-text-primary));
      font-size: 13px;
    }

    .toggle-group {
      display: inline-flex;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }
    .toggle-group button {
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: rgb(var(--color-text-muted));
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .toggle-group button.active {
      background: rgb(var(--color-accent));
      color: white;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
    }

    .heatmap-card { padding: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .heatmap-stats { display: flex; gap: 28px; }
    .stat { display: flex; flex-direction: column; align-items: flex-end; }
    .stat-value { font-size: 20px; font-weight: 700; color: rgb(var(--color-text-primary)); }
    .stat-label { font-size: 12px; color: rgb(var(--color-text-muted)); }

    .heatmap-viewport {
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .heatmap-canvas {
      position: relative;
      height: 420px;
      background: linear-gradient(180deg, rgba(99,102,241,0.06), rgba(15,23,42,0.2));
    }
    .heat-dot {
      position: absolute;
      width: 44px;
      height: 44px;
      margin-left: -22px;
      margin-top: -22px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(248, 113, 113, 0.75) 0%, rgba(248, 113, 113, 0.15) 55%, transparent 70%);
      pointer-events: auto;
    }

    .scroll-buckets {
      display: flex;
      gap: 4px;
      min-height: 120px;
      align-items: stretch;
    }
    .bucket {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 12px 8px;
      border-radius: 8px;
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgb(var(--color-border));
      min-width: 48px;
    }
    .bucket-depth { font-size: 14px; font-weight: 700; color: rgb(var(--color-text-primary)); }
    .bucket-count { font-size: 11px; color: rgb(var(--color-text-muted)); }

    .hint { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 12px; }

    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .heatmap-stats { gap: 16px; }
    }
  `]
})
export class HeatmapsComponent {
  readonly activeSite = inject(ActiveSiteService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(TrafficApiService);
  private readonly trafficRefresh = inject(TrafficAutoRefreshService);

  activeTab = signal<'click' | 'scroll'>('click');
  pageOptions = signal<string[]>(['/']);
  selectedPageUrl = '/';
  points = signal<{ xPct: number; yPct: number; opacity: number; count: number }[]>([]);
  scrollBuckets = signal<{ depth: number; count: number; weight: number }[]>([]);
  totalClicks = signal(0);
  loadError = signal('');

  constructor() {
    combineLatest([
      toObservable(this.activeSite.site, { injector: this.injector }),
      toObservable(this.trafficRefresh.pulse, { injector: this.injector }),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([site]) => {
          if (!site) {
            this.loadError.set('');
            this.pageOptions.set(['/']);
            this.selectedPageUrl = '/';
            this.applyPoints([]);
            return of({ ok: true as const, rows: [] as PagePointDto[] });
          }
          return this.api.pages(site.siteId, 30).pipe(
            map(rows => ({ ok: true as const, rows })),
            catchError(err => of({ ok: false as const, err, rows: [] as PagePointDto[] })),
          );
        })
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        const pages = result.rows;
        const urls = pages.map(p => p.pageUrl).filter(Boolean);
        const list = urls.length ? urls : ['/'];
        this.pageOptions.set(list);
        if (!list.includes(this.selectedPageUrl)) {
          this.selectedPageUrl = list[0];
        }
        this.loadHeatmap();
      });
  }

  onPageChange() {
    this.loadHeatmap();
  }

  loadHeatmap() {
    const site = this.activeSite.site();
    if (!site) {
      this.applyPoints([]);
      return;
    }
    const days = timeRangeToDays('30d');
    const url = this.selectedPageUrl;
    this.api
      .heatmap(site.siteId, url, days)
      .pipe(
        map(rows => ({ ok: true as const, rows })),
        catchError(err => of({ ok: false as const, err, rows: [] as HeatmapPointDto[] })),
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        this.applyPoints(result.rows);
      });
  }

  private applyPoints(rows: HeatmapPointDto[]) {
    if (!rows.length) {
      this.points.set([]);
      this.scrollBuckets.set([]);
      this.totalClicks.set(0);
      return;
    }
    const maxX = Math.max(...rows.map(r => r.x), 1);
    const maxY = Math.max(...rows.map(r => r.y), 1);
    const maxC = Math.max(...rows.map(r => r.count), 1);
    const total = rows.reduce((s, r) => s + r.count, 0);
    this.totalClicks.set(total);
    this.points.set(
      rows.map(r => ({
        xPct: (r.x / maxX) * 100,
        yPct: (r.y / maxY) * 100,
        opacity: 0.25 + (r.count / maxC) * 0.75,
        count: r.count,
      }))
    );

    const buckets = new Map<number, number>();
    for (const r of rows) {
      const d = Math.min(100, Math.round(r.avgScrollDepth / 10) * 10);
      buckets.set(d, (buckets.get(d) ?? 0) + r.count);
    }
    const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const maxB = Math.max(...sorted.map(([, c]) => c), 1);
    this.scrollBuckets.set(
      sorted.map(([depth, count]) => ({
        depth,
        count,
        weight: Math.max(1, Math.round((count / maxB) * 8)),
      }))
    );
  }
}

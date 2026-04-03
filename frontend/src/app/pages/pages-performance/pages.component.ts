import { Component, DestroyRef, Injector, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { PagePerformance, PagePointDto } from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { formatDurationSeconds, httpErrorMessage } from '../../utils/analytics.helpers';
import { OutlineIconComponent } from '../../shared/outline-icon/outline-icon.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [CommonModule, OutlineIconComponent],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Pages Performance</h1>
        <p class="page-subtitle">See how your individual pages are performing</p>
      </div>

      <!-- Top Pages Chart -->
      <section class="card chart-section animate-in" style="animation-delay: 100ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">Top Performing Pages</h3>
            <p class="chart-subtitle">By total views in the selected period</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas #pagesChart></canvas>
        </div>
      </section>

      <!-- Performance Table -->
      <section class="card table-section animate-in" style="animation-delay: 200ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">All Pages</h3>
            <p class="chart-subtitle">Detailed breakdown of every page</p>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Page URL</th>
                <th>Views</th>
                <th>Avg Time</th>
                <th>Bounce Rate</th>
                <th>Conversions</th>
              </tr>
            </thead>
            <tbody>
              @for (page of pages; track page.url) {
                <tr>
                  <td class="url-cell">
                    <span class="url-icon"><app-outline-icon name="link" size="sm"></app-outline-icon></span>
                    {{ page.url }}
                  </td>
                  <td class="td-bold">{{ page.views | number }}</td>
                  <td>{{ page.avgTime }}</td>
                  <td>
                    <div class="bounce-cell">
                      <div class="bounce-bar-track">
                        <div class="bounce-bar" [style.width.%]="page.bounceRate"
                             [class]="page.bounceRate > 40 ? 'bounce-high' : page.bounceRate > 25 ? 'bounce-mid' : 'bounce-low'"></div>
                      </div>
                      <span class="bounce-value">{{ page.bounceRate }}%</span>
                    </div>
                  </td>
                  <td class="td-bold">{{ page.conversions | number }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
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

    .chart-section, .table-section { padding: 24px; margin-bottom: 16px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .chart-container { height: 300px; position: relative; }

    .table-wrapper { overflow-x: auto; }

    .url-cell {
      display: flex; align-items: center; gap: 8px;
      font-weight: 500;
      color: rgb(var(--color-text-primary)) !important;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px !important;
    }
    .url-icon {
      display: inline-flex;
      align-items: center;
      color: rgb(var(--color-text-muted));
    }
    .td-bold { font-weight: 600; color: rgb(var(--color-text-primary)) !important; }

    .bounce-cell { display: flex; align-items: center; gap: 10px; }
    .bounce-bar-track {
      width: 80px; height: 6px;
      background: rgb(var(--color-surface-elevated));
      border-radius: 3px; overflow: hidden;
    }
    .bounce-bar { height: 100%; border-radius: 3px; transition: width 0.6s ease-out; }
    .bounce-high { background: rgb(248, 113, 113); }
    .bounce-mid { background: rgb(251, 191, 36); }
    .bounce-low { background: rgb(52, 211, 153); }
    .bounce-value { font-size: 13px; font-weight: 500; }

    @media (max-width: 768px) { .page-container { padding: 16px; } }
  `]
})
export class PagesComponent implements AfterViewInit {
  @ViewChild('pagesChart') pagesChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);

  pages: PagePerformance[] = [];
  loadError = signal('');
  private pagesChart: Chart | null = null;

  constructor() {
    toObservable(this.activeSite.site, { injector: this.injector })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(site => {
          if (!site) {
            this.loadError.set('');
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
        const rows = result.rows;
        this.pages = rows.map(p => ({
          url: p.pageUrl,
          views: p.views,
          avgTime: formatDurationSeconds(p.avgTimeOnPageSeconds),
          bounceRate: 0,
          conversions: 0,
        }));
        queueMicrotask(() => this.syncChart());
      });
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncChart(), 300);
  }

  private syncChart() {
    const canvas = this.pagesChartRef?.nativeElement;
    if (!canvas) return;
    Chart.getChart(canvas)?.destroy();
    this.pagesChart = null;
    if (!this.pages.length) return;
    this.createChart();
  }

  private createChart() {
    const ctx = this.pagesChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const sorted = [...this.pages].sort((a, b) => b.views - a.views).slice(0, 6);

    this.pagesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(p => p.url),
        datasets: [{
          label: 'Views',
          data: sorted.map(p => p.views),
          backgroundColor: [
            'rgba(99, 102, 241, 0.25)', 'rgba(168, 85, 247, 0.25)', 'rgba(52, 211, 153, 0.25)',
            'rgba(251, 191, 36, 0.25)', 'rgba(96, 165, 250, 0.25)', 'rgba(248, 113, 113, 0.25)',
          ],
          borderColor: ['#6366f1', '#a855f7', '#34d399', '#fbbf24', '#60a5fa', '#f87171'],
          borderWidth: 1,
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgb(22, 28, 44)', borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12, titleColor: '#fff', bodyColor: 'rgb(148, 158, 188)' },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 12 } }, border: { display: false } },
          y: { grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 } }, border: { display: false } },
        },
      },
    });
  }
}

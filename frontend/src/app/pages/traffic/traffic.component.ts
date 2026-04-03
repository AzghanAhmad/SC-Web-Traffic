import { Component, DestroyRef, Injector, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import type {
  TimeSeriesPoint,
  CountryTraffic,
  Referrer,
  TrafficOverviewResponse,
  CountryPointDto,
  ReferrerPointDto,
} from '../../models/analytics.types';
import { Chart, registerables } from 'chart.js';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { httpErrorMessage, timeRangeToDays, trendToTimeSeries } from '../../utils/analytics.helpers';

Chart.register(...registerables);

@Component({
  selector: 'app-traffic',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Traffic Analytics</h1>
        <p class="page-subtitle">Deep dive into your website traffic patterns</p>
      </div>

      <!-- Charts Row -->
      <div class="charts-row">
        <section class="card chart-card animate-in" style="animation-delay: 100ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Visitors, Sessions & Pageviews</h3>
              <p class="chart-subtitle">Traffic metrics over time</p>
            </div>
            <div class="toggle-group">
              <button [class.active]="timeRange() === '24h'" (click)="setTimeRange('24h')">24h</button>
              <button [class.active]="timeRange() === '7d'" (click)="setTimeRange('7d')">7 days</button>
              <button [class.active]="timeRange() === '30d'" (click)="setTimeRange('30d')">30 days</button>
            </div>
          </div>
          <div class="chart-container chart-tall">
            <canvas #lineChart></canvas>
          </div>
        </section>
      </div>

      <div class="two-col">
        <!-- Country Traffic -->
        <section class="card animate-in" style="animation-delay: 200ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Traffic by Country</h3>
              <p class="chart-subtitle">Top locations of your audience</p>
            </div>
          </div>
          <div class="chart-container">
            <canvas #countryChart></canvas>
          </div>
        </section>

        <!-- Top Referrers Table -->
        <section class="card animate-in" style="animation-delay: 300ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Top Referrers</h3>
              <p class="chart-subtitle">Where your traffic originates</p>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Visits</th>
                  <th>Engagement</th>
                  <th>Conv %</th>
                </tr>
              </thead>
              <tbody>
                @if (referrers().length === 0) {
                  <tr>
                    <td colspan="4" class="empty-referrers">
                      No referrer URLs in this range — traffic is likely <strong>direct</strong> or the <code>Referer</code> header was not sent.
                    </td>
                  </tr>
                } @else {
                  @for (ref of referrers(); track ref.source) {
                    <tr>
                      <td class="source-cell">
                        <span class="source-dot"></span>
                        {{ ref.source }}
                      </td>
                      <td class="td-value">{{ ref.visits | number }}</td>
                      <td>{{ ref.engagement }}</td>
                      <td>
                        @if (ref.conversion > 0) {
                          <span class="conv-badge" [class]="ref.conversion >= 4 ? 'conv-high' : ref.conversion >= 2 ? 'conv-mid' : 'conv-low'">
                            {{ ref.conversion }}%
                          </span>
                        } @else {
                          <span class="muted-cell">—</span>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
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

    .charts-row { margin-bottom: 16px; }

    .chart-card { padding: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .chart-container { height: 280px; position: relative; }
    .chart-tall { height: 340px; }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .toggle-group {
      display: flex;
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }
    .toggle-group button {
      padding: 6px 12px; border-radius: 6px; font-size: 12px;
      font-weight: 500; color: rgb(var(--color-text-muted));
      background: transparent; border: none; cursor: pointer;
      transition: all 150ms ease;
    }
    .toggle-group button:hover { color: rgb(var(--color-text-secondary)); }
    .toggle-group button.active {
      background: rgb(var(--color-accent)); color: white;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
    }

    .table-wrapper { overflow-x: auto; }

    .source-cell {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 500;
      color: rgb(var(--color-text-primary)) !important;
    }

    .source-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgb(var(--color-accent));
    }

    .td-value { font-weight: 600; color: rgb(var(--color-text-primary)) !important; }

    .conv-badge {
      padding: 3px 8px; border-radius: 9999px;
      font-size: 12px; font-weight: 600;
    }
    .conv-high { background: rgba(52, 211, 153, 0.12); color: rgb(52, 211, 153); }
    .conv-mid { background: rgba(251, 191, 36, 0.12); color: rgb(251, 191, 36); }
    .conv-low { background: rgba(248, 113, 113, 0.12); color: rgb(248, 113, 113); }

    .muted-cell { color: rgb(var(--color-text-muted)); font-size: 13px; }

    .empty-referrers {
      padding: 20px 16px !important;
      text-align: center;
      color: rgb(var(--color-text-muted));
      font-size: 13px;
      line-height: 1.5;
      vertical-align: middle;
    }
    .empty-referrers code {
      font-size: 12px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgb(var(--color-surface-hover));
    }

    @media (max-width: 1024px) { .two-col { grid-template-columns: 1fr; } }
    @media (max-width: 768px) { .page-container { padding: 16px; } }
  `]
})
export class TrafficComponent implements AfterViewInit {
  @ViewChild('lineChart') lineChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('countryChart') countryChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);

  /** Signals: zoneless Angular — HTTP subscribe must update signals so the table/charts repaint. */
  timeSeriesData = signal<TimeSeriesPoint[]>([]);
  countries = signal<CountryTraffic[]>([]);
  referrers = signal<Referrer[]>([]);
  timeRange = signal<'24h' | '7d' | '30d'>('7d');
  loadError = signal('');

  private lineChart: Chart | null = null;
  private countryChart: Chart | null = null;

  constructor() {
    combineLatest([
      toObservable(this.activeSite.site, { injector: this.injector }),
      toObservable(this.timeRange, { injector: this.injector }),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([site, range]) => {
          if (!site) {
            this.loadError.set('');
            return of<{
              overview: TrafficOverviewResponse | null;
              countries: CountryPointDto[] | null;
              referrers: ReferrerPointDto[] | null;
            }>({
              overview: null,
              countries: null,
              referrers: null,
            });
          }
          const days = timeRangeToDays(range);
          return forkJoin({
            overview: this.api.overview(site.siteId, days).pipe(
              catchError(err => {
                this.loadError.set(httpErrorMessage(err));
                return of<TrafficOverviewResponse | null>(null);
              }),
            ),
            countries: this.api.countries(site.siteId, days).pipe(catchError(() => of<CountryPointDto[]>([]))),
            referrers: this.api.referrers(site.siteId, days, 20).pipe(catchError(() => of<ReferrerPointDto[]>([]))),
          });
        })
      )
      .subscribe(res => {
        if (!res.overview) {
          this.timeSeriesData.set([]);
          this.countries.set([]);
          this.referrers.set([]);
          queueMicrotask(() => this.syncCharts());
          return;
        }
        this.loadError.set('');
        this.timeSeriesData.set(trendToTimeSeries(res.overview.trendData));
        const countries = res.countries ?? [];
        const referrers = res.referrers ?? [];
        this.countries.set(
          countries.map(c => ({
            country: c.country,
            visits: c.sessions,
            percentage: Math.round(c.percentage * 10) / 10,
          })),
        );
        this.referrers.set(
          referrers.map(r => ({
            source: r.source,
            visits: r.visits,
            engagement: '—',
            conversion: 0,
          })),
        );
        queueMicrotask(() => this.syncCharts());
      });
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncCharts(), 300);
  }

  setTimeRange(range: '24h' | '7d' | '30d') {
    this.timeRange.set(range);
  }

  private destroyCharts() {
    const lc = this.lineChartRef?.nativeElement;
    const cc = this.countryChartRef?.nativeElement;
    if (lc) Chart.getChart(lc)?.destroy();
    if (cc) Chart.getChart(cc)?.destroy();
    this.lineChart = null;
    this.countryChart = null;
  }

  private syncCharts() {
    const series = this.timeSeriesData();
    if (!series.length) {
      this.destroyCharts();
      return;
    }
    if (!this.lineChartRef?.nativeElement) return;
    if (!this.lineChart) {
      this.createLineChart();
    } else {
      this.lineChart.data.labels = series.map(d => d.date);
      this.lineChart.data.datasets[0].data = series.map(d => d.visitors);
      this.lineChart.data.datasets[1].data = series.map(d => d.sessions);
      this.lineChart.data.datasets[2].data = series.map(d => d.pageviews);
      this.lineChart.update('active');
    }
    if (!this.countryChartRef?.nativeElement) return;
    const countries = this.countries();
    if (!countries.length) {
      if (this.countryChart) {
        Chart.getChart(this.countryChartRef.nativeElement)?.destroy();
        this.countryChart = null;
      }
      return;
    }
    if (!this.countryChart) {
      this.createCountryChart();
    } else {
      const colors = ['#6366f1', '#a855f7', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#fb923c', '#94a3b8'];
      this.countryChart.data.labels = countries.map(c => c.country);
      const ds = this.countryChart.data.datasets[0];
      ds.data = countries.map(c => c.visits);
      ds.backgroundColor = countries.map((_, i) => colors[i % colors.length] + '33');
      ds.borderColor = countries.map((_, i) => colors[i % colors.length]);
      this.countryChart.update('active');
    }
  }

  private createLineChart() {
    const ctx = this.lineChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const series = this.timeSeriesData();
    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.map(d => d.date),
        datasets: [
          {
            label: 'Visitors',
            data: series.map(d => d.visitors),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            borderWidth: 2, fill: true, tension: 0.4,
            pointRadius: 0, pointHoverRadius: 5,
          },
          {
            label: 'Sessions',
            data: series.map(d => d.sessions),
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            borderWidth: 2, fill: true, tension: 0.4,
            pointRadius: 0, pointHoverRadius: 5,
          },
          {
            label: 'Pageviews',
            data: series.map(d => d.pageviews),
            borderColor: '#34d399',
            backgroundColor: 'rgba(52, 211, 153, 0.08)',
            borderWidth: 2, fill: true, tension: 0.4,
            pointRadius: 0, pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: {
          padding: { left: 18, right: 10 },
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 12 }, boxWidth: 12, boxHeight: 3, useBorderRadius: true, borderRadius: 2, padding: 16 },
          },
          tooltip: {
            backgroundColor: 'rgb(22, 28, 44)', titleColor: 'rgb(240, 242, 255)', bodyColor: 'rgb(148, 158, 188)',
            borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12,
          },
        },
        scales: {
          x: {
            offset: true,
            grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false },
            ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 }, maxRotation: 0 },
            border: { display: false },
          },
          y: { grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 } }, border: { display: false } },
        },
      },
    });
  }

  private createCountryChart() {
    const ctx = this.countryChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const colors = ['#6366f1', '#a855f7', '#34d399', '#fbbf24', '#60a5fa', '#f87171', '#fb923c', '#94a3b8'];

    const countries = this.countries();
    this.countryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: countries.map(c => c.country),
        datasets: [{
          label: 'Visits',
          data: countries.map(c => c.visits),
          backgroundColor: countries.map((_, i) => colors[i % colors.length] + '33'),
          borderColor: countries.map((_, i) => colors[i % colors.length]),
          borderWidth: 1,
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgb(22, 28, 44)', borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12, titleColor: '#fff', bodyColor: 'rgb(148, 158, 188)' },
        },
        scales: {
          x: { grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 } }, border: { display: false } },
          y: { grid: { display: false }, ticks: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 12 } }, border: { display: false } },
        },
      },
    });
  }
}

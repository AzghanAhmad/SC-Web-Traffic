import {
  Component,
  DestroyRef,
  Injector,
  ViewChild,
  ElementRef,
  AfterViewInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { KpiCardComponent } from '../../shared/kpi-card/kpi-card.component';
import { InsightCardComponent } from '../../shared/insight-card/insight-card.component';
import { OutlineIconComponent } from '../../shared/outline-icon/outline-icon.component';
import type {
  KpiData,
  TrafficSource,
  Insight,
  TimeSeriesPoint,
  WhatChanged,
  TrafficOverviewResponse,
  SourcePointDto,
} from '../../models/analytics.types';
import { Chart, registerables } from 'chart.js';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import {
  buildOverviewKpis,
  httpErrorMessage,
  sourcesToTrafficSources,
  timeRangeToDays,
  trendToTimeSeries,
} from '../../utils/analytics.helpers';

Chart.register(...registerables);

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, KpiCardComponent, InsightCardComponent, OutlineIconComponent],
  template: `
    <div class="page-container">
      @if (!activeSite.site() && !activeSite.loading()) {
        <div class="site-banner">Paste a website URL in the header to register it. All traffic insights use that site.</div>
      }
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }

      <!-- What Changed Today -->
      @if (whatChanged().length > 0) {
      <section class="what-changed-section animate-in">
        <div class="section-header">
          <h2 class="section-title">What Changed Today</h2>
        </div>
        <div class="changes-grid">
          @for (change of whatChanged(); track change.title) {
            <div class="change-card" [class]="'change-card--' + change.type">
              <span class="change-icon"><app-outline-icon [name]="change.icon" size="lg"></app-outline-icon></span>
              <div class="change-content">
                <h4>{{ change.title }}</h4>
                <p>{{ change.description }}</p>
              </div>
              <span class="change-metric" [class]="'metric--' + change.type">{{ change.metric }}</span>
            </div>
          }
        </div>
      </section>
      }

      <!-- KPI Cards -->
      <section class="kpi-section">
        <div class="kpi-grid">
          @for (kpi of kpiData(); track kpi.label) {
            <app-kpi-card [data]="kpi"></app-kpi-card>
          }
        </div>
      </section>

      <!-- Charts Row -->
      <div class="charts-row">
        <!-- Traffic Over Time -->
        <section class="card chart-card chart-card--wide animate-in" style="animation-delay: 200ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Traffic Over Time</h3>
              <p class="chart-subtitle">Visitors & sessions trends</p>
            </div>
            <div class="toggle-group">
              <button [class.active]="timeRange() === '24h'" (click)="setTimeRange('24h')">24h</button>
              <button [class.active]="timeRange() === '7d'" (click)="setTimeRange('7d')">7 days</button>
              <button [class.active]="timeRange() === '30d'" (click)="setTimeRange('30d')">30 days</button>
            </div>
          </div>
          <div class="chart-container">
            <canvas #trafficChart></canvas>
          </div>
        </section>

        <!-- Traffic Sources -->
        <section class="card chart-card animate-in" style="animation-delay: 300ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Traffic Sources</h3>
              <p class="chart-subtitle">Where visitors come from</p>
            </div>
          </div>
          <div class="chart-container donut-container">
            <canvas #sourcesChart></canvas>
          </div>
          <div class="source-legend">
            @for (source of trafficSources(); track source.name) {
              <div class="legend-item">
                <span class="legend-dot" [style.background]="source.color"></span>
                <span class="legend-label">{{ source.name }}</span>
                <span class="legend-value">{{ source.value }}%</span>
              </div>
            }
          </div>
        </section>
      </div>

      <!-- Insights Panel -->
      @if (insights().length > 0) {
      <section class="insights-section animate-in" style="animation-delay: 400ms">
        <div class="section-header">
          <h2 class="section-title">AI Insights</h2>
          <p class="section-subtitle">Automatically detected patterns & anomalies</p>
        </div>
        <div class="insights-grid">
          @for (insight of insights(); track insight.text) {
            <app-insight-card [insight]="insight"></app-insight-card>
          }
        </div>
      </section>
      }
    </div>
  `,
  styles: [`
    .page-container {
      padding: 28px;
      max-width: 1440px;
      margin: 0 auto;
    }

    .site-banner, .error-banner {
      padding: 12px 16px;
      border-radius: var(--radius-md);
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid rgb(var(--color-border));
    }
    .site-banner {
      background: rgba(99, 102, 241, 0.08);
      color: rgb(var(--color-text-secondary));
    }
    .error-banner {
      background: rgba(248, 113, 113, 0.1);
      color: rgb(248, 113, 113);
    }

    /* What Changed Section */
    .what-changed-section {
      margin-bottom: 28px;
    }

    .section-header {
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      letter-spacing: -0.01em;
    }

    .section-subtitle {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      margin-top: 4px;
    }

    .changes-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .change-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      padding: 16px 20px;
      transition: all var(--transition-base);
    }

    .change-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .change-card--spike { border-left: 3px solid rgb(52, 211, 153); }
    .change-card--drop { border-left: 3px solid rgb(248, 113, 113); }
    .change-card--milestone { border-left: 3px solid rgb(99, 102, 241); }

    .change-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: rgb(var(--color-text-muted));
    }

    .change-content {
      flex: 1;
      min-width: 0;
    }

    .change-content h4 {
      font-size: 14px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
      margin-bottom: 2px;
    }

    .change-content p {
      font-size: 12px;
      color: rgb(var(--color-text-muted));
    }

    .change-metric {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 9999px;
      white-space: nowrap;
    }

    .metric--spike { background: rgba(52, 211, 153, 0.12); color: rgb(52, 211, 153); }
    .metric--drop { background: rgba(248, 113, 113, 0.12); color: rgb(248, 113, 113); }
    .metric--milestone { background: rgba(99, 102, 241, 0.12); color: rgb(99, 102, 241); }

    /* KPI Grid */
    .kpi-section {
      margin-bottom: 28px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    /* Charts Row */
    .charts-row {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 16px;
      margin-bottom: 28px;
    }

    .chart-card {
      padding: 24px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .chart-title {
      font-size: 16px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
    }

    .chart-subtitle {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      margin-top: 2px;
    }

    .chart-container {
      height: 280px;
      position: relative;
    }

    .donut-container {
      height: 220px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .donut-container canvas {
      max-height: 100%;
    }

    .source-legend {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 20px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-label {
      color: rgb(var(--color-text-secondary));
      flex: 1;
    }

    .legend-value {
      font-weight: 600;
      color: rgb(var(--color-text-primary));
    }

    /* Toggle Group */
    .toggle-group {
      display: flex;
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }

    .toggle-group button {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      color: rgb(var(--color-text-muted));
      background: transparent;
      border: none;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .toggle-group button:hover {
      color: rgb(var(--color-text-secondary));
    }

    .toggle-group button.active {
      background: rgb(var(--color-accent));
      color: white;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
    }

    /* Insights */
    .insights-section {
      margin-bottom: 28px;
    }

    .insights-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
      .changes-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .kpi-grid { grid-template-columns: 1fr; }
      .insights-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class OverviewComponent implements AfterViewInit {
  @ViewChild('trafficChart') trafficChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sourcesChart') sourcesChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);

  /** Signals: Angular 21 is zoneless by default; async HTTP updates must notify the template. */
  kpiData = signal<KpiData[]>([]);
  trafficSources = signal<TrafficSource[]>([]);
  insights = signal<Insight[]>([]);
  whatChanged = signal<WhatChanged[]>([]);
  timeSeriesData = signal<TimeSeriesPoint[]>([]);
  timeRange = signal<'24h' | '7d' | '30d'>('7d');
  loadError = signal('');

  private trafficChart: Chart | null = null;
  private sourcesChart: Chart | null = null;

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
            return of<{ overview: TrafficOverviewResponse | null; sources: SourcePointDto[] | null }>({
              overview: null,
              sources: null,
            });
          }
          const days = timeRangeToDays(range);
          // Overview and sources are requested together; if one fails (e.g. CORS on a single route),
          // still show KPIs when overview succeeds. Thunder Client often tests only one URL.
          return forkJoin({
            overview: this.api.overview(site.siteId, days).pipe(
              catchError(err => {
                this.loadError.set(httpErrorMessage(err));
                return of<TrafficOverviewResponse | null>(null);
              }),
            ),
            sources: this.api.sources(site.siteId, days).pipe(catchError(() => of<SourcePointDto[]>([]))),
          });
        })
      )
      .subscribe(res => {
        if (!res.overview) {
          this.applyEmpty();
          queueMicrotask(() => this.syncCharts());
          return;
        }
        this.loadError.set('');
        this.kpiData.set(buildOverviewKpis(res.overview));
        this.trafficSources.set(sourcesToTrafficSources(res.sources ?? []));
        this.timeSeriesData.set(trendToTimeSeries(res.overview.trendData));
        this.insights.set(this.buildInsights(res.overview));
        this.whatChanged.set([]);
        queueMicrotask(() => this.syncCharts());
      });
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncCharts(), 300);
  }

  setTimeRange(range: '24h' | '7d' | '30d') {
    this.timeRange.set(range);
  }

  private buildInsights(overview: TrafficOverviewResponse): Insight[] {
    const t = overview.trendData;
    const out: Insight[] = [];
    if (t.length >= 2) {
      const a = t[t.length - 2].visitors;
      const b = t[t.length - 1].visitors;
      if (a > 0 && b > a * 1.1) {
        out.push({
          icon: 'trend-up',
          text: 'Latest period shows higher visitors than the previous point.',
          highlight: `+${b - a}`,
          type: 'success',
        });
      }
    }
    if (overview.conversions > 0) {
      out.push({
        icon: 'target',
        text: 'Conversions recorded in this range.',
        highlight: String(overview.conversions),
        type: 'info',
      });
    }
    return out.slice(0, 4);
  }

  private applyEmpty() {
    this.kpiData.set([]);
    this.trafficSources.set([]);
    this.timeSeriesData.set([]);
    this.insights.set([]);
    this.whatChanged.set([]);
  }

  private destroyTrafficChart() {
    const tc = this.trafficChartRef?.nativeElement;
    if (tc) {
      const c = Chart.getChart(tc);
      c?.destroy();
    }
    this.trafficChart = null;
  }

  private destroySourcesChart() {
    const sc = this.sourcesChartRef?.nativeElement;
    if (sc) {
      const c = Chart.getChart(sc);
      c?.destroy();
    }
    this.sourcesChart = null;
  }

  private syncCharts() {
    const series = this.timeSeriesData();
    const sources = this.trafficSources();
    const trafficEl = this.trafficChartRef?.nativeElement;
    const sourcesEl = this.sourcesChartRef?.nativeElement;

    if (!series.length) {
      this.destroyTrafficChart();
    } else if (trafficEl) {
      if (!this.trafficChart) {
        this.createTrafficChart();
      } else {
        this.updateTrafficChart();
      }
    }

    if (!sources.length) {
      this.destroySourcesChart();
    } else if (sourcesEl) {
      if (!this.sourcesChart) {
        this.createSourcesChart();
      } else {
        this.updateSourcesChart();
      }
    }
  }

  private updateSourcesChart() {
    if (!this.sourcesChart) return;
    const sources = this.trafficSources();
    this.sourcesChart.data.labels = sources.map(s => s.name);
    const ds = this.sourcesChart.data.datasets[0];
    ds.data = sources.map(s => s.value);
    ds.backgroundColor = sources.map(s => s.color);
    this.sourcesChart.update('active');
  }

  private createTrafficChart() {
    const ctx = this.trafficChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const gradient1 = ctx.createLinearGradient(0, 0, 0, 280);
    gradient1.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    gradient1.addColorStop(1, 'rgba(99, 102, 241, 0)');

    const gradient2 = ctx.createLinearGradient(0, 0, 0, 280);
    gradient2.addColorStop(0, 'rgba(168, 85, 247, 0.15)');
    gradient2.addColorStop(1, 'rgba(168, 85, 247, 0)');

    const series = this.timeSeriesData();
    this.trafficChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.map(d => d.date),
        datasets: [
          {
            label: 'Visitors',
            data: series.map(d => d.visitors),
            borderColor: '#6366f1',
            backgroundColor: gradient1,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
          {
            label: 'Sessions',
            data: series.map(d => d.sessions),
            borderColor: '#a855f7',
            backgroundColor: gradient2,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#a855f7',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { left: 18, right: 10 },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: 'rgb(148, 158, 188)',
              font: { family: 'Inter', size: 12 },
              boxWidth: 12,
              boxHeight: 3,
              borderRadius: 2,
              useBorderRadius: true,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: 'rgb(22, 28, 44)',
            titleColor: 'rgb(240, 242, 255)',
            bodyColor: 'rgb(148, 158, 188)',
            borderColor: 'rgb(38, 48, 72)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 4,
            usePointStyle: true,
          },
        },
        scales: {
          x: {
            offset: true,
            grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false },
            ticks: {
              color: 'rgb(98, 108, 138)',
              font: { family: 'Inter', size: 11 },
              maxRotation: 0,
              padding: 8,
            },
            border: { display: false },
          },
          y: {
            grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false },
            ticks: {
              color: 'rgb(98, 108, 138)',
              font: { family: 'Inter', size: 11 },
              padding: 8,
            },
            border: { display: false },
          },
        },
      },
    });
  }

  private updateTrafficChart() {
    if (!this.trafficChart) return;
    const series = this.timeSeriesData();
    this.trafficChart.data.labels = series.map(d => d.date);
    this.trafficChart.data.datasets[0].data = series.map(d => d.visitors);
    this.trafficChart.data.datasets[1].data = series.map(d => d.sessions);
    this.trafficChart.update('active');
  }

  private createSourcesChart() {
    const ctx = this.sourcesChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const sources = this.trafficSources();
    this.sourcesChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: sources.map(s => s.name),
        datasets: [{
          data: sources.map(s => s.value),
          backgroundColor: sources.map(s => s.color),
          borderColor: 'rgb(16, 20, 32)',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgb(22, 28, 44)',
            titleColor: 'rgb(240, 242, 255)',
            bodyColor: 'rgb(148, 158, 188)',
            borderColor: 'rgb(38, 48, 72)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: (context) => ` ${context.parsed}%`
            }
          },
        },
      },
    });
  }
}

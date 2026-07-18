import { Component, DestroyRef, Injector, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, forkJoin, of, type Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type {
  ConversionMetric,
  FunnelStep,
  TrafficOverviewResponse,
  ConversionPointDto,
  FunnelStepDto,
  PagePointDto,
} from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { TrafficAutoRefreshService } from '../../services/traffic-auto-refresh.service';
import { httpErrorMessage } from '../../utils/analytics.helpers';
import { funnelDtoToDisplaySteps, funnelStepsFromPageUrls } from '../../utils/funnel.helpers';
import { OutlineIconComponent } from '../../shared/outline-icon/outline-icon.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-conversions',
  standalone: true,
  imports: [CommonModule, OutlineIconComponent],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Conversions</h1>
        <p class="page-subtitle">Track your conversion performance and funnel efficiency</p>
      </div>

      <!-- Conversion Metrics -->
      <div class="metrics-grid">
        @for (metric of conversionMetrics(); track metric.label; let i = $index) {
          <div class="metric-card animate-in" [style.animation-delay]="(i * 80) + 'ms'">
            <div class="metric-header">
              <span class="metric-icon"><app-outline-icon [name]="metric.icon" size="lg"></app-outline-icon></span>
            </div>
            <div class="metric-value">{{ metric.value | number }}</div>
            <div class="metric-label">{{ metric.label }}</div>
          </div>
        }
      </div>

      <!-- Funnel Visualization -->
      <section class="card funnel-section animate-in" style="animation-delay: 300ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">Conversion Funnel</h3>
            <p class="chart-subtitle">User journey from landing to purchase</p>
          </div>
        </div>

        <div class="funnel-visual">
          @if (funnelData().length === 0) {
            <p class="funnel-empty">No funnel steps returned for this site yet. Traffic and page data will populate this after more events are collected.</p>
          }
          @for (step of funnelData(); track step.label; let i = $index; let last = $last) {
            <div class="funnel-step">
              <div class="funnel-bar-wrapper">
                <div class="funnel-bar" [style.width.%]="step.percentage"
                     [style.animation-delay]="(i * 150 + 400) + 'ms'">
                  <span class="funnel-bar-label">{{ step.visitors | number }}</span>
                </div>
              </div>
              <div class="funnel-info">
                <span class="funnel-step-name">{{ step.label }}</span>
                <span class="funnel-step-pct">{{ step.percentage }}%</span>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Conversion Rate Chart (Redesigned) -->
      <div class="chart-card-clean animate-in" style="animation-delay: 500ms">
        <div class="chart-header">
          <div>
            <h3>Conversion Trend</h3>
            <p class="chart-subtitle">Daily conversions from your overview trend (last 30 days)</p>
          </div>
          <div class="chart-legend-row">
            <div class="chart-legend">
              <span class="dot" style="background: #34d399"></span>
              Conversions
            </div>
          </div>
        </div>
        <div class="chart-body">
          <div class="chart-container">
            <canvas #conversionChart></canvas>
          </div>
        </div>
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

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-lg);
      padding: 22px;
      transition: all var(--transition-base);
    }
    .metric-card:hover {
      border-color: rgb(var(--color-border-light));
      box-shadow: var(--shadow-glow);
      transform: translateY(-2px);
    }

    .metric-header { display: flex; justify-content: flex-start; align-items: center; margin-bottom: 14px; }
    .metric-icon {
      display: inline-flex;
      align-items: center;
      color: rgb(var(--color-text-muted));
    }

    .metric-value { font-size: 32px; font-weight: 700; color: rgb(var(--color-text-primary)); line-height: 1.1; margin-bottom: 4px; }
    .metric-label { font-size: 13px; color: rgb(var(--color-text-muted)); font-weight: 500; }

    /* Funnel */
    .funnel-section { padding: 24px; margin-bottom: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .funnel-visual { display: flex; flex-direction: column; gap: 0; }

    .funnel-empty {
      margin: 0;
      padding: 16px 4px 8px;
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      line-height: 1.5;
    }

    .funnel-step { margin-bottom: 4px; }

    .funnel-bar-wrapper {
      background: rgb(var(--color-surface-elevated));
      border-radius: 8px;
      height: 44px;
      overflow: hidden;
      position: relative;
    }

    .funnel-bar {
      height: 100%;
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.3), rgba(168, 85, 247, 0.3));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 16px;
      animation: growWidth 0.8s ease-out forwards;
      position: relative;
      min-width: 80px;
    }

    @keyframes growWidth {
      from { max-width: 0; }
      to { max-width: 100%; }
    }

    .funnel-bar-label {
      font-size: 14px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
    }

    .funnel-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 4px;
    }

    .funnel-step-name {
      font-size: 13px;
      color: rgb(var(--color-text-secondary));
      font-weight: 500;
    }

    .funnel-step-pct {
      font-size: 13px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
    }

    .funnel-dropout {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 4px 8px;
    }

    .dropout-text {
      font-size: 11px;
      color: rgb(248, 113, 113);
      font-weight: 500;
    }

    /* Redesigned Chart Card */
    .chart-card-clean {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .chart-card-clean:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .chart-header h3 {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .chart-legend-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #475569;
      font-weight: 500;
    }

    .chart-legend .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .chart-legend .dot.dashed {
      background: transparent !important;
      border: 2px dashed;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .chart-body {
      width: 100%;
      position: relative;
    }

    .chart-subtitle {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      margin-top: 2px;
    }

    .chart-container { height: 280px; position: relative; }

    @media (max-width: 1024px) { .metrics-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .metrics-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ConversionsComponent implements AfterViewInit {
  @ViewChild('conversionChart') conversionChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);
  private readonly trafficRefresh = inject(TrafficAutoRefreshService);

  /** Signals: zoneless — HTTP-driven UI must use signals to repaint without user interaction. */
  conversionMetrics = signal<ConversionMetric[]>([]);
  funnelData = signal<FunnelStep[]>([]);
  loadError = signal('');
  private trendLabels = signal<string[]>([]);
  private trendConversions = signal<number[]>([]);
  private conversionChart: Chart | null = null;

  constructor() {
    const days = 30;
    combineLatest([
      toObservable(this.activeSite.site, { injector: this.injector }),
      toObservable(this.trafficRefresh.pulse, { injector: this.injector }),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([site]) => {
          if (!site) {
            this.loadError.set('');
            return of<{ metrics: ConversionMetric[]; funnel: FunnelStep[]; labels: string[]; conv: number[] } | null>(null);
          }
          return forkJoin({
            overview: this.api.overview(site.siteId, days).pipe(
              catchError(err => {
                this.loadError.set(httpErrorMessage(err));
                return of<TrafficOverviewResponse | null>(null);
              }),
            ),
            conv: this.api.conversions(site.siteId, days).pipe(catchError(() => of<ConversionPointDto[]>([]))),
            pages: this.api.pages(site.siteId, days).pipe(catchError(() => of<PagePointDto[]>([]))),
          }).pipe(
            switchMap(
              ({ overview, conv, pages }): Observable<{
                metrics: ConversionMetric[];
                funnel: FunnelStep[];
                labels: string[];
                conv: number[];
              } | null> => {
                if (!overview) return of(null);
                const urls = pages.map(p => p.pageUrl).filter(Boolean);
                const steps = funnelStepsFromPageUrls(urls);
                if (steps.length === 0) {
                  const labels = overview.trendData.map(t => t.date);
                  const convSeries = overview.trendData.map(t => t.conversions);
                  const metrics: ConversionMetric[] = conv.slice(0, 4).map((c, i) => ({
                    label: c.type,
                    value: c.count,
                    change: 0,
                    icon: this.metricIcon(c.type, i),
                  }));
                  return of({ metrics, funnel: [] as FunnelStep[], labels, conv: convSeries });
                }
                return this.api.funnels(site.siteId, steps, days).pipe(
                  map(funnel => ({ overview, conv, funnel })),
                  catchError(() => of({ overview, conv, funnel: [] as FunnelStepDto[] })),
                  map(({ overview: ov, conv: cv, funnel }) => {
                    const metrics: ConversionMetric[] = cv.slice(0, 4).map((c, i) => ({
                      label: c.type,
                      value: c.count,
                      change: 0,
                      icon: this.metricIcon(c.type, i),
                    }));
                    const fd = funnelDtoToDisplaySteps(funnel);
                    const labels = ov.trendData.map(t => t.date);
                    const convSeries = ov.trendData.map(t => t.conversions);
                    return { metrics, funnel: fd, labels, conv: convSeries };
                  }),
                );
              },
            ),
          );
        })
      )
      .subscribe(res => {
        if (!res) {
          this.conversionMetrics.set([]);
          this.funnelData.set([]);
          this.trendLabels.set([]);
          this.trendConversions.set([]);
          queueMicrotask(() => this.syncChart());
          return;
        }
        this.loadError.set('');
        this.conversionMetrics.set(res.metrics);
        this.funnelData.set(res.funnel);
        this.trendLabels.set(res.labels);
        this.trendConversions.set(res.conv);
        queueMicrotask(() => this.syncChart());
      });
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncChart(), 400);
  }

  private metricIcon(type: string, index: number): string {
    const t = type.toLowerCase();
    if (t.includes('purchase') || t.includes('buy') || t.includes('cart')) return 'cart';
    if (t.includes('mail') || t.includes('news')) return 'mail';
    if (t.includes('trial') || t.includes('play') || t.includes('start')) return 'play';
    if (t.includes('receipt') || t.includes('order')) return 'receipt';
    const fallbacks = ['target', 'activity', 'bar-chart', 'trend-up'];
    return fallbacks[index % fallbacks.length];
  }

  private syncChart() {
    const canvas = this.conversionChartRef?.nativeElement;
    if (!canvas) return;
    const labels = this.trendLabels();
    const conv = this.trendConversions();
    if (!labels.length) {
      Chart.getChart(canvas)?.destroy();
      this.conversionChart = null;
      return;
    }
    if (!this.conversionChart) {
      this.createConversionChart();
    } else {
      this.conversionChart.data.labels = labels;
      this.conversionChart.data.datasets[0].data = conv;
      this.conversionChart.update('active');
    }
  }

  private createConversionChart() {
    const ctx = this.conversionChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(52, 211, 153, 0.15)');
    gradient.addColorStop(1, 'rgba(52, 211, 153, 0)');

    const labels = this.trendLabels();
    const conv = this.trendConversions();

    this.conversionChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Conversions',
          data: conv,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.04)',
          borderWidth: 3,
          fill: true,
          tension: 0.1,
          pointRadius: 4,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#34d399',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#34d399',
          pointHoverBorderWidth: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0f172a',
            bodyColor: '#334155',
            borderColor: '#cbd5e1',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleFont: { family: 'Inter', size: 13, weight: 700 },
            bodyFont: { family: 'Inter', size: 12 },
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 4,
            usePointStyle: true
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, maxRotation: 0 },
            border: { display: false },
          },
          y: {
            grid: { display: true, color: '#e2e8f0', drawTicks: false },
            ticks: {
              color: '#64748b',
              font: { family: 'Inter', size: 11 },
              callback: function(value: any) {
                return value >= 1000 ? (value / 1000).toFixed(1).replace('.0', '') + 'k' : value;
              }
            },
            border: { display: false },
          },
        },
      },
    });
  }
}

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
import { combineLatest, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { Campaign, CampaignPointDto, SourcePointDto } from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { TrafficAutoRefreshService } from '../../services/traffic-auto-refresh.service';
import { httpErrorMessage } from '../../utils/analytics.helpers';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Sources & Campaigns</h1>
        <p class="page-subtitle">Track and compare your campaign performance</p>
      </div>

      <!-- Campaign Comparison Chart (Redesigned) -->
      <div class="chart-card-clean animate-in" style="animation-delay: 100ms">
        <div class="chart-header">
          <div>
            <h3>Campaign Comparison</h3>
            <p class="chart-subtitle">Visits vs conversions across campaigns</p>
          </div>
          <div class="chart-legend-row">
            <div class="chart-legend">
              <span class="dot" style="background: #6366f1"></span>
              Visits
            </div>
            <div class="chart-legend">
              <span class="dot" style="background: #34d399"></span>
              Conversions
            </div>
          </div>
        </div>
        <div class="chart-body">
          <div class="chart-container">
            <canvas #campaignChart></canvas>
            @if (!campaigns().length) {
              <p class="chart-empty">No campaign comparison data yet.</p>
            }
          </div>
        </div>
      </div>

      <!-- Campaign Table -->
      <section class="card table-section animate-in" style="animation-delay: 180ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">Top Sources</h3>
            <p class="chart-subtitle">Sessions by source (selected period)</p>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Sessions</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              @if (!sources().length) {
                <tr>
                  <td colspan="3" class="empty-row">No source data yet.</td>
                </tr>
              } @else {
                @for (s of sources(); track s.source) {
                  <tr>
                    <td class="campaign-name">{{ s.source }}</td>
                    <td class="td-bold">{{ s.sessions | number }}</td>
                    <td>{{ s.percentage }}%</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Campaign Table -->
      <section class="card table-section animate-in" style="animation-delay: 200ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">Campaign Performance</h3>
            <p class="chart-subtitle">All campaigns at a glance</p>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Visits</th>
                <th>Conversions</th>
              </tr>
            </thead>
            <tbody>
              @if (!campaigns().length) {
                <tr>
                  <td colspan="4" class="empty-row">No campaign data yet. Add <code>?campaign=Flash%20Friday</code> or <code>?utm_campaign=summer_sale</code> to your links to track campaigns.</td>
                </tr>
              } @else {
                @for (campaign of campaigns(); track campaign.name) {
                  <tr>
                    <td class="campaign-name">{{ campaign.name }}</td>
                    <td>
                      <span class="status-badge" [class.status-active]="campaign.status === 'active'" [class.status-paused]="campaign.status !== 'active'">
                        {{ campaign.status }}
                      </span>
                    </td>
                    <td class="td-bold">{{ campaign.visits | number }}</td>
                    <td class="td-bold">{{ campaign.conversions | number }}</td>
                  </tr>
                }
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

    .table-section { padding: 24px; margin-bottom: 16px; }

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
      display: none; /* Chart.js already draws Visits / Conversions */
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

    .chart-container { height: 320px; position: relative; }
    .chart-empty {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      margin: 0; font-size: 13px; color: #64748b; pointer-events: none;
    }

    .table-wrapper { overflow-x: auto; }

    .campaign-name { font-weight: 600; color: rgb(var(--color-text-primary)) !important; }
    .td-bold { font-weight: 600; color: rgb(var(--color-text-primary)) !important; }
    .empty-row {
      text-align: center;
      color: rgb(var(--color-text-muted));
      padding: 16px !important;
    }
    .status-badge {
      padding: 4px 10px; border-radius: 9999px;
      font-size: 11px; font-weight: 600;
      text-transform: capitalize;
    }
    .status-active { background: rgba(52, 211, 153, 0.12); color: rgb(52, 211, 153); }
    .status-paused { background: rgba(251, 191, 36, 0.12); color: rgb(251, 191, 36); }
    .status-completed { background: rgba(96, 165, 250, 0.12); color: rgb(96, 165, 250); }

    @media (max-width: 768px) { .page-container { padding: 16px; } }
  `]
})
export class CampaignsComponent implements AfterViewInit {
  @ViewChild('campaignChart') campaignChartRef!: ElementRef<HTMLCanvasElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);
  private readonly trafficRefresh = inject(TrafficAutoRefreshService);

  campaigns = signal<Campaign[]>([]);
  sources = signal<SourcePointDto[]>([]);
  loadError = signal('');
  private campaignChart: Chart | null = null;

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
            this.campaigns.set([]);
            this.sources.set([]);
            return of({ ok: true as const, rows: [] as CampaignPointDto[], sources: [] as SourcePointDto[] });
          }
          return combineLatest([
            this.api.campaigns(site.siteId, 30).pipe(catchError(() => of<CampaignPointDto[]>([]))),
            this.api.sources(site.siteId, 30).pipe(catchError(() => of<SourcePointDto[]>([]))),
          ]).pipe(
            map(([rows, sources]) => ({ ok: true as const, rows, sources })),
            catchError(err => of({ ok: false as const, err, rows: [] as CampaignPointDto[], sources: [] as SourcePointDto[] })),
          );
        })
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        const rows = result.rows;
        this.campaigns.set(
          rows.map(r => ({
            name: r.name,
            visits: r.visits,
            engagement: r.visits > 0 ? `${Math.round((r.conversions / r.visits) * 1000) / 10}%` : '0%',
            conversions: r.conversions,
            revenue: 0,
            status: r.visits > 0 ? 'active' : 'paused',
          })),
        );
        this.sources.set(
          (result.sources ?? []).map(s => ({
            ...s,
            source:
              !s.source || s.source.toLowerCase() === 'direct' || s.source.toLowerCase() === 'none'
                ? 'Direct traffic'
                : s.source.toLowerCase() === 'localhost'
                  ? 'Local / Dev'
                  : s.source,
          })),
        );
        queueMicrotask(() => this.syncChart());
      });
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncChart(), 300);
  }

  private syncChart() {
    requestAnimationFrame(() => {
      const canvas = this.campaignChartRef?.nativeElement;
      if (!canvas) return;
      Chart.getChart(canvas)?.destroy();
      this.campaignChart = null;
      if (!this.campaigns().length) return;
      this.createChart();
    });
  }

  private createChart() {
    const ctx = this.campaignChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const list = this.campaigns();

    this.campaignChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: list.map(c => c.name),
        datasets: [
          {
            label: 'Visits',
            data: list.map(c => c.visits),
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Conversions',
            data: list.map(c => c.conversions),
            backgroundColor: 'rgba(52, 211, 153, 0.25)',
            borderColor: '#34d399',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: '#475569',
              font: { family: 'Inter', size: 12 },
              boxWidth: 12,
              boxHeight: 3,
              useBorderRadius: true,
              borderRadius: 2,
              padding: 16
            },
          },
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
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, maxRotation: 25 },
            border: { display: false }
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
            border: { display: false }
          },
        },
      },
    });
  }
}

import { Component, DestroyRef, Injector, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { Campaign, CampaignPointDto } from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
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

      <!-- Campaign Comparison Chart -->
      <section class="card chart-section animate-in" style="animation-delay: 100ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">Campaign Comparison</h3>
            <p class="chart-subtitle">Visits vs conversions across campaigns</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas #campaignChart></canvas>
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
              @for (campaign of campaigns; track campaign.name) {
                <tr>
                  <td class="campaign-name">{{ campaign.name }}</td>
                  <td>
                    <span class="status-badge status-active">active</span>
                  </td>
                  <td class="td-bold">{{ campaign.visits | number }}</td>
                  <td class="td-bold">{{ campaign.conversions | number }}</td>
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

    .chart-container { height: 320px; position: relative; }

    .table-wrapper { overflow-x: auto; }

    .campaign-name { font-weight: 600; color: rgb(var(--color-text-primary)) !important; }
    .td-bold { font-weight: 600; color: rgb(var(--color-text-primary)) !important; }
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

  campaigns: Campaign[] = [];
  loadError = signal('');
  private campaignChart: Chart | null = null;

  constructor() {
    toObservable(this.activeSite.site, { injector: this.injector })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(site => {
          if (!site) {
            this.loadError.set('');
            return of({ ok: true as const, rows: [] as CampaignPointDto[] });
          }
          return this.api.campaigns(site.siteId, 30).pipe(
            map(rows => ({ ok: true as const, rows })),
            catchError(err => of({ ok: false as const, err, rows: [] as CampaignPointDto[] })),
          );
        })
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        const rows = result.rows;
        this.campaigns = rows.map(r => ({
          name: r.name,
          visits: r.visits,
          engagement: '—',
          conversions: r.conversions,
          revenue: 0,
          status: 'active',
        }));
        queueMicrotask(() => this.syncChart());
      });
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncChart(), 300);
  }

  private syncChart() {
    const canvas = this.campaignChartRef?.nativeElement;
    if (!canvas) return;
    Chart.getChart(canvas)?.destroy();
    this.campaignChart = null;
    if (!this.campaigns.length) return;
    this.createChart();
  }

  private createChart() {
    const ctx = this.campaignChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    this.campaignChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.campaigns.map(c => c.name),
        datasets: [
          {
            label: 'Visits',
            data: this.campaigns.map(c => c.visits),
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 6,
          },
          {
            label: 'Conversions',
            data: this.campaigns.map(c => c.conversions),
            backgroundColor: 'rgba(52, 211, 153, 0.25)',
            borderColor: '#34d399',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top', align: 'end',
            labels: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 12 }, boxWidth: 12, boxHeight: 3, useBorderRadius: true, borderRadius: 2, padding: 16 },
          },
          tooltip: { backgroundColor: 'rgb(22, 28, 44)', borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12, titleColor: '#fff', bodyColor: 'rgb(148, 158, 188)' },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 11 }, maxRotation: 25 }, border: { display: false } },
          y: { grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 } }, border: { display: false } },
        },
      },
    });
  }
}

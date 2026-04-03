import { Component, DestroyRef, Injector, ViewChild, ElementRef, AfterViewInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { DeviceData, DevicePointDto } from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { httpErrorMessage } from '../../utils/analytics.helpers';
import { OutlineIconComponent } from '../../shared/outline-icon/outline-icon.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule, OutlineIconComponent],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Device Insights</h1>
        <p class="page-subtitle">Understand how different devices impact user behavior</p>
      </div>

      <!-- Device cards -->
      <div class="device-cards">
        @for (device of devices(); track device.device; let i = $index) {
          <div class="device-card animate-in" [style.animation-delay]="(i * 100) + 'ms'">
            <div class="device-icon-wrapper">
              <app-outline-icon [name]="deviceIconKey(device.device)" size="lg"></app-outline-icon>
            </div>
            <div class="device-info">
              <span class="device-name">{{ device.device }}</span>
              <span class="device-sessions">{{ device.sessions | number }} sessions</span>
            </div>
            <div class="device-stats">
              <div class="device-stat">
                <span class="stat-value-sm">{{ device.percentage }}%</span>
                <span class="stat-label-sm">Traffic</span>
              </div>
              <div class="device-stat">
                <span class="stat-value-sm">{{ device.percentage }}%</span>
                <span class="stat-label-sm">Share</span>
              </div>
            </div>
          </div>
        }
      </div>

      <div class="charts-row">
        <!-- Device Distribution Pie -->
        <section class="card chart-section animate-in" style="animation-delay: 200ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Device Distribution</h3>
              <p class="chart-subtitle">Traffic share by device type</p>
            </div>
          </div>
          <div class="chart-container donut-container">
            <canvas #devicePie></canvas>
          </div>
        </section>

        <!-- Conversion by Device Bar -->
        <section class="card chart-section animate-in" style="animation-delay: 300ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Sessions by Device</h3>
              <p class="chart-subtitle">Total sessions per device type</p>
            </div>
          </div>
          <div class="chart-container">
            <canvas #conversionBar></canvas>
          </div>
        </section>
      </div>

      <!-- Insight cards -->
      <section class="insights-row animate-in" style="animation-delay: 400ms">
        <div class="insight-box insight-success">
          <span class="insight-icon"><app-outline-icon name="check-circle" size="lg"></app-outline-icon></span>
          <div>
            <strong>Live device split</strong>
            <p>Session share by device comes from your tracked events. Per-device conversion rates are not yet reported by the API.</p>
          </div>
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

    .device-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .device-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-lg);
      padding: 22px;
      display: flex; align-items: center; gap: 16px;
      transition: all var(--transition-base);
    }
    .device-card:hover {
      border-color: rgb(var(--color-border-light));
      transform: translateY(-2px); box-shadow: var(--shadow-glow);
    }

    .device-icon-wrapper {
      width: 48px; height: 48px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      color: rgb(var(--color-text-muted));
    }

    .device-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .device-name { font-size: 15px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .device-sessions { font-size: 12px; color: rgb(var(--color-text-muted)); }

    .device-stats { display: flex; gap: 20px; }
    .device-stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .stat-value-sm { font-size: 16px; font-weight: 700; color: rgb(var(--color-text-primary)); }
    .stat-label-sm { font-size: 11px; color: rgb(var(--color-text-muted)); }

    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .chart-section { padding: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .chart-container { height: 280px; position: relative; }
    .donut-container { display: flex; align-items: center; justify-content: center; }

    /* Insights */
    .insights-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .insight-box {
      display: flex; gap: 14px; align-items: flex-start;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      padding: 20px;
    }

    .insight-box strong {
      display: block;
      font-size: 14px;
      color: rgb(var(--color-text-primary));
      margin-bottom: 4px;
    }

    .insight-box p {
      font-size: 13px;
      color: rgb(var(--color-text-secondary));
      line-height: 1.5;
    }

    .insight-icon {
      display: inline-flex;
      flex-shrink: 0;
      color: rgb(var(--color-text-muted));
    }

    .insight-warning { border-left: 3px solid rgb(251, 191, 36); }
    .insight-success { border-left: 3px solid rgb(52, 211, 153); }

    @media (max-width: 1024px) {
      .device-cards { grid-template-columns: 1fr; }
      .charts-row { grid-template-columns: 1fr; }
      .insights-row { grid-template-columns: 1fr; }
    }
    @media (max-width: 768px) { .page-container { padding: 16px; } }
  `]
})
export class DevicesComponent implements AfterViewInit {
  @ViewChild('devicePie') devicePieRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('conversionBar') conversionBarRef!: ElementRef<HTMLCanvasElement>;

  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);

  /** Signal: zoneless — device cards repaint when API data arrives. */
  devices = signal<DeviceData[]>([]);
  loadError = signal('');
  private pieChart: Chart | null = null;
  private barChart: Chart | null = null;

  constructor() {
    toObservable(this.activeSite.site, { injector: this.injector })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(site => {
          if (!site) {
            this.loadError.set('');
            return of({ ok: true as const, rows: [] as DevicePointDto[] });
          }
          return this.api.devices(site.siteId, 30).pipe(
            map(rows => ({ ok: true as const, rows })),
            catchError(err => of({ ok: false as const, err, rows: [] as DevicePointDto[] })),
          );
        })
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        const rows = result.rows;
        const total = rows.reduce((s, d) => s + d.sessions, 0) || 1;
        const colors = ['#6366f1', '#a855f7', '#34d399', '#fbbf24', '#60a5fa'];
        this.devices.set(
          rows.map((d, i) => ({
            device: d.deviceType,
            percentage: Math.round((d.sessions / total) * 1000) / 10,
            sessions: d.sessions,
            conversionRate: 0,
            color: colors[i % colors.length],
          })),
        );
        queueMicrotask(() => this.syncCharts());
      });
  }

  deviceIconKey(deviceName: string): string {
    const n = deviceName.toLowerCase();
    if (n.includes('desktop') || n.includes('pc')) return 'desktop';
    if (n.includes('mobile') || n.includes('phone')) return 'mobile';
    return 'tablet';
  }

  ngAfterViewInit() {
    setTimeout(() => this.syncCharts(), 300);
  }

  private destroyCharts() {
    const p = this.devicePieRef?.nativeElement;
    const b = this.conversionBarRef?.nativeElement;
    if (p) Chart.getChart(p)?.destroy();
    if (b) Chart.getChart(b)?.destroy();
    this.pieChart = null;
    this.barChart = null;
  }

  private syncCharts() {
    const list = this.devices();
    if (!list.length) {
      this.destroyCharts();
      return;
    }
    if (!this.devicePieRef?.nativeElement || !this.conversionBarRef?.nativeElement) return;
    this.destroyCharts();
    this.createPieChart();
    this.createBarChart();
  }

  private createPieChart() {
    const ctx = this.devicePieRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const list = this.devices();

    this.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: list.map(d => d.device),
        datasets: [{
          data: list.map(d => d.sessions),
          backgroundColor: list.map(d => d.color + '44'),
          borderColor: list.map(d => d.color),
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 12 }, padding: 20, boxWidth: 12, boxHeight: 12, borderRadius: 3, useBorderRadius: true },
          },
          tooltip: {
            backgroundColor: 'rgb(22, 28, 44)',
            borderColor: 'rgb(38, 48, 72)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleColor: '#fff',
            bodyColor: 'rgb(148, 158, 188)',
            callbacks: {
              label: c => {
                const i = c.dataIndex;
                const d = this.devices()[i];
                return d ? ` ${d.sessions} sessions (${d.percentage}%)` : '';
              },
            },
          },
        },
      },
    });
  }

  private createBarChart() {
    const ctx = this.conversionBarRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const list = this.devices();

    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: list.map(d => d.device),
        datasets: [{
          label: 'Sessions',
          data: list.map(d => d.sessions),
          backgroundColor: list.map(d => d.color + '33'),
          borderColor: list.map(d => d.color),
          borderWidth: 1,
          borderRadius: 8,
          barThickness: 60,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgb(22, 28, 44)',
            borderColor: 'rgb(38, 48, 72)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            titleColor: '#fff',
            bodyColor: 'rgb(148, 158, 188)',
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 13, weight: 500 } }, border: { display: false } },
          y: {
            grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false },
            border: { display: false },
            ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 } },
          },
        },
      },
    });
  }
}

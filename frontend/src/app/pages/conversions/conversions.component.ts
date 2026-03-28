import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService, ConversionMetric, FunnelStep } from '../../services/mock-data.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-conversions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header animate-in">
        <h1 class="page-title">💰 Conversions</h1>
        <p class="page-subtitle">Track your conversion performance and funnel efficiency</p>
      </div>

      <!-- Conversion Metrics -->
      <div class="metrics-grid">
        @for (metric of conversionMetrics; track metric.label; let i = $index) {
          <div class="metric-card animate-in" [style.animation-delay]="(i * 80) + 'ms'">
            <div class="metric-header">
              <span class="metric-icon">{{ metric.icon }}</span>
              <span class="metric-badge" [class]="metric.change >= 0 ? 'badge-up' : 'badge-down'">
                {{ metric.change >= 0 ? '↑' : '↓' }} {{ formatChange(metric.change) }}%
              </span>
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
          @for (step of funnelData; track step.label; let i = $index; let last = $last) {
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
              @if (!last) {
                <div class="funnel-dropout">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgb(248, 113, 113)" stroke-width="1.5">
                    <path d="M7 3v8M4 8l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span class="dropout-text">{{ step.dropOff }}% drop-off</span>
                </div>
              }
            </div>
          }
        </div>
      </section>

      <!-- Conversion Rate Chart -->
      <section class="card chart-section animate-in" style="animation-delay: 500ms">
        <div class="chart-header">
          <div>
            <h3 class="chart-title">Conversion Trend</h3>
            <p class="chart-subtitle">Daily conversion rate over the last 30 days</p>
          </div>
        </div>
        <div class="chart-container">
          <canvas #conversionChart></canvas>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 28px; max-width: 1440px; margin: 0 auto; }
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
      opacity: 0;
    }
    .metric-card:hover {
      border-color: rgb(var(--color-border-light));
      box-shadow: var(--shadow-glow);
      transform: translateY(-2px);
    }

    .metric-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .metric-icon { font-size: 24px; }
    .metric-badge {
      padding: 3px 10px; border-radius: 9999px;
      font-size: 12px; font-weight: 600;
    }
    .badge-up { background: rgba(52, 211, 153, 0.12); color: rgb(52, 211, 153); }
    .badge-down { background: rgba(248, 113, 113, 0.12); color: rgb(248, 113, 113); }

    .metric-value { font-size: 32px; font-weight: 700; color: rgb(var(--color-text-primary)); line-height: 1.1; margin-bottom: 4px; }
    .metric-label { font-size: 13px; color: rgb(var(--color-text-muted)); font-weight: 500; }

    /* Funnel */
    .funnel-section { padding: 24px; margin-bottom: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .funnel-visual { display: flex; flex-direction: column; gap: 0; }

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

    /* Chart */
    .chart-section { padding: 24px; }
    .chart-container { height: 280px; position: relative; }

    @media (max-width: 1024px) { .metrics-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .metrics-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ConversionsComponent implements OnInit, AfterViewInit {
  @ViewChild('conversionChart') conversionChartRef!: ElementRef<HTMLCanvasElement>;

  conversionMetrics: ConversionMetric[] = [];
  funnelData: FunnelStep[] = [];

  constructor(private dataService: MockDataService) {}

  ngOnInit() {
    this.conversionMetrics = this.dataService.getConversionMetrics();
    this.funnelData = this.dataService.getFunnelData();
  }

  ngAfterViewInit() {
    setTimeout(() => this.createConversionChart(), 500);
  }

  formatChange(val: number): string { return Math.abs(val).toFixed(1); }

  private createConversionChart() {
    const ctx = this.conversionChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const days = 30;
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      data.push(parseFloat((2 + Math.random() * 6).toFixed(1)));
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, 'rgba(52, 211, 153, 0.15)');
    gradient.addColorStop(1, 'rgba(52, 211, 153, 0)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Conversion Rate %',
          data,
          borderColor: '#34d399',
          backgroundColor: gradient,
          borderWidth: 2, fill: true, tension: 0.4,
          pointRadius: 0, pointHoverRadius: 5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgb(22, 28, 44)', borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12, titleColor: '#fff', bodyColor: 'rgb(148, 158, 188)' },
        },
        scales: {
          x: { grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 }, maxRotation: 0 }, border: { display: false } },
          y: { grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 }, callback: (v) => v + '%' }, border: { display: false } },
        },
      },
    });
  }
}

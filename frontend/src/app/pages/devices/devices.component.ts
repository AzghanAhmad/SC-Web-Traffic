import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService, DeviceData } from '../../services/mock-data.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-devices',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header animate-in">
        <h1 class="page-title">📱 Device Insights</h1>
        <p class="page-subtitle">Understand how different devices impact user behavior</p>
      </div>

      <!-- Device cards -->
      <div class="device-cards">
        @for (device of devices; track device.device; let i = $index) {
          <div class="device-card animate-in" [style.animation-delay]="(i * 100) + 'ms'">
            <div class="device-icon-wrapper" [style.background]="device.color + '18'">
              <span class="device-emoji">{{ device.device === 'Desktop' ? '🖥️' : device.device === 'Mobile' ? '📱' : '📐' }}</span>
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
                <span class="stat-value-sm">{{ device.conversionRate }}%</span>
                <span class="stat-label-sm">Conv Rate</span>
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
              <h3 class="chart-title">Conversion Rate by Device</h3>
              <p class="chart-subtitle">Which devices convert best</p>
            </div>
          </div>
          <div class="chart-container">
            <canvas #conversionBar></canvas>
          </div>
        </section>
      </div>

      <!-- Insight cards -->
      <section class="insights-row animate-in" style="animation-delay: 400ms">
        <div class="insight-box insight-warning">
          <span class="insight-icon">⚠️</span>
          <div>
            <strong>Mobile gap detected</strong>
            <p>Mobile users convert 30% less than desktop. Consider optimizing mobile checkout flow.</p>
          </div>
        </div>
        <div class="insight-box insight-success">
          <span class="insight-icon">✅</span>
          <div>
            <strong>Desktop performing well</strong>
            <p>Desktop conversion rate of 5.8% is above industry average of 4.2%.</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .page-container { padding: 28px; max-width: 1440px; margin: 0 auto; }
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
      opacity: 0;
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
    }
    .device-emoji { font-size: 22px; }

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

    .insight-icon { font-size: 22px; flex-shrink: 0; }

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
export class DevicesComponent implements OnInit, AfterViewInit {
  @ViewChild('devicePie') devicePieRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('conversionBar') conversionBarRef!: ElementRef<HTMLCanvasElement>;

  devices: DeviceData[] = [];

  constructor(private dataService: MockDataService) {}

  ngOnInit() {
    this.devices = this.dataService.getDeviceData();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.createPieChart();
      this.createBarChart();
    }, 300);
  }

  private createPieChart() {
    const ctx = this.devicePieRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.devices.map(d => d.device),
        datasets: [{
          data: this.devices.map(d => d.percentage),
          backgroundColor: this.devices.map(d => d.color + '44'),
          borderColor: this.devices.map(d => d.color),
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
          tooltip: { backgroundColor: 'rgb(22, 28, 44)', borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12, titleColor: '#fff', bodyColor: 'rgb(148, 158, 188)', callbacks: { label: (ctx) => ` ${ctx.parsed}%` } },
        },
      },
    });
  }

  private createBarChart() {
    const ctx = this.conversionBarRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.devices.map(d => d.device),
        datasets: [{
          label: 'Conversion Rate %',
          data: this.devices.map(d => d.conversionRate),
          backgroundColor: this.devices.map(d => d.color + '33'),
          borderColor: this.devices.map(d => d.color),
          borderWidth: 1,
          borderRadius: 8,
          barThickness: 60,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: 'rgb(22, 28, 44)', borderColor: 'rgb(38, 48, 72)', borderWidth: 1, cornerRadius: 8, padding: 12, titleColor: '#fff', bodyColor: 'rgb(148, 158, 188)', callbacks: { label: (ctx) => ` ${ctx.parsed.y}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgb(148, 158, 188)', font: { family: 'Inter', size: 13, weight: 500 } }, border: { display: false } },
          y: {
            grid: { color: 'rgba(38, 48, 72, 0.5)', drawTicks: false }, border: { display: false },
            ticks: { color: 'rgb(98, 108, 138)', font: { family: 'Inter', size: 11 }, callback: (v) => v + '%' },
            max: 8,
          },
        },
      },
    });
  }
}

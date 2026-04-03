import {
  Component,
  ElementRef,
  Injector,
  ViewChild,
  afterNextRender,
  effect,
  inject,
  input,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { KpiData } from '../../models/analytics.types';
import { OutlineIconComponent } from '../outline-icon/outline-icon.component';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, OutlineIconComponent],
  template: `
    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-icon"><app-outline-icon [name]="data().icon" size="lg"></app-outline-icon></span>
        <span class="kpi-badge" [class]="data().change >= 0 ? 'badge-success' : 'badge-danger'">
          <span class="arrow">{{ data().change >= 0 ? '↑' : '↓' }}</span>
          {{ formatChange(data().change) }}%
        </span>
      </div>
      <div class="kpi-value">
        {{ data().prefix || '' }}{{ data().value | number }}{{ data().suffix || '' }}
      </div>
      <div class="kpi-label">{{ data().label }}</div>
      <div class="sparkline-container">
        <canvas #sparklineCanvas></canvas>
      </div>
    </div>
  `,
  styles: [`
    .kpi-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-lg);
      padding: 24px;
      transition: all var(--transition-base);
      opacity: 1;
      position: relative;
      overflow: hidden;
    }

    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgb(var(--color-accent)), transparent);
      opacity: 0;
      transition: opacity var(--transition-base);
    }

    .kpi-card:hover {
      border-color: rgb(var(--color-border-light));
      box-shadow: var(--shadow-glow);
      transform: translateY(-2px);
    }

    .kpi-card:hover::before {
      opacity: 1;
    }

    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .kpi-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: rgb(var(--color-text-muted));
    }

    .kpi-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.025em;
    }

    .badge-success {
      background: rgba(52, 211, 153, 0.12);
      color: rgb(52, 211, 153);
    }

    .badge-danger {
      background: rgba(248, 113, 113, 0.12);
      color: rgb(248, 113, 113);
    }

    .arrow {
      font-size: 11px;
    }

    .kpi-value {
      font-size: 36px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      line-height: 1.1;
      margin-bottom: 6px;
      letter-spacing: -0.02em;
    }

    .kpi-label {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      font-weight: 500;
      margin-bottom: 16px;
    }

    .sparkline-container {
      height: 40px;
      width: 100%;
    }

    .sparkline-container canvas {
      width: 100%;
      height: 100%;
    }
  `],
})
export class KpiCardComponent {
  /** Signal input: zoneless-safe and updates when @for reuses the same row (track by label). */
  data = input.required<KpiData>();

  @ViewChild('sparklineCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private rafId: number | null = null;
  private readonly injector = inject(Injector);

  constructor() {
    afterNextRender(() => {
      runInInjectionContext(this.injector, () => {
        effect(() => {
          const d = this.data();
          void d.sparkline;
          void d.change;
          untracked(() => {
            if (this.rafId != null) cancelAnimationFrame(this.rafId);
            this.rafId = requestAnimationFrame(() => {
              this.rafId = null;
              this.drawSparkline();
            });
          });
        });
      });
    });
  }

  formatChange(val: number): string {
    return Math.abs(val).toFixed(1);
  }

  private drawSparkline() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const series = this.data().sparkline;
    if (!series.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const xDenom = Math.max(series.length - 1, 1);

    const points: { x: number; y: number }[] = series.map((val, i) => ({
      x: (i / xDenom) * w,
      y: h - ((val - min) / range) * (h - 4) - 2,
    }));

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const isPositive = this.data().change >= 0;
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(52, 211, 153, 0.2)');
      gradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(248, 113, 113, 0.2)');
      gradient.addColorStop(1, 'rgba(248, 113, 113, 0)');
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const xc = (points[i].x + points[i - 1].x) / 2;
      const yc = (points[i].y + points[i - 1].y) / 2;
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)';
    ctx.fill();
  }
}

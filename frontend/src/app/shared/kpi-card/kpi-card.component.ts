import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpiData } from '../../services/mock-data.service';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-card">
      <div class="kpi-header">
        <span class="kpi-icon">{{ data.icon }}</span>
        <span class="kpi-badge" [class]="data.change >= 0 ? 'badge-success' : 'badge-danger'">
          <span class="arrow">{{ data.change >= 0 ? '↑' : '↓' }}</span>
          {{ formatChange(data.change) }}%
        </span>
      </div>
      <div class="kpi-value">
        {{ data.prefix || '' }}{{ animatedValue | number }}{{ data.suffix || '' }}
      </div>
      <div class="kpi-label">{{ data.label }}</div>
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
      font-size: 24px;
      line-height: 1;
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
  `]
})
export class KpiCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() data!: KpiData;
  @Input() index: number = 0;
  @ViewChild('sparklineCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  animatedValue = 0;
  visible = false;
  private animationFrame: number | null = null;

  ngOnInit() {
    // Render KPI values immediately on navigation so cards are visible in one go.
    this.visible = true;
    this.animatedValue = this.data.value;
  }

  ngAfterViewInit() {
    setTimeout(() => this.drawSparkline(), this.index * 100 + 300);
  }

  ngOnDestroy() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
  }

  formatChange(val: number): string {
    return Math.abs(val).toFixed(1);
  }

  private animateCounter() {
    const target = this.data.value;
    const duration = 1200;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.animatedValue = Math.round(target * eased * 10) / 10;
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(step);
      } else {
        this.animatedValue = target;
      }
    };
    this.animationFrame = requestAnimationFrame(step);
  }

  private drawSparkline() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const data = this.data.sparkline;
    const w = rect.width;
    const h = rect.height;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points: { x: number; y: number }[] = data.map((val, i) => ({
      x: (i / (data.length - 1)) * w,
      y: h - ((val - min) / range) * (h - 4) - 2,
    }));

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const isPositive = this.data.change >= 0;
    if (isPositive) {
      gradient.addColorStop(0, 'rgba(52, 211, 153, 0.2)');
      gradient.addColorStop(1, 'rgba(52, 211, 153, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(248, 113, 113, 0.2)');
      gradient.addColorStop(1, 'rgba(248, 113, 113, 0)');
    }

    // Draw fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
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

    // Draw end dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = isPositive ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)';
    ctx.fill();
  }
}

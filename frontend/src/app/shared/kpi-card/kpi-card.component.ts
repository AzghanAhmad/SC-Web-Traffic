import { Component, input } from '@angular/core';
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
      </div>
      <div class="kpi-value">
        {{ data().prefix || '' }}{{ data().value | number }}{{ data().suffix || '' }}
      </div>
      <div class="kpi-label">{{ data().label }}</div>
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
      justify-content: flex-start;
      align-items: center;
      margin-bottom: 16px;
    }

    .kpi-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: rgb(var(--color-text-muted));
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
      margin-bottom: 0;
    }
  `],
})
export class KpiCardComponent {
  /** Signal input: zoneless-safe when parent uses signals. */
  data = input.required<KpiData>();
}

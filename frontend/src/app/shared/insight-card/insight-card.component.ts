import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Insight } from '../../services/mock-data.service';

@Component({
  selector: 'app-insight-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="insight-card" [class]="'insight-card--' + insight.type">
      <span class="insight-icon">{{ insight.icon }}</span>
      <div class="insight-content">
        <span class="insight-text">{{ insight.text }} </span>
        <span class="insight-highlight">{{ insight.highlight }}</span>
      </div>
      <div class="insight-indicator"></div>
    </div>
  `,
  styles: [`
    .insight-card {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      padding: 18px 20px;
      transition: all var(--transition-base);
      position: relative;
      overflow: hidden;
      cursor: default;
    }

    .insight-card:hover {
      border-color: rgb(var(--color-border-light));
      transform: translateX(4px);
      box-shadow: var(--shadow-md);
    }

    .insight-indicator {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      border-radius: 0 3px 3px 0;
      transition: opacity var(--transition-base);
    }

    .insight-card--success .insight-indicator { background: rgb(52, 211, 153); }
    .insight-card--warning .insight-indicator { background: rgb(251, 191, 36); }
    .insight-card--danger .insight-indicator { background: rgb(248, 113, 113); }
    .insight-card--info .insight-indicator { background: rgb(96, 165, 250); }

    .insight-icon {
      font-size: 22px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .insight-content {
      flex: 1;
      font-size: 14px;
      line-height: 1.5;
    }

    .insight-text {
      color: rgb(var(--color-text-secondary));
    }

    .insight-highlight {
      font-weight: 600;
      color: rgb(var(--color-text-primary));
    }

    .insight-card--success .insight-highlight { color: rgb(52, 211, 153); }
    .insight-card--warning .insight-highlight { color: rgb(251, 191, 36); }
    .insight-card--danger .insight-highlight { color: rgb(248, 113, 113); }
    .insight-card--info .insight-highlight { color: rgb(96, 165, 250); }
  `]
})
export class InsightCardComponent {
  @Input() insight!: Insight;
}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Stroke-only icons (currentColor), aligned with sidebar style */
@Component({
  selector: 'app-outline-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (name) {
    <span
      class="wrap"
      [class.wrap--sm]="size === 'sm'"
      [class.wrap--md]="size === 'md'"
      [class.wrap--lg]="size === 'lg'"
      [attr.aria-hidden]="decorative ? 'true' : null">
      <ng-container [ngSwitch]="name">
        <svg *ngSwitchCase="'users'" viewBox="0 0 24 24">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <svg *ngSwitchCase="'bar-chart'" viewBox="0 0 24 24">
          <path d="M3 3v18h18"></path>
          <path d="M7 16V8"></path>
          <path d="M12 16v-5"></path>
          <path d="M17 16v-3"></path>
        </svg>
        <svg *ngSwitchCase="'activity'" viewBox="0 0 24 24">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
        </svg>
        <svg *ngSwitchCase="'target'" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
        <svg *ngSwitchCase="'trend-up'" viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
        <svg *ngSwitchCase="'trend-down'" viewBox="0 0 24 24">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
          <polyline points="17 18 23 18 23 12"></polyline>
        </svg>
        <svg *ngSwitchCase="'alert'" viewBox="0 0 24 24">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <path d="M12 9v4"></path>
          <path d="M12 17h.01"></path>
        </svg>
        <svg *ngSwitchCase="'mobile'" viewBox="0 0 24 24">
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect>
          <path d="M12 18h.01"></path>
        </svg>
        <svg *ngSwitchCase="'rocket'" viewBox="0 0 24 24">
          <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
          <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
        </svg>
        <svg *ngSwitchCase="'globe'" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
        <svg *ngSwitchCase="'spike'" viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
        <svg *ngSwitchCase="'drop'" viewBox="0 0 24 24">
          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
          <polyline points="17 18 23 18 23 12"></polyline>
        </svg>
        <svg *ngSwitchCase="'milestone'" viewBox="0 0 24 24">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
        </svg>
        <svg *ngSwitchCase="'mail'" viewBox="0 0 24 24">
          <rect width="20" height="16" x="2" y="4" rx="2"></rect>
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
        </svg>
        <svg *ngSwitchCase="'cart'" viewBox="0 0 24 24">
          <circle cx="8" cy="21" r="1"></circle>
          <circle cx="19" cy="21" r="1"></circle>
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
        </svg>
        <svg *ngSwitchCase="'receipt'" viewBox="0 0 24 24">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1Z"></path>
          <path d="M16 8h-6"></path>
          <path d="M16 12h-6"></path>
          <path d="M10 16h6"></path>
        </svg>
        <svg *ngSwitchCase="'play'" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="10 8 16 12 10 16 10 8"></polygon>
        </svg>
        <svg *ngSwitchCase="'desktop'" viewBox="0 0 24 24">
          <rect width="20" height="14" x="2" y="3" rx="2"></rect>
          <path d="M8 21h8"></path>
          <path d="M12 17v4"></path>
        </svg>
        <svg *ngSwitchCase="'tablet'" viewBox="0 0 24 24">
          <rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
        <svg *ngSwitchCase="'link'" viewBox="0 0 24 24">
          <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"></path>
          <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"></path>
        </svg>
        <svg *ngSwitchCase="'check-circle'" viewBox="0 0 24 24">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
        <svg *ngSwitchCase="'x'" viewBox="0 0 24 24">
          <path d="M18 6 6 18"></path>
          <path d="m6 6 12 12"></path>
        </svg>
        <ng-container *ngSwitchDefault></ng-container>
      </ng-container>
    </span>
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      color: inherit;
    }
    .wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
    }
    .wrap--sm { width: 16px; height: 16px; }
    .wrap--md { width: 20px; height: 20px; }
    .wrap--lg { width: 24px; height: 24px; }
    svg {
      width: 100%;
      height: 100%;
      flex-shrink: 0;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `],
})
export class OutlineIconComponent {
  @Input() name = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() decorative = true;
}

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton-group">
      <div class="skeleton skeleton-line skeleton-line--title"></div>
      <div class="skeleton skeleton-line skeleton-line--text"></div>
      <div class="skeleton skeleton-line skeleton-line--short"></div>
      <div class="skeleton skeleton-chart"></div>
    </div>
  `,
  styles: [`
    .skeleton-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        rgb(var(--color-surface-elevated)) 25%,
        rgb(var(--color-surface-hover)) 37%,
        rgb(var(--color-surface-elevated)) 63%
      );
      background-size: 200% 100%;
      animation: skeleton-loading 1.5s ease-in-out infinite;
      border-radius: 8px;
    }

    .skeleton-line {
      height: 14px;
    }

    .skeleton-line--title {
      width: 45%;
      height: 20px;
    }

    .skeleton-line--text {
      width: 80%;
    }

    .skeleton-line--short {
      width: 60%;
    }

    .skeleton-chart {
      height: 200px;
      width: 100%;
      margin-top: 8px;
      border-radius: 12px;
    }

    @keyframes skeleton-loading {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class SkeletonLoaderComponent {}

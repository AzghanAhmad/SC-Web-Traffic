import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface FunnelBuilderStep {
  id: number;
  page: string;
  visitors: number;
  conversion: number;
  dropOff: number;
}

@Component({
  selector: 'app-funnels',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header animate-in">
        <h1 class="page-title">🔁 Funnel Analysis</h1>
        <p class="page-subtitle">Build custom funnels and analyze user journeys</p>
      </div>

      <!-- Funnel Builder -->
      <section class="card builder-section animate-in" style="animation-delay: 100ms">
        <div class="builder-header">
          <div>
            <h3 class="chart-title">Funnel Builder</h3>
            <p class="chart-subtitle">Select pages to define your funnel steps</p>
          </div>
          <div class="builder-actions">
            <button class="btn btn-outline" (click)="resetFunnel()">Reset</button>
            <button class="btn btn-primary" (click)="analyzeFunnel()">Analyze</button>
          </div>
        </div>

        <!-- Step selector -->
        <div class="steps-builder">
          @for (step of selectedSteps(); track step.id; let i = $index; let last = $last) {
            <div class="step-item">
              <div class="step-number">{{ i + 1 }}</div>
              <select class="step-select" [value]="step.page" (change)="updateStep(i, $event)">
                @for (page of availablePages; track page) {
                  <option [value]="page">{{ page }}</option>
                }
              </select>
              <button class="step-remove" *ngIf="selectedSteps().length > 2" (click)="removeStep(i)">✕</button>
            </div>
            @if (!last) {
              <div class="step-connector">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="rgb(var(--color-border-light))" stroke-width="1.5">
                  <path d="M8 0v24M4 18l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            }
          }
          <button class="add-step-btn" *ngIf="selectedSteps().length < 6" (click)="addStep()">
            <span>+</span> Add Step
          </button>
        </div>
      </section>

      <!-- Analysis Results -->
      @if (analyzed()) {
        <section class="card results-section animate-in" style="animation-delay: 200ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Funnel Results</h3>
              <p class="chart-subtitle">Step-by-step conversion analysis</p>
            </div>
            <div class="overall-rate">
              <span class="rate-label">Overall Conversion</span>
              <span class="rate-value">{{ overallConversion() }}%</span>
            </div>
          </div>

          <div class="results-flow">
            @for (step of funnelResults(); track step.id; let i = $index; let first = $first; let last = $last) {
              <div class="result-step">
                <div class="result-bar-track">
                  <div class="result-bar" [style.width.%]="step.conversion" [style.animation-delay]="(i * 120) + 'ms'">
                    <div class="result-bar-inner"></div>
                  </div>
                </div>
                <div class="result-info">
                  <div class="result-left">
                    <span class="result-step-num">Step {{ i + 1 }}</span>
                    <span class="result-page">{{ step.page }}</span>
                  </div>
                  <div class="result-right">
                    <span class="result-visitors">{{ step.visitors | number }} visitors</span>
                    <span class="result-conv">{{ step.conversion }}%</span>
                  </div>
                </div>
                @if (!last) {
                  <div class="result-dropout">
                    <span class="dropout-arrow">↓</span>
                    <span class="dropout-percentage">{{ step.dropOff }}% dropped off</span>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .page-container { padding: 28px; max-width: 1440px; margin: 0 auto; }
    .page-header { margin-bottom: 28px; }
    .page-title { font-size: 24px; font-weight: 700; color: rgb(var(--color-text-primary)); letter-spacing: -0.02em; }
    .page-subtitle { font-size: 14px; color: rgb(var(--color-text-muted)); margin-top: 4px; }

    .builder-section { padding: 24px; margin-bottom: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .builder-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .builder-actions { display: flex; gap: 10px; }

    .steps-builder { display: flex; flex-direction: column; align-items: center; gap: 0; }

    .step-item {
      display: flex; align-items: center; gap: 12px;
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      padding: 14px 18px; width: 100%; max-width: 500px;
      transition: all var(--transition-fast);
    }
    .step-item:hover { border-color: rgb(var(--color-border-light)); }

    .step-number {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      color: rgb(99, 102, 241);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }

    .step-select {
      flex: 1;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 8px;
      padding: 8px 12px;
      color: rgb(var(--color-text-primary));
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      outline: none;
      cursor: pointer;
    }
    .step-select option { background: rgb(var(--color-surface)); }

    .step-remove {
      background: none; border: none;
      color: rgb(var(--color-text-muted));
      cursor: pointer; font-size: 16px;
      padding: 4px 8px; border-radius: 6px;
      transition: all var(--transition-fast);
    }
    .step-remove:hover { background: rgba(248, 113, 113, 0.15); color: rgb(248, 113, 113); }

    .step-connector { padding: 4px 0; }

    .add-step-btn {
      display: flex; align-items: center; gap: 8px;
      margin-top: 12px; padding: 10px 20px;
      border-radius: var(--radius-md);
      background: transparent;
      border: 2px dashed rgb(var(--color-border));
      color: rgb(var(--color-text-muted));
      font-size: 14px; font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-fast);
      width: 100%; max-width: 500px;
      justify-content: center;
    }
    .add-step-btn:hover {
      border-color: rgb(var(--color-accent));
      color: rgb(var(--color-accent));
      background: rgba(99, 102, 241, 0.05);
    }
    .add-step-btn span { font-size: 18px; }

    /* Results */
    .results-section { padding: 24px; }

    .overall-rate {
      display: flex; flex-direction: column;
      align-items: flex-end; gap: 2px;
    }
    .rate-label { font-size: 12px; color: rgb(var(--color-text-muted)); }
    .rate-value { font-size: 28px; font-weight: 700; color: rgb(52, 211, 153); }

    .results-flow { display: flex; flex-direction: column; gap: 0; }

    .result-step { margin-bottom: 4px; }

    .result-bar-track {
      background: rgb(var(--color-surface-elevated));
      border-radius: 8px; height: 40px;
      overflow: hidden;
    }

    .result-bar {
      height: 100%;
      background: linear-gradient(90deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25));
      border-radius: 8px;
      animation: growWidth 0.8s ease-out forwards;
    }

    @keyframes growWidth { from { max-width: 0; } to { max-width: 100%; } }

    .result-bar-inner {
      height: 100%; width: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05));
    }

    .result-info {
      display: flex; justify-content: space-between;
      align-items: center; padding: 8px 4px;
    }

    .result-left { display: flex; align-items: center; gap: 10px; }
    .result-step-num { font-size: 11px; color: rgb(var(--color-text-muted)); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .result-page { font-size: 14px; color: rgb(var(--color-text-primary)); font-weight: 500; }

    .result-right { display: flex; align-items: center; gap: 16px; }
    .result-visitors { font-size: 13px; color: rgb(var(--color-text-secondary)); }
    .result-conv { font-size: 14px; font-weight: 700; color: rgb(99, 102, 241); }

    .result-dropout {
      display: flex; align-items: center; gap: 6px;
      padding: 2px 4px 6px;
    }
    .dropout-arrow { color: rgb(248, 113, 113); font-size: 12px; }
    .dropout-percentage { font-size: 11px; color: rgb(248, 113, 113); font-weight: 500; }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 18px; border-radius: 8px;
      font-size: 14px; font-weight: 500;
      cursor: pointer; transition: all var(--transition-fast);
      border: none; outline: none; font-family: 'Inter', sans-serif;
    }
    .btn-primary { background: rgb(var(--color-accent)); color: white; }
    .btn-primary:hover { box-shadow: 0 0 16px rgba(99, 102, 241, 0.3); }
    .btn-outline {
      background: transparent; color: rgb(var(--color-text-secondary));
      border: 1px solid rgb(var(--color-border));
    }
    .btn-outline:hover { border-color: rgb(var(--color-border-light)); background: rgb(var(--color-surface-hover)); }

    @media (max-width: 768px) { .page-container { padding: 16px; } }
  `]
})
export class FunnelsComponent {
  availablePages = ['/home', '/books', '/pricing', '/product', '/cart', '/checkout', '/thank-you', '/blog', '/about'];

  selectedSteps = signal<FunnelBuilderStep[]>([
    { id: 1, page: '/home', visitors: 0, conversion: 0, dropOff: 0 },
    { id: 2, page: '/books', visitors: 0, conversion: 0, dropOff: 0 },
    { id: 3, page: '/pricing', visitors: 0, conversion: 0, dropOff: 0 },
    { id: 4, page: '/checkout', visitors: 0, conversion: 0, dropOff: 0 },
  ]);

  analyzed = signal(false);
  funnelResults = signal<FunnelBuilderStep[]>([]);
  overallConversion = signal('0');

  addStep() {
    const steps = [...this.selectedSteps()];
    const usedPages = new Set(steps.map(s => s.page));
    const nextPage = this.availablePages.find(p => !usedPages.has(p)) || '/home';
    steps.push({ id: Date.now(), page: nextPage, visitors: 0, conversion: 0, dropOff: 0 });
    this.selectedSteps.set(steps);
    this.analyzed.set(false);
  }

  removeStep(index: number) {
    const steps = [...this.selectedSteps()];
    steps.splice(index, 1);
    this.selectedSteps.set(steps);
    this.analyzed.set(false);
  }

  updateStep(index: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    const steps = [...this.selectedSteps()];
    steps[index] = { ...steps[index], page: target.value };
    this.selectedSteps.set(steps);
    this.analyzed.set(false);
  }

  resetFunnel() {
    this.selectedSteps.set([
      { id: 1, page: '/home', visitors: 0, conversion: 0, dropOff: 0 },
      { id: 2, page: '/books', visitors: 0, conversion: 0, dropOff: 0 },
      { id: 3, page: '/pricing', visitors: 0, conversion: 0, dropOff: 0 },
    ]);
    this.analyzed.set(false);
  }

  analyzeFunnel() {
    const steps = this.selectedSteps();
    let visitors = 10000 + Math.floor(Math.random() * 5000);
    const results: FunnelBuilderStep[] = [];

    steps.forEach((step, i) => {
      const conv = i === 0 ? 100 : Math.round((visitors / results[0].visitors) * 100);
      const dropOff = i === 0 ? 0 : Math.round((1 - visitors / results[i - 1].visitors) * 100);
      results.push({ ...step, visitors, conversion: conv, dropOff });
      visitors = Math.round(visitors * (0.35 + Math.random() * 0.35));
    });

    this.funnelResults.set(results);
    this.overallConversion.set(
      ((results[results.length - 1].visitors / results[0].visitors) * 100).toFixed(1)
    );
    this.analyzed.set(true);
  }
}

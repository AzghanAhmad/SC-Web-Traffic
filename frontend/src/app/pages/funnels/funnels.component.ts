import { Component, DestroyRef, Injector, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { OutlineIconComponent } from '../../shared/outline-icon/outline-icon.component';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { httpErrorMessage, timeRangeToDays } from '../../utils/analytics.helpers';
import { funnelDtoToDisplaySteps } from '../../utils/funnel.helpers';
import type { FunnelStepDto, PagePointDto } from '../../models/analytics.types';

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
  imports: [CommonModule, OutlineIconComponent],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Funnel Analysis</h1>
        <p class="page-subtitle">Build custom funnels and analyze user journeys</p>
      </div>

      <section class="card builder-section animate-in" style="animation-delay: 100ms">
        <div class="builder-header">
          <div>
            <h3 class="chart-title">Funnel Builder</h3>
            <p class="chart-subtitle">Select pages to define your funnel steps</p>
          </div>
          <div class="builder-actions">
            <button class="btn btn-outline" type="button" (click)="resetFunnel()">Reset</button>
            <button class="btn btn-primary" type="button" (click)="analyzeFunnel()">Analyze</button>
          </div>
        </div>

        <div class="steps-builder">
          @for (step of selectedSteps(); track step.id; let i = $index; let last = $last) {
            <div class="step-item">
              <div class="step-number">{{ i + 1 }}</div>
              <select class="step-select" [value]="step.page" (change)="updateStep(i, $event)">
                @for (page of availablePages(); track page) {
                  <option [value]="page">{{ page }}</option>
                }
              </select>
              <button class="step-remove" type="button" *ngIf="selectedSteps().length > 1" (click)="removeStep(i)" aria-label="Remove step">
                <app-outline-icon name="x" size="sm"></app-outline-icon>
              </button>
            </div>
            @if (!last) {
              <div class="step-connector">
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="rgb(var(--color-border-light))" stroke-width="1.5">
                  <path d="M8 0v24M4 18l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            }
          }
          <button class="add-step-btn" type="button" *ngIf="selectedSteps().length < 6" (click)="addStep()">
            <span>+</span> Add Step
          </button>
        </div>
      </section>

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
            @for (step of funnelResults(); track step.id; let i = $index; let last = $last) {
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
      display: inline-flex;
      align-items: center; justify-content: center;
      background: none; border: none;
      color: rgb(var(--color-text-muted));
      cursor: pointer;
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
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);

  availablePages = signal<string[]>(['/']);
  selectedSteps = signal<FunnelBuilderStep[]>([
    { id: 1, page: '/', visitors: 0, conversion: 0, dropOff: 0 },
    { id: 2, page: '/', visitors: 0, conversion: 0, dropOff: 0 },
  ]);

  analyzed = signal(false);
  funnelResults = signal<FunnelBuilderStep[]>([]);
  overallConversion = signal('0');
  loadError = signal('');
  private siteId: string | null = null;

  constructor() {
    toObservable(this.activeSite.site, { injector: this.injector })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(site => {
          this.siteId = site?.siteId ?? null;
          this.analyzed.set(false);
          if (!site) {
            this.loadError.set('');
            this.availablePages.set(['/']);
            return of({ ok: true as const, rows: [] as PagePointDto[] });
          }
          return this.api.pages(site.siteId, 30).pipe(
            map(rows => ({ ok: true as const, rows })),
            catchError(err => of({ ok: false as const, err, rows: [] as PagePointDto[] })),
          );
        })
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        const pages = result.rows;
        const urls = pages.map(p => p.pageUrl).filter(Boolean);
        const list = urls.length ? urls : ['/'];
        this.availablePages.set(list);
        const first = list[0];
        if (list.length === 1) {
          this.selectedSteps.set([{ id: 1, page: first, visitors: 0, conversion: 0, dropOff: 0 }]);
        } else {
          const second = list[1];
          this.selectedSteps.set([
            { id: 1, page: first, visitors: 0, conversion: 0, dropOff: 0 },
            { id: 2, page: second, visitors: 0, conversion: 0, dropOff: 0 },
          ]);
        }
      });
  }

  addStep() {
    const steps = [...this.selectedSteps()];
    const pages = this.availablePages();
    const used = new Set(steps.map(s => s.page));
    const nextPage = pages.find(p => !used.has(p)) ?? pages[0];
    steps.push({ id: Date.now(), page: nextPage, visitors: 0, conversion: 0, dropOff: 0 });
    this.selectedSteps.set(steps);
    this.analyzed.set(false);
  }

  removeStep(index: number) {
    const steps = [...this.selectedSteps()];
    if (steps.length <= 1) return;
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
    const pages = this.availablePages();
    const a = pages[0] ?? '/';
    if (pages.length <= 1) {
      this.selectedSteps.set([{ id: 1, page: a, visitors: 0, conversion: 0, dropOff: 0 }]);
    } else {
      const b = pages[1];
      this.selectedSteps.set([
        { id: 1, page: a, visitors: 0, conversion: 0, dropOff: 0 },
        { id: 2, page: b, visitors: 0, conversion: 0, dropOff: 0 },
      ]);
    }
    this.analyzed.set(false);
  }

  analyzeFunnel() {
    const siteId = this.siteId;
    if (!siteId) {
      this.loadError.set('Select a site from the header first.');
      return;
    }
    const steps = this.selectedSteps().map(s => s.page);
    const days = timeRangeToDays('30d');
    this.api
      .funnels(siteId, steps, days)
      .pipe(
        map(funnel => ({ ok: true as const, funnel })),
        catchError(err => of({ ok: false as const, err, funnel: [] as FunnelStepDto[] })),
      )
      .subscribe(result => {
        if (!result.ok) {
          this.loadError.set(httpErrorMessage(result.err));
          return;
        }
        this.loadError.set('');
        const funnel = result.funnel;
        const display = funnelDtoToDisplaySteps(funnel);
        const results: FunnelBuilderStep[] = display.map((d, idx) => ({
          id: idx + 1,
          page: d.label,
          visitors: d.visitors,
          conversion: d.percentage,
          dropOff: d.dropOff,
        }));
        this.funnelResults.set(results);
        const first = funnel[0]?.entered ?? 0;
        const last = funnel[funnel.length - 1]?.completed ?? 0;
        const overall = first === 0 ? 0 : (last / first) * 100;
        this.overallConversion.set(overall.toFixed(1));
        this.analyzed.set(true);
      });
  }
}

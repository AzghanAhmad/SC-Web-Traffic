import { Component, DestroyRef, Injector, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil } from 'rxjs/operators';
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
  imports: [CommonModule, FormsModule, OutlineIconComponent],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header">
        <h1 class="page-title">Funnel Analysis</h1>
        <p class="page-subtitle">Build custom funnels and understand where visitors stop before the goal.</p>
      </div>

      <div class="help-card">
        <div class="help-card-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="help-card-body">
          <h2 class="help-card-title">What is a funnel?</h2>
          <p class="help-card-text">
            A funnel tracks the path visitors take from one page to the next toward a goal like signup or checkout.
            Use it to see exactly where people drop off and which pages need improvement.
          </p>
        </div>
      </div>

      <section class="card builder-section">
        <div class="builder-header">
          <div>
            <h3 class="chart-title">Funnel Builder</h3>
            <p class="chart-subtitle">Select pages to define your funnel steps</p>
          </div>
          <div class="builder-actions">
            <button class="btn btn-outline" type="button" (click)="resetFunnel()">Reset</button>
            <button class="btn btn-primary" type="button" [disabled]="analyzing() || !selectedSteps().length" (click)="analyzeFunnel()">
              {{ analyzing() ? 'Analyzing…' : 'Analyze' }}
            </button>
          </div>
        </div>

        @if (!availablePages().length) {
          <p class="builder-empty">No pages tracked yet. After the tracker collects page views, they will appear here as funnel steps.</p>
        } @else {
          <div class="steps-builder">
            @for (step of selectedSteps(); track step.id; let i = $index; let last = $last) {
              <div class="step-item">
                <div class="step-number">{{ i + 1 }}</div>
                <div class="step-select-wrap">
                  <label class="sr-only" [attr.for]="'funnel-step-' + i">Funnel step {{ i + 1 }}</label>
                  <select
                    class="step-select"
                    [id]="'funnel-step-' + i"
                    [name]="'funnel-step-' + i"
                    [ngModel]="step.page"
                    (ngModelChange)="onStepPageChange(i, $event)"
                  >
                    @for (page of availablePages(); track page) {
                      <option [ngValue]="page">{{ shortLabel(page) }}</option>
                    }
                  </select>
                </div>
                @if (selectedSteps().length > 1) {
                  <button class="step-remove" type="button" (click)="removeStep(i)" aria-label="Remove step">
                    <app-outline-icon name="x" size="sm"></app-outline-icon>
                  </button>
                }
              </div>
              @if (!last) {
                <div class="step-connector" aria-hidden="true">
                  <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="#94a3b8" stroke-width="1.5">
                    <path d="M8 0v24M4 18l4 4 4-4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
              }
            }
            @if (selectedSteps().length < 6) {
              <button class="add-step-btn" type="button" (click)="addStep()">
                <span>+</span> Add Step
              </button>
            }
          </div>
        }
      </section>

      @if (analyzed() && funnelResults().length === 0) {
        <div class="empty-state-card">
          <h3>No funnel data yet</h3>
          <p>Install the tracker snippet, visit the selected pages in order, then run Analyze again after a few visitors arrive.</p>
        </div>
      }

      @if (analyzed() && funnelResults().length > 0) {
        <section class="card results-section">
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
            @for (step of funnelResults(); track step.id; let i = $index) {
              <div class="result-step">
                <div class="result-bar-track">
                  <div class="result-bar" [style.width.%]="step.conversion" [style.animation-delay]="(i * 120) + 'ms'">
                    <div class="result-bar-inner"></div>
                  </div>
                </div>
                <div class="result-info">
                  <div class="result-left">
                    <span class="result-step-num">Step {{ i + 1 }}</span>
                    <span class="result-page" [title]="step.page">{{ shortLabel(step.page) }}</span>
                  </div>
                  <div class="result-right">
                    <span class="result-visitors">{{ step.visitors | number }} visitors</span>
                    <span class="result-conv">{{ step.conversion }}%</span>
                  </div>
                </div>
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
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 16px;
      border: 1px solid #fecaca;
      background: #fef2f2;
      color: #dc2626;
    }
    .page-header { margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; margin: 0; }
    .page-subtitle { font-size: 14px; color: #64748b; margin-top: 6px; }

    .help-card {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      padding: 20px 22px;
      margin-bottom: 20px;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .help-card-icon {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #3b82f6;
    }
    .help-card-body { min-width: 0; flex: 1; }
    .help-card-title {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }
    .help-card-text {
      margin: 0;
      font-size: 14px;
      line-height: 1.65;
      color: #475569;
      max-width: 72ch;
    }

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .builder-section { padding: 24px; margin-bottom: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; }
    .chart-title { font-size: 16px; font-weight: 600; color: #0f172a; margin: 0; }
    .chart-subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }

    .builder-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      gap: 16px;
      flex-wrap: wrap;
    }
    .builder-actions { display: flex; gap: 10px; flex-shrink: 0; }
    .builder-empty {
      margin: 0;
      padding: 16px;
      border-radius: 12px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      color: #64748b;
      font-size: 13px;
      line-height: 1.6;
    }

    .steps-builder {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      max-width: 640px;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      width: 100%;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .step-item:hover {
      border-color: #bfdbfe;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
    }

    .step-number {
      width: 30px; height: 30px; border-radius: 50%;
      background: #eff6ff;
      color: #2563eb;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }

    .step-select-wrap { flex: 1; min-width: 0; }

    .step-select {
      width: 100%;
      appearance: none;
      -webkit-appearance: none;
      background-color: #ffffff;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 40px 10px 12px;
      color: #0f172a;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      cursor: pointer;
      line-height: 1.4;
      text-overflow: ellipsis;
    }
    .step-select:focus {
      border-color: #60a5fa;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    .step-select option { background: #ffffff; color: #0f172a; }

    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0);
      white-space: nowrap; border: 0;
    }

    .step-remove {
      display: inline-flex;
      align-items: center; justify-content: center;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #64748b;
      cursor: pointer;
      width: 34px; height: 34px;
      border-radius: 8px;
      flex-shrink: 0;
      transition: all 0.15s ease;
    }
    .step-remove:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }

    .step-connector { display: flex; justify-content: center; padding: 6px 0; }

    .add-step-btn {
      display: flex; align-items: center; gap: 8px;
      margin-top: 14px; padding: 12px 20px;
      border-radius: 12px;
      background: #ffffff;
      border: 1.5px dashed #cbd5e1;
      color: #64748b;
      font-size: 14px; font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      width: 100%;
      justify-content: center;
      font-family: inherit;
    }
    .add-step-btn:hover {
      border-color: #60a5fa;
      color: #2563eb;
      background: #eff6ff;
    }
    .add-step-btn span { font-size: 18px; line-height: 1; }

    .results-section { padding: 24px; }

    .empty-state-card {
      padding: 22px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      margin-bottom: 24px;
    }
    .empty-state-card h3 { margin: 0 0 8px; font-size: 16px; color: #0f172a; }
    .empty-state-card p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.7; }

    .overall-rate { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .rate-label { font-size: 12px; color: #64748b; }
    .rate-value { font-size: 28px; font-weight: 700; color: #059669; }

    .results-flow { display: flex; flex-direction: column; gap: 0; }
    .result-step { margin-bottom: 8px; }

    .result-bar-track {
      background: #f1f5f9;
      border-radius: 8px; height: 40px;
      overflow: hidden;
    }
    .result-bar {
      height: 100%;
      min-width: 4px;
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.35), rgba(37, 99, 235, 0.45));
      border-radius: 8px;
      animation: growWidth 0.8s ease-out forwards;
    }
    @keyframes growWidth { from { max-width: 0; } to { max-width: 100%; } }
    .result-bar-inner {
      height: 100%; width: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25));
    }

    .result-info {
      display: flex; justify-content: space-between;
      align-items: center; padding: 8px 4px; gap: 12px;
    }
    .result-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .result-step-num { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
    .result-page {
      font-size: 14px; color: #0f172a; font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .result-right { display: flex; align-items: center; gap: 16px; flex-shrink: 0; }
    .result-visitors { font-size: 13px; color: #64748b; }
    .result-conv { font-size: 14px; font-weight: 700; color: #2563eb; }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 18px; border-radius: 10px;
      font-size: 14px; font-weight: 500;
      cursor: pointer; transition: all 0.15s ease;
      border: none; outline: none; font-family: inherit;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: #2563eb; color: white; }
    .btn-primary:hover:not(:disabled) { background: #1d4ed8; }
    .btn-outline {
      background: #ffffff; color: #475569;
      border: 1px solid #cbd5e1;
    }
    .btn-outline:hover:not(:disabled) { border-color: #94a3b8; background: #f8fafc; }

    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .builder-header { flex-direction: column; }
      .help-card { flex-direction: column; }
    }
  `]
})
export class FunnelsComponent {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly activeSite = inject(ActiveSiteService);
  private readonly api = inject(TrafficApiService);
  private readonly cancelAnalyze$ = new Subject<void>();

  availablePages = signal<string[]>([]);
  selectedSteps = signal<FunnelBuilderStep[]>([]);
  analyzed = signal(false);
  analyzing = signal(false);
  funnelResults = signal<FunnelBuilderStep[]>([]);
  overallConversion = signal('0');
  loadError = signal('');
  private siteId: string | null = null;
  private autoAnalyzeToken = 0;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cancelAnalyze$.next();
      this.cancelAnalyze$.complete();
    });

    toObservable(this.activeSite.site, { injector: this.injector })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(site => {
          this.siteId = site?.siteId ?? null;
          this.cancelInFlightAnalyze();
          this.analyzed.set(false);
          this.funnelResults.set([]);
          if (!site) {
            this.loadError.set('');
            this.availablePages.set([]);
            this.selectedSteps.set([]);
            return of({ ok: true as const, rows: [] as PagePointDto[], auto: false });
          }
          return this.api.pages(site.siteId, 30).pipe(
            map(rows => ({ ok: true as const, rows, auto: true })),
            catchError(err => of({ ok: false as const, err, rows: [] as PagePointDto[], auto: false })),
          );
        })
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));

        const urls = this.uniquePages(
          (result.rows ?? [])
            .map(p => (p?.pageUrl || '').trim())
            .filter(Boolean),
        );
        this.availablePages.set(urls);
        this.applyDefaultSteps(urls);

        if (result.auto && urls.length >= 2 && this.siteId) {
          const token = ++this.autoAnalyzeToken;
          setTimeout(() => {
            if (token !== this.autoAnalyzeToken) return;
            this.analyzeFunnel();
          }, 0);
        }
      });
  }

  shortLabel(url: string): string {
    try {
      const u = new URL(url);
      const path = (u.pathname || '/') + (u.search || '');
      return path.length > 64 ? path.slice(0, 61) + '…' : path;
    } catch {
      return url.length > 64 ? url.slice(0, 61) + '…' : url;
    }
  }

  addStep() {
    const steps = [...this.selectedSteps()];
    const pages = this.availablePages();
    if (!pages.length) return;
    const used = new Set(steps.map(s => s.page));
    const nextPage = pages.find(p => !used.has(p)) ?? pages[0];
    steps.push({ id: Date.now() + steps.length, page: nextPage, visitors: 0, conversion: 0, dropOff: 0 });
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

  onStepPageChange(index: number, page: string) {
    const steps = [...this.selectedSteps()];
    if (!steps[index]) return;
    steps[index] = { ...steps[index], page };
    this.selectedSteps.set(steps);
    this.analyzed.set(false);
  }

  resetFunnel() {
    this.autoAnalyzeToken++;
    this.cancelInFlightAnalyze();
    this.loadError.set('');
    this.analyzed.set(false);
    this.funnelResults.set([]);
    this.overallConversion.set('0');
    this.applyDefaultSteps(this.availablePages());
    if (this.availablePages().length >= 2) {
      setTimeout(() => this.analyzeFunnel(), 0);
    } else {
      this.loadError.set('No tracked pages available to build a funnel yet.');
    }
  }

  analyzeFunnel() {
    const siteId = this.siteId ?? this.activeSite.site()?.siteId ?? null;
    this.siteId = siteId;
    if (!siteId) {
      this.analyzing.set(false);
      this.loadError.set('Select a site from the header first.');
      return;
    }
    const steps = this.selectedSteps().map(s => s.page).filter(Boolean);
    if (steps.length < 1) {
      this.analyzing.set(false);
      this.loadError.set('Add at least one funnel step.');
      return;
    }

    this.cancelInFlightAnalyze();
    this.analyzing.set(true);
    this.loadError.set('');
    const days = timeRangeToDays('30d');
    this.api
      .funnels(siteId, steps, days)
      .pipe(
        takeUntil(this.cancelAnalyze$),
        map(funnel => ({ ok: true as const, funnel })),
        catchError(err => of({ ok: false as const, err, funnel: [] as FunnelStepDto[] })),
        finalize(() => this.analyzing.set(false)),
      )
      .subscribe(result => {
        if (!result.ok) {
          this.loadError.set(httpErrorMessage(result.err));
          this.analyzed.set(true);
          this.funnelResults.set([]);
          return;
        }
        this.loadError.set('');
        const funnel = result.funnel ?? [];
        const display = funnelDtoToDisplaySteps(funnel);
        this.funnelResults.set(
          display.map((d, idx) => ({
            id: idx + 1,
            page: d.label,
            visitors: d.visitors,
            conversion: d.percentage,
            dropOff: d.dropOff,
          })),
        );
        const first = funnel[0]?.entered ?? 0;
        const last = funnel.length ? (funnel[funnel.length - 1]?.completed ?? 0) : 0;
        const overall = first === 0 ? 0 : (last / first) * 100;
        this.overallConversion.set(overall.toFixed(1));
        this.analyzed.set(true);
      });
  }

  private cancelInFlightAnalyze() {
    this.cancelAnalyze$.next();
    this.analyzing.set(false);
  }

  private uniquePages(urls: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of urls) {
      const key = u.trim();
      if (!key) continue;
      const lower = key.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(key);
    }
    return out;
  }

  private applyDefaultSteps(urls: string[]) {
    if (!urls.length) {
      this.selectedSteps.set([]);
      return;
    }
    const preferred = ['/', '/catalog', '/cart', '/checkout', '/thank-you', '/order-success'];
    const picked: string[] = [];
    for (const pref of preferred) {
      const match = urls.find(u => {
        try {
          const path = new URL(u).pathname.replace(/\/$/, '') || '/';
          return path === pref || (pref !== '/' && path.endsWith(pref));
        } catch {
          return u.includes(pref);
        }
      });
      if (match && !picked.includes(match)) picked.push(match);
      if (picked.length >= 4) break;
    }
    const steps = (picked.length >= 2 ? picked : urls.slice(0, Math.min(4, urls.length)))
      .map((page, i) => ({ id: Date.now() + i, page, visitors: 0, conversion: 0, dropOff: 0 }));
    this.selectedSteps.set(steps);
  }
}

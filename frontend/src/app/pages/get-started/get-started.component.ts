import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { BrandingService } from '../../services/branding.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import type { OnboardingStepDto, SiteDto } from '../../models/analytics.types';

interface Step {
  title: string;
  description: string;
  highlight: string;
}

@Component({
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="get-started-page">
      <div class="page-header">
        <div>
          <p class="eyebrow">Welcome to {{ branding.brandName() }}</p>
          <h1 class="page-title">{{ heroTitle() }}</h1>
          <p class="page-copy">{{ heroCopy() }}</p>
        </div>

        <div class="page-actions">
          <button class="btn-secondary" type="button" (click)="skipDemo()">Skip demo</button>
          <button class="btn-primary" type="button" (click)="nextStep()">{{ currentStep() === steps().length - 1 ? 'Finish walkthrough' : 'Next step' }}</button>
        </div>
      </div>

      <div *ngIf="!loading(); else loadingTemplate" class="content-grid">
        <section class="steps-panel">
          <div class="steps-intro">
            <span class="step-count">Step {{ currentStep() + 1 }} of {{ steps().length }}</span>
            <h2>{{ steps()[currentStep()]?.title }}</h2>
            <p>{{ steps()[currentStep()]?.description }}</p>
          </div>

          <ol class="steps-list">
            <li
              *ngFor="let step of steps(); let index = index; trackBy: trackByStep"
              class="step-item"
              [class.active]="index === currentStep()"
            >
              <span class="step-index">{{ index + 1 }}</span>
              <div>
                <strong>{{ step.title }}</strong>
                <p>{{ step.highlight }}</p>
              </div>
            </li>
          </ol>

          <div class="nav-footer">
            <button class="btn-secondary" type="button" (click)="previousStep()" [disabled]="currentStep() === 0">Previous</button>
            <button class="btn-primary" type="button" (click)="nextStep()">{{ currentStep() === steps().length - 1 ? 'Finish walkthrough' : 'Continue' }}</button>
          </div>
        </section>

        <section class="demo-panel">
          <div class="demo-card">
            <div class="demo-card-header">
              <div>
                <p class="demo-label">Demo website</p>
                <h3>{{ activeSite()?.name || 'No site registered yet' }}</h3>
              </div>
              <span class="badge">Live preview</span>
            </div>

            <div class="demo-status">
              <div class="status-pill">Tracking enabled</div>
              <div class="status-pill secondary">{{ activeSite() ? 'Site connected' : 'Awaiting site registration' }}</div>
            </div>

            <div class="demo-step-box">
              <h4>What happens in this step</h4>
              <p>{{ steps()[currentStep()]?.highlight || 'Your next onboarding step will appear here once the backend has loaded.' }}</p>
            </div>

            <div class="demo-summary">
              <div>
                <span class="summary-label">Connected site</span>
                <strong>{{ activeSite()?.domain || 'No site yet' }}</strong>
              </div>
              <div>
                <span class="summary-label">Tracking key</span>
                <strong>{{ activeSite()?.trackingKey || 'Awaiting backend site data' }}</strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ng-template #loadingTemplate>
        <div class="loading-state">Loading onboarding content from the backend…</div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .get-started-page {
        max-width: 1320px;
        margin: 14px auto;
        padding: 28px;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        margin-bottom: 28px;
        flex-wrap: wrap;
      }

      .eyebrow {
        margin: 0 0 10px;
        font-size: 12px;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: rgb(var(--color-accent));
        font-weight: 700;
      }

      .page-title {
        margin: 0;
        font-size: clamp(2rem, 2.4vw, 2.4rem);
        font-weight: 700;
        color: rgb(var(--color-text-primary));
        line-height: 1.05;
      }

      .page-copy {
        margin: 12px 0 0;
        line-height: 1.8;
        color: rgb(var(--color-text-muted));
        max-width: 680px;
      }

      .page-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 24px;
      }

      .steps-panel,
      .demo-panel {
        background: rgb(var(--color-surface));
        border: 1px solid rgb(var(--color-border));
        border-radius: 24px;
        padding: 26px;
      }

      .steps-intro h2 {
        margin: 0 0 10px;
        font-size: 1.6rem;
        color: rgb(var(--color-text-primary));
      }

      .steps-intro p {
        margin: 0;
        color: rgb(var(--color-text-muted));
        line-height: 1.8;
      }

      .step-count {
        display: inline-flex;
        margin-bottom: 18px;
        font-size: 12px;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: rgb(var(--color-accent));
        font-weight: 700;
      }

      .steps-list {
        margin: 24px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 12px;
      }

      .step-item {
        display: grid;
        grid-template-columns: 42px 1fr;
        gap: 14px;
        padding: 18px;
        border: 1px solid rgb(var(--color-border));
        border-radius: 18px;
        transition: border-color 0.2s, background 0.2s;
      }

      .step-item.active {
        background: rgba(59, 130, 246, 0.08);
        border-color: rgb(var(--color-accent));
      }

      .step-index {
        display: inline-flex;
        width: 42px;
        height: 42px;
        border-radius: 14px;
        justify-content: center;
        align-items: center;
        background: rgb(var(--color-surface-elevated));
        color: rgb(var(--color-text-primary));
        font-weight: 700;
      }

      .step-item strong {
        display: block;
        margin-bottom: 6px;
        color: rgb(var(--color-text-primary));
      }

      .step-item p {
        margin: 0;
        color: rgb(var(--color-text-muted));
        line-height: 1.7;
        font-size: 13px;
      }

      .nav-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
      }

      .demo-card {
        display: grid;
        gap: 18px;
      }

      .demo-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .demo-label {
        font-size: 12px;
        color: rgb(var(--color-accent));
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin: 0 0 6px;
      }

      .demo-card-header h3 {
        margin: 0;
        font-size: 1.25rem;
        color: rgb(var(--color-text-primary));
      }

      .badge {
        display: inline-flex;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(34, 197, 94, 0.12);
        color: rgb(34, 197, 94);
        font-size: 12px;
        font-weight: 700;
      }

      .demo-status {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .status-pill {
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(59, 130, 246, 0.12);
        color: rgb(var(--color-accent));
        font-size: 12px;
        font-weight: 700;
      }

      .status-pill.secondary {
        background: rgba(148, 163, 184, 0.12);
        color: rgb(var(--color-text-secondary));
      }

      .demo-step-box {
        border: 1px solid rgb(var(--color-border));
        border-radius: 18px;
        padding: 18px;
        background: rgb(var(--color-surface-elevated));
      }

      .demo-step-box h4 {
        margin: 0 0 10px;
        font-size: 1rem;
        color: rgb(var(--color-text-primary));
      }

      .demo-step-box p {
        margin: 0;
        color: rgb(var(--color-text-muted));
        line-height: 1.75;
      }

      .demo-summary {
        display: grid;
        gap: 14px;
      }

      .summary-label {
        display: block;
        font-size: 11px;
        color: rgb(var(--color-text-secondary));
        text-transform: uppercase;
        letter-spacing: 0.12em;
        margin-bottom: 6px;
      }

      .summary-label + strong {
        font-size: 0.95rem;
        color: rgb(var(--color-text-primary));
      }

      .loading-state {
        padding: 40px;
        text-align: center;
        border: 1px solid rgb(var(--color-border));
        border-radius: 24px;
        color: rgb(var(--color-text-secondary));
      }

      .btn-primary,
      .btn-secondary {
        border: none;
        border-radius: 12px;
        padding: 12px 18px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
      }

      .btn-primary {
        background: rgb(var(--color-accent));
        color: white;
      }

      .btn-secondary {
        background: rgba(255, 255, 255, 0.06);
        color: rgb(var(--color-text-primary));
      }

      @media (max-width: 1060px) {
        .content-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class GetStartedComponent {
  readonly router = inject(Router);
  readonly branding = inject(BrandingService);
  readonly api = inject(TrafficApiService);

  currentStep = signal(0);
  loading = signal(true);
  heroTitle = signal('Get started in 5 easy steps');
  heroCopy = signal('We’ll walk you through how website tracking works, how to connect your first site, and how to see real analytics immediately.');
  steps = signal<OnboardingStepDto[]>([]);
  activeSite = signal<SiteDto | null>(null);

  constructor() {
    this.loadContent();
  }

  private loadContent(): void {
    this.api.listSites().subscribe({
      next: sites => this.activeSite.set(sites[0] ?? null),
      error: () => {},
    });

    this.api.onboarding().subscribe({
      next: demo => {
        this.heroTitle.set(demo.heroTitle);
        this.heroCopy.set(demo.heroCopy);
        this.steps.set(demo.steps);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  nextStep(): void {
    const next = this.currentStep() + 1;
    if (next < this.steps().length) {
      this.currentStep.set(next);
    } else {
      this.router.navigate(['/']);
    }
  }

  previousStep(): void {
    const prev = this.currentStep() - 1;
    if (prev >= 0) {
      this.currentStep.set(prev);
    }
  }

  skipDemo(): void {
    this.router.navigate(['/']);
  }

  trackByStep(index: number, step: OnboardingStepDto): string {
    return step.title;
  }
}

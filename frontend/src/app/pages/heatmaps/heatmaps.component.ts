import { Component, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-heatmaps',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-container">
      <div class="page-header animate-in">
        <h1 class="page-title">🔥 Heatmaps</h1>
        <p class="page-subtitle">Visualize where users click and how far they scroll</p>
      </div>

      <!-- Toggle -->
      <div class="heatmap-toggle animate-in" style="animation-delay: 80ms">
        <div class="toggle-group">
          <button [class.active]="activeTab() === 'click'" (click)="activeTab.set('click')">Click Heatmap</button>
          <button [class.active]="activeTab() === 'scroll'" (click)="activeTab.set('scroll')">Scroll Depth</button>
        </div>
      </div>

      <!-- Click Heatmap -->
      @if (activeTab() === 'click') {
        <section class="card heatmap-card animate-in" style="animation-delay: 150ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Click Heatmap — /home</h3>
              <p class="chart-subtitle">Shows where users click the most</p>
            </div>
            <div class="heatmap-stats">
              <div class="stat">
                <span class="stat-value">12,450</span>
                <span class="stat-label">Total Clicks</span>
              </div>
              <div class="stat">
                <span class="stat-value">847</span>
                <span class="stat-label">Unique Areas</span>
              </div>
            </div>
          </div>

          <div class="heatmap-viewport">
            <div class="mock-page" #clickMap>
              <!-- Mock page header -->
              <div class="mock-nav">
                <div class="mock-logo"></div>
                <div class="mock-nav-links">
                  <div class="mock-link"></div>
                  <div class="mock-link"></div>
                  <div class="mock-link"></div>
                  <div class="mock-link mock-link-cta">
                    <div class="hotspot hotspot-intense" style="top: -8px; left: -8px;"></div>
                  </div>
                </div>
              </div>

              <!-- Mock hero -->
              <div class="mock-hero">
                <div class="mock-hero-title"></div>
                <div class="mock-hero-sub"></div>
                <div class="mock-hero-btn">
                  <div class="hotspot hotspot-hot" style="top: -12px; left: -12px;"></div>
                </div>
              </div>

              <!-- Mock features -->
              <div class="mock-features">
                <div class="mock-feature">
                  <div class="mock-feature-icon"></div>
                  <div class="mock-feature-text"></div>
                  <div class="hotspot hotspot-warm" style="top: 8px; right: 8px;"></div>
                </div>
                <div class="mock-feature">
                  <div class="mock-feature-icon"></div>
                  <div class="mock-feature-text"></div>
                  <div class="hotspot hotspot-cool" style="top: 8px; right: 8px;"></div>
                </div>
                <div class="mock-feature">
                  <div class="mock-feature-icon"></div>
                  <div class="mock-feature-text"></div>
                  <div class="hotspot hotspot-warm" style="top: 8px; right: 8px;"></div>
                </div>
              </div>

              <!-- Mock CTA Section -->
              <div class="mock-cta">
                <div class="mock-cta-title"></div>
                <div class="mock-cta-btn">
                  <div class="hotspot hotspot-hot" style="top: -10px; left: -10px;"></div>
                </div>
              </div>

              <!-- Mock footer -->
              <div class="mock-footer">
                <div class="mock-footer-links">
                  <div class="mock-link-small"></div>
                  <div class="mock-link-small"></div>
                  <div class="mock-link-small">
                    <div class="hotspot hotspot-cold" style="top: -4px; left: -4px;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Legend -->
          <div class="heatmap-legend">
            <span class="legend-label">Cold</span>
            <div class="legend-gradient"></div>
            <span class="legend-label">Hot</span>
          </div>
        </section>
      }

      <!-- Scroll Depth -->
      @if (activeTab() === 'scroll') {
        <section class="card heatmap-card animate-in" style="animation-delay: 150ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Scroll Depth — /home</h3>
              <p class="chart-subtitle">How far visitors scroll on this page</p>
            </div>
          </div>

          <div class="scroll-viewport">
            <div class="scroll-page">
              <div class="scroll-section" *ngFor="let section of scrollSections" [style.background]="section.color">
                <div class="scroll-label">
                  <span class="scroll-depth">{{ section.depth }}%</span>
                  <span class="scroll-visitors">{{ section.visitors | number }} visitors reached here</span>
                </div>
              </div>
            </div>

            <!-- Markers -->
            <div class="scroll-markers">
              <div class="scroll-marker" *ngFor="let m of scrollMarkers" [style.top.%]="m.position">
                <span class="marker-line"></span>
                <span class="marker-label">{{ m.label }} — {{ m.visitors }}%</span>
              </div>
            </div>
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

    .heatmap-toggle { margin-bottom: 20px; }

    .toggle-group {
      display: inline-flex;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 8px; padding: 3px; gap: 2px;
    }
    .toggle-group button {
      padding: 8px 18px; border-radius: 6px;
      font-size: 13px; font-weight: 500;
      color: rgb(var(--color-text-muted));
      background: transparent; border: none; cursor: pointer;
      transition: all 150ms ease; font-family: 'Inter', sans-serif;
    }
    .toggle-group button:hover { color: rgb(var(--color-text-secondary)); }
    .toggle-group button.active { background: rgb(var(--color-accent)); color: white; box-shadow: 0 0 12px rgba(99, 102, 241, 0.25); }

    .heatmap-card { padding: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .heatmap-stats { display: flex; gap: 28px; }
    .stat { display: flex; flex-direction: column; align-items: flex-end; }
    .stat-value { font-size: 20px; font-weight: 700; color: rgb(var(--color-text-primary)); }
    .stat-label { font-size: 12px; color: rgb(var(--color-text-muted)); }

    /* Mock Page */
    .heatmap-viewport {
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      overflow: hidden;
      position: relative;
    }

    .mock-page { padding: 20px; min-height: 500px; }

    .mock-nav {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; margin-bottom: 40px;
    }
    .mock-logo { width: 100px; height: 24px; background: rgba(255,255,255,0.06); border-radius: 4px; }
    .mock-nav-links { display: flex; gap: 16px; align-items: center; }
    .mock-link { width: 50px; height: 10px; background: rgba(255,255,255,0.04); border-radius: 3px; }
    .mock-link-cta {
      width: 80px; height: 30px;
      background: rgba(99, 102, 241, 0.15);
      border-radius: 6px; position: relative;
    }

    .mock-hero { text-align: center; padding: 40px 0; }
    .mock-hero-title { width: 60%; height: 28px; background: rgba(255,255,255,0.06); border-radius: 6px; margin: 0 auto 16px; }
    .mock-hero-sub { width: 40%; height: 14px; background: rgba(255,255,255,0.03); border-radius: 4px; margin: 0 auto 28px; }
    .mock-hero-btn {
      width: 160px; height: 42px;
      background: rgba(99, 102, 241, 0.2);
      border-radius: 8px; margin: 0 auto; position: relative;
    }

    .mock-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 40px 0; }
    .mock-feature {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.04);
      border-radius: 12px; padding: 24px;
      position: relative;
    }
    .mock-feature-icon { width: 40px; height: 40px; background: rgba(99, 102, 241, 0.1); border-radius: 10px; margin-bottom: 12px; }
    .mock-feature-text { width: 80%; height: 10px; background: rgba(255,255,255,0.03); border-radius: 3px; }

    .mock-cta { text-align: center; padding: 40px 0; }
    .mock-cta-title { width: 50%; height: 20px; background: rgba(255,255,255,0.05); border-radius: 5px; margin: 0 auto 20px; }
    .mock-cta-btn {
      width: 140px; height: 38px;
      background: rgba(52, 211, 153, 0.15);
      border-radius: 8px; margin: 0 auto; position: relative;
    }

    .mock-footer { padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.04); margin-top: 20px; }
    .mock-footer-links { display: flex; gap: 20px; }
    .mock-link-small { width: 60px; height: 8px; background: rgba(255,255,255,0.03); border-radius: 3px; position: relative; }

    /* Hotspots */
    .hotspot {
      position: absolute;
      width: 50px; height: 50px;
      border-radius: 50%;
      animation: pulse 2s infinite;
      pointer-events: none;
    }

    .hotspot-intense {
      background: radial-gradient(circle, rgba(248, 113, 113, 0.6) 0%, rgba(248, 113, 113, 0.2) 40%, transparent 70%);
      width: 60px; height: 60px;
    }

    .hotspot-hot {
      background: radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(248, 113, 113, 0.3) 40%, transparent 70%);
      width: 70px; height: 70px;
    }

    .hotspot-warm {
      background: radial-gradient(circle, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0.15) 40%, transparent 70%);
      width: 45px; height: 45px;
    }

    .hotspot-cool {
      background: radial-gradient(circle, rgba(96, 165, 250, 0.3) 0%, rgba(96, 165, 250, 0.1) 40%, transparent 70%);
      width: 40px; height: 40px;
    }

    .hotspot-cold {
      background: radial-gradient(circle, rgba(96, 165, 250, 0.2) 0%, transparent 60%);
      width: 30px; height: 30px;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.8; }
    }

    /* Legend */
    .heatmap-legend {
      display: flex; align-items: center; gap: 12px;
      justify-content: center; margin-top: 20px;
    }
    .legend-label { font-size: 12px; color: rgb(var(--color-text-muted)); }
    .legend-gradient {
      width: 200px; height: 8px;
      border-radius: 4px;
      background: linear-gradient(90deg, rgb(96, 165, 250), rgb(52, 211, 153), rgb(251, 191, 36), rgb(248, 113, 113));
    }

    /* Scroll Depth */
    .scroll-viewport {
      position: relative;
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .scroll-page { display: flex; flex-direction: column; }

    .scroll-section {
      padding: 32px 24px;
      display: flex; align-items: center;
      justify-content: center;
      transition: all var(--transition-base);
    }
    .scroll-section:hover { filter: brightness(1.2); }

    .scroll-label { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .scroll-depth { font-size: 22px; font-weight: 700; color: white; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
    .scroll-visitors { font-size: 12px; color: rgba(255,255,255,0.8); }

    .scroll-markers { position: absolute; right: 0; top: 0; bottom: 0; width: 200px; }
    .scroll-marker {
      position: absolute; right: 0; display: flex; align-items: center; gap: 8px;
    }
    .marker-line { width: 20px; height: 2px; background: rgba(255,255,255,0.3); }
    .marker-label { font-size: 11px; color: rgb(var(--color-text-muted)); white-space: nowrap; }

    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .mock-features { grid-template-columns: 1fr; }
      .heatmap-stats { gap: 16px; }
    }
  `]
})
export class HeatmapsComponent {
  activeTab = signal<'click' | 'scroll'>('click');

  scrollSections = [
    { depth: 0, visitors: 24853, color: 'rgba(52, 211, 153, 0.3)' },
    { depth: 25, visitors: 19882, color: 'rgba(52, 211, 153, 0.22)' },
    { depth: 50, visitors: 14912, color: 'rgba(251, 191, 36, 0.2)' },
    { depth: 75, visitors: 7456, color: 'rgba(248, 113, 113, 0.18)' },
    { depth: 100, visitors: 2486, color: 'rgba(248, 113, 113, 0.12)' },
  ];

  scrollMarkers = [
    { position: 0, label: 'Above fold', visitors: 100 },
    { position: 25, label: 'Features', visitors: 80 },
    { position: 50, label: 'Pricing', visitors: 60 },
    { position: 75, label: 'Testimonials', visitors: 30 },
    { position: 95, label: 'Footer', visitors: 10 },
  ];
}

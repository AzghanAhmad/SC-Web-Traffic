import { Component, DestroyRef, Injector, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import type { HeatmapPointDto, PagePointDto, ScrollDepthPointDto } from '../../models/analytics.types';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import { TrafficAutoRefreshService } from '../../services/traffic-auto-refresh.service';
import { httpErrorMessage, timeRangeToDays } from '../../utils/analytics.helpers';

@Component({
  selector: 'app-heatmaps',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      @if (loadError()) {
        <div class="error-banner">{{ loadError() }}</div>
      }
      <div class="page-header animate-in">
        <h1 class="page-title">Heatmaps</h1>
        <p class="page-subtitle">See where visitors click and how far they scroll so you can improve page layout and calls to action.</p>
      </div>

      <div class="toolbar animate-in" style="animation-delay: 80ms">
        <div class="field-block">
          <label class="field-label" for="heatmap-page">Page URL</label>
          <select id="heatmap-page" class="page-select" [(ngModel)]="selectedPageUrl" (ngModelChange)="onPageChange()">
            @for (p of pageOptions(); track p) {
              <option [value]="p">{{ p }}</option>
            }
          </select>
        </div>
        <div class="toggle-group" role="tablist" aria-label="Heatmap type">
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'click'" [class.active]="activeTab() === 'click'" (click)="setTab('click')">Click map</button>
          <button type="button" role="tab" [attr.aria-selected]="activeTab() === 'scroll'" [class.active]="activeTab() === 'scroll'" (click)="setTab('scroll')">Scroll depth</button>
        </div>
      </div>

      @if (activeTab() === 'click') {
        <div class="help-card animate-in" style="animation-delay: 120ms">
          <div class="help-card-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 9l-2 9 9-2 7-7a2.8 2.8 0 0 0-4-4z"/>
              <path d="M16 5l3 3"/>
            </svg>
          </div>
          <div class="help-card-body">
            <h2 class="help-card-title">What is a click map?</h2>
            <p class="help-card-text">
              A click map shows where people tap or click on the page. Brighter, larger spots get more attention.
              Use it to check whether buttons and links are noticed — or if visitors click places that aren’t clickable.
            </p>
          </div>
        </div>

        <section class="card heatmap-card animate-in" style="animation-delay: 180ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">Where visitors click</h3>
              <p class="chart-subtitle">Tap a hotspot or a row in the list to inspect it</p>
            </div>
            <div class="heatmap-stats">
              <div class="stat">
                <span class="stat-value">{{ totalClicks() | number }}</span>
                <span class="stat-label">Total clicks</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ points().length | number }}</span>
                <span class="stat-label">Hot spots</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ topZoneShare() }}%</span>
                <span class="stat-label">In top of page</span>
              </div>
            </div>
          </div>

          @if (!points().length && activeSite.site()) {
            <p class="hint empty-scroll">No click data for this page yet. After visitors use links and buttons with the tracker installed, hotspots will appear here.</p>
          } @else if (points().length) {
            <div class="click-layout">
              <div class="click-map-col">
                <div class="page-preview-label">Page click map</div>
                <div class="heatmap-viewport">
                  <div class="heatmap-canvas" role="listbox" aria-label="Click hotspots on the page">
                    <div class="canvas-guide top">Top</div>
                    <div class="canvas-guide mid">Middle</div>
                    <div class="canvas-guide bot">Bottom</div>
                    @for (pt of points(); track pt.id) {
                      <button
                        type="button"
                        class="heat-dot"
                        role="option"
                        [attr.aria-selected]="selectedPointId() === pt.id"
                        [attr.aria-label]="pt.count + ' clicks near ' + pt.zoneLabel"
                        [class.selected]="selectedPointId() === pt.id"
                        [style.left.%]="pt.xPct"
                        [style.top.%]="pt.yPct"
                        [style.width.px]="pt.size"
                        [style.height.px]="pt.size"
                        [style.margin-left.px]="-(pt.size / 2)"
                        [style.margin-top.px]="-(pt.size / 2)"
                        [style.background]="pt.background"
                        (click)="selectPoint(pt.id)">
                      </button>
                    }
                  </div>
                </div>
                <div class="intensity-legend" aria-hidden="true">
                  <span>Fewer clicks</span>
                  <div class="intensity-bar"></div>
                  <span>More clicks</span>
                </div>
              </div>

              <div class="click-details">
                <div class="detail-panel" aria-live="polite">
                  <p class="detail-kicker">Selected hotspot</p>
                  <h4 class="detail-title">{{ selectedPoint()?.zoneLabel || 'Pick a spot' }}</h4>
                  <p class="detail-hint">
                    @if (selectedPoint(); as sp) {
                      {{ sp.count | number }} click{{ sp.count === 1 ? '' : 's' }} clustered here
                      ({{ sp.share }}% of all clicks on this page).
                      {{ sp.hint }}
                    } @else {
                      Click any glowing spot on the map, or choose a row from the hottest spots list.
                    }
                  </p>
                  @if (selectedPoint(); as sp) {
                    <div class="detail-metrics">
                      <div class="detail-metric">
                        <span class="detail-metric-value">{{ sp.count | number }}</span>
                        <span class="detail-metric-label">clicks at this spot</span>
                      </div>
                      <div class="detail-metric">
                        <span class="detail-metric-value">{{ sp.share }}%</span>
                        <span class="detail-metric-label">of page clicks</span>
                      </div>
                    </div>
                  }
                  @if (clickInsight()) {
                    <p class="drop-insight">{{ clickInsight() }}</p>
                  }
                </div>

                <div class="zone-bars">
                  <p class="page-preview-label">Clicks by page area</p>
                  @for (z of clickZones(); track z.key) {
                    <button
                      type="button"
                      class="reach-row"
                      [class.selected]="selectedPoint()?.zone === z.key"
                      (click)="selectHottestInZone(z.key)">
                      <div class="reach-row-head">
                        <span class="reach-label">{{ z.label }}</span>
                        <span class="reach-pct">{{ z.share }}%</span>
                      </div>
                      <div class="reach-track" aria-hidden="true">
                        <div class="reach-fill" [style.width.%]="z.share" [style.background]="z.color"></div>
                      </div>
                    </button>
                  }
                </div>

                <div class="hot-list">
                  <p class="page-preview-label">Hottest spots</p>
                  @for (pt of topPoints(); track pt.id; let i = $index) {
                    <button
                      type="button"
                      class="hot-row"
                      [class.selected]="selectedPointId() === pt.id"
                      (click)="selectPoint(pt.id)">
                      <span class="hot-rank">{{ i + 1 }}</span>
                      <span class="hot-meta">
                        <span class="hot-title">{{ pt.zoneLabel }}</span>
                        <span class="hot-sub">{{ pt.share }}% of clicks</span>
                      </span>
                      <span class="hot-count">{{ pt.count | number }}</span>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </section>
      }

      @if (activeTab() === 'scroll') {
        <div class="help-card animate-in" style="animation-delay: 120ms">
          <div class="help-card-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="6" y="2" width="12" height="20" rx="2"/>
              <path d="M12 6v8"/>
              <path d="M9 12l3 3 3-3"/>
            </svg>
          </div>
          <div class="help-card-body">
            <h2 class="help-card-title">What is scroll depth?</h2>
            <p class="help-card-text">
              Scroll depth shows how far down the page people go. The top is seen by almost everyone;
              fewer people reach the bottom. Use it to place important content and buttons where visitors still look.
            </p>
          </div>
        </div>

        <section class="card heatmap-card animate-in" style="animation-delay: 180ms">
          <div class="chart-header">
            <div>
              <h3 class="chart-title">How far visitors scroll</h3>
              <p class="chart-subtitle">Tap a section of the page preview or a bar to see details</p>
            </div>
            <div class="heatmap-stats">
              <div class="stat">
                <span class="stat-value">{{ avgScrollDepth() }}%</span>
                <span class="stat-label">Typical depth</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ halfPageReach() }}%</span>
                <span class="stat-label">Reach halfway</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ bottomReach() }}%</span>
                <span class="stat-label">Reach bottom</span>
              </div>
            </div>
          </div>

          @if (!hasScrollData()) {
            <p class="hint empty-scroll">No scroll data for this page yet. After visitors browse with the tracker installed, depths will appear here.</p>
          } @else {
            <div class="scroll-layout">
              <div class="page-preview" role="listbox" aria-label="Page scroll sections">
                <div class="page-preview-label">Page preview</div>
                <div class="page-stack">
                  @for (band of scrollBands(); track band.depth; let i = $index) {
                    <button
                      type="button"
                      class="page-band"
                      role="option"
                      [attr.aria-selected]="selectedDepth() === band.depth"
                      [class.selected]="selectedDepth() === band.depth"
                      [style.flex]="band.bandFlex"
                      [style.background]="band.background"
                      (click)="selectDepth(band.depth)"
                      (keydown.enter)="selectDepth(band.depth)"
                      (keydown.space)="$event.preventDefault(); selectDepth(band.depth)">
                      <span class="band-marker">{{ band.depth }}%</span>
                      <span class="band-reach">{{ band.reachPercent }}% saw this</span>
                    </button>
                  }
                </div>
                <div class="page-legend">
                  <span class="legend-hot">More visitors</span>
                  <span class="legend-cold">Fewer visitors</span>
                </div>
              </div>

              <div class="scroll-details">
                <div class="detail-panel" [attr.aria-live]="'polite'">
                  <p class="detail-kicker">Selected section</p>
                  <h4 class="detail-title">{{ selectedBand()?.label }}</h4>
                  <p class="detail-hint">{{ selectedBand()?.hint }}</p>
                  <div class="detail-metrics">
                    <div class="detail-metric">
                      <span class="detail-metric-value">{{ selectedBand()?.reachPercent }}%</span>
                      <span class="detail-metric-label">of page visitors reached here</span>
                    </div>
                    <div class="detail-metric">
                      <span class="detail-metric-value">{{ selectedBand()?.reached | number }}</span>
                      <span class="detail-metric-label">times recorded</span>
                    </div>
                  </div>
                  @if (dropOffInsight()) {
                    <p class="drop-insight">{{ dropOffInsight() }}</p>
                  }
                </div>

                <div class="reach-bars" role="list">
                  @for (band of scrollBands(); track band.depth) {
                    <button
                      type="button"
                      class="reach-row"
                      role="listitem"
                      [class.selected]="selectedDepth() === band.depth"
                      (click)="selectDepth(band.depth)">
                      <div class="reach-row-head">
                        <span class="reach-label">{{ band.label }}</span>
                        <span class="reach-pct">{{ band.reachPercent }}%</span>
                      </div>
                      <div class="reach-track" aria-hidden="true">
                        <div
                          class="reach-fill"
                          [style.width.%]="band.reachPercent"
                          [style.background]="band.color">
                        </div>
                      </div>
                    </button>
                  }
                </div>
              </div>
            </div>
          }
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

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 20px;
    }
    .field-block { display: flex; flex-direction: column; }
    .field-label { font-size: 12px; font-weight: 600; color: rgb(var(--color-text-muted)); display: block; margin-bottom: 6px; }
    .page-select {
      min-width: 280px;
      max-width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgb(var(--color-border));
      background: rgb(var(--color-surface));
      color: rgb(var(--color-text-primary));
      font-size: 13px;
    }

    .toggle-group {
      display: inline-flex;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 8px;
      padding: 3px;
      gap: 2px;
    }
    .toggle-group button {
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      color: rgb(var(--color-text-muted));
      background: transparent;
      border: none;
      cursor: pointer;
      font-family: inherit;
    }
    .toggle-group button.active {
      background: rgb(var(--color-accent));
      color: white;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
    }

    .help-card {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      padding: 18px 20px;
      margin-bottom: 16px;
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
      color: #2563eb;
    }
    .help-card-body { min-width: 0; flex: 1; }
    .help-card-title {
      margin: 0 0 6px;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .help-card-text {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      max-width: 68ch;
    }

    .heatmap-card { padding: 24px; }
    .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .chart-title { font-size: 16px; font-weight: 600; color: rgb(var(--color-text-primary)); margin: 0; }
    .chart-subtitle { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 2px; }

    .heatmap-stats { display: flex; gap: 28px; flex-wrap: wrap; }
    .stat { display: flex; flex-direction: column; align-items: flex-end; }
    .stat-value { font-size: 20px; font-weight: 700; color: rgb(var(--color-text-primary)); }
    .stat-label { font-size: 12px; color: rgb(var(--color-text-muted)); }

    .heatmap-viewport {
      background: rgb(var(--color-surface-elevated));
      border: 1px solid rgb(var(--color-border));
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .heatmap-canvas {
      position: relative;
      height: 420px;
      background:
        linear-gradient(180deg, rgba(248, 250, 252, 0.95) 0%, rgba(226, 232, 240, 0.55) 50%, rgba(203, 213, 225, 0.7) 100%);
    }
    .canvas-guide {
      position: absolute;
      left: 10px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(100, 116, 139, 0.75);
      pointer-events: none;
      z-index: 0;
    }
    .canvas-guide.top { top: 10px; }
    .canvas-guide.mid { top: 50%; transform: translateY(-50%); }
    .canvas-guide.bot { bottom: 10px; }
    .heat-dot {
      position: absolute;
      border: none;
      padding: 0;
      border-radius: 50%;
      cursor: pointer;
      z-index: 1;
      box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .heat-dot:hover {
      transform: scale(1.12);
      z-index: 3;
    }
    .heat-dot.selected {
      z-index: 4;
      box-shadow: 0 0 0 3px #fff, 0 0 0 6px #2563eb;
      transform: scale(1.18);
    }

    .click-layout {
      display: grid;
      grid-template-columns: minmax(280px, 1.2fr) minmax(260px, 0.9fr);
      gap: 24px;
      align-items: start;
    }
    .click-map-col { min-width: 0; }
    .click-details { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .intensity-legend {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      font-size: 11px;
      color: #64748b;
    }
    .intensity-bar {
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: linear-gradient(90deg, #93c5fd, #fb923c, #ef4444);
    }
    .zone-bars { display: flex; flex-direction: column; gap: 8px; }
    .hot-list { display: flex; flex-direction: column; gap: 6px; }
    .hot-row {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #fff;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .hot-row:hover { border-color: #cbd5e1; }
    .hot-row.selected {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    .hot-rank {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      background: #f1f5f9;
      flex-shrink: 0;
    }
    .hot-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .hot-title { font-size: 13px; font-weight: 600; color: #0f172a; }
    .hot-sub { font-size: 11px; color: #64748b; }
    .hot-count {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .scroll-layout {
      display: grid;
      grid-template-columns: minmax(200px, 280px) 1fr;
      gap: 24px;
      align-items: start;
    }

    .page-preview-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .page-stack {
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      min-height: 360px;
      background: #fff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .page-band {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 14px;
      border: none;
      border-bottom: 1px solid rgba(148, 163, 184, 0.35);
      color: #0f172a;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
      min-height: 48px;
    }
    .page-band:last-child { border-bottom: none; }
    .page-band:hover {
      filter: brightness(0.97);
      z-index: 1;
    }
    .page-band.selected {
      outline: 2px solid #2563eb;
      outline-offset: -2px;
      z-index: 2;
      box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.2);
    }
    .band-marker {
      font-size: 13px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .band-reach {
      font-size: 12px;
      color: #334155;
      font-weight: 500;
    }

    .page-legend {
      display: flex;
      justify-content: space-between;
      margin-top: 10px;
      font-size: 11px;
      color: #64748b;
    }
    .legend-hot::before,
    .legend-cold::before {
      content: '';
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 2px;
      margin-right: 6px;
      vertical-align: -1px;
    }
    .legend-hot::before { background: #f97316; }
    .legend-cold::before { background: #93c5fd; }

    .scroll-details { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
    .detail-panel {
      padding: 18px 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .detail-kicker {
      margin: 0 0 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #64748b;
    }
    .detail-title {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }
    .detail-hint {
      margin: 0 0 16px;
      font-size: 14px;
      line-height: 1.55;
      color: #475569;
    }
    .detail-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .detail-metric {
      padding: 12px;
      border-radius: 10px;
      background: #fff;
      border: 1px solid #e2e8f0;
    }
    .detail-metric-value {
      display: block;
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .detail-metric-label {
      display: block;
      margin-top: 2px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .drop-insight {
      margin: 14px 0 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-size: 13px;
      line-height: 1.5;
    }

    .reach-bars { display: flex; flex-direction: column; gap: 8px; }
    .reach-row {
      display: block;
      width: 100%;
      padding: 12px 14px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #fff;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .reach-row:hover { border-color: #cbd5e1; }
    .reach-row.selected {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
    }
    .reach-row-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 8px;
    }
    .reach-label { font-size: 13px; font-weight: 600; color: #0f172a; }
    .reach-pct { font-size: 13px; font-weight: 700; color: #334155; font-variant-numeric: tabular-nums; }
    .reach-track {
      height: 8px;
      border-radius: 999px;
      background: #e2e8f0;
      overflow: hidden;
    }
    .reach-fill {
      height: 100%;
      border-radius: 999px;
      min-width: 0;
      transition: width 0.35s ease;
    }

    .hint { font-size: 13px; color: rgb(var(--color-text-muted)); margin-top: 12px; }
    .empty-scroll { padding: 24px 8px; text-align: center; }

    @media (max-width: 900px) {
      .scroll-layout,
      .click-layout { grid-template-columns: 1fr; }
      .page-stack { min-height: 280px; }
      .stat { align-items: flex-start; }
    }
    @media (max-width: 768px) {
      .page-container { padding: 16px; }
      .heatmap-stats { gap: 16px; }
      .detail-metrics { grid-template-columns: 1fr; }
      .help-card { flex-direction: column; }
      .page-select { min-width: 0; width: 100%; }
    }
  `]
})
export class HeatmapsComponent {
  readonly activeSite = inject(ActiveSiteService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(TrafficApiService);
  private readonly trafficRefresh = inject(TrafficAutoRefreshService);

  activeTab = signal<'click' | 'scroll'>('click');
  pageOptions = signal<string[]>(['/']);
  selectedPageUrl = '/';
  points = signal<ClickPoint[]>([]);
  selectedPointId = signal<string | null>(null);
  clickZones = signal<ClickZone[]>([]);
  scrollBands = signal<ScrollBand[]>([]);
  selectedDepth = signal(0);
  totalClicks = signal(0);
  loadError = signal('');

  constructor() {
    combineLatest([
      toObservable(this.activeSite.site, { injector: this.injector }),
      toObservable(this.trafficRefresh.pulse, { injector: this.injector }),
    ])
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(([site]) => {
          if (!site) {
            this.loadError.set('');
            this.pageOptions.set(['/']);
            this.selectedPageUrl = '/';
            this.applyClickPoints([]);
            this.applyScrollDepth([]);
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
        this.pageOptions.set(list);
        if (!list.includes(this.selectedPageUrl)) {
          this.selectedPageUrl = list[0];
        }
        this.reloadActiveTab();
      });
  }

  setTab(tab: 'click' | 'scroll') {
    this.activeTab.set(tab);
    this.reloadActiveTab();
  }

  onPageChange() {
    this.reloadActiveTab();
  }

  selectDepth(depth: number) {
    this.selectedDepth.set(depth);
  }

  selectPoint(id: string) {
    this.selectedPointId.set(id);
  }

  selectedPoint(): ClickPoint | undefined {
    const id = this.selectedPointId();
    return this.points().find(p => p.id === id);
  }

  topPoints(): ClickPoint[] {
    return this.points().slice(0, 5);
  }

  topZoneShare(): number {
    return this.clickZones().find(z => z.key === 'top')?.share ?? 0;
  }

  selectHottestInZone(zone: ClickZoneKey) {
    const best = this.points().find(p => p.zone === zone);
    if (best) this.selectedPointId.set(best.id);
  }

  clickInsight(): string {
    const zones = this.clickZones();
    if (!zones.length || !this.points().length) return '';
    const top = zones.find(z => z.key === 'top');
    const bottom = zones.find(z => z.key === 'bottom');
    const hottest = this.points()[0];
    if (top && top.share >= 65) {
      return `Most clicks (${top.share}%) happen near the top. Make sure your main call to action is visible without scrolling.`;
    }
    if (bottom && bottom.share >= 40) {
      return `A large share of clicks (${bottom.share}%) are lower on the page. People are engaging below the fold — keep important actions easy to find there too.`;
    }
    if (hottest && hottest.share >= 25) {
      return `One hotspot alone accounts for ${hottest.share}% of clicks in the ${hottest.zoneLabel.toLowerCase()}. Check that this area matches your intended button or link.`;
    }
    return '';
  }

  selectedBand(): ScrollBand | undefined {
    return this.scrollBands().find(b => b.depth === this.selectedDepth());
  }

  hasScrollData(): boolean {
    const bands = this.scrollBands();
    if (!bands.length) return false;
    return bands.some(b => b.depth > 0 && b.reached > 0);
  }

  avgScrollDepth(): number {
    const bands = this.scrollBands().filter(b => b.depth > 0);
    if (!bands.length) return 0;
    let weighted = 0;
    let weight = 0;
    for (const b of bands) {
      weighted += b.depth * b.reachPercent;
      weight += b.reachPercent;
    }
    return weight > 0 ? Math.round(weighted / weight) : 0;
  }

  halfPageReach(): number {
    return this.scrollBands().find(b => b.depth === 50)?.reachPercent ?? 0;
  }

  bottomReach(): number {
    return this.scrollBands().find(b => b.depth === 100)?.reachPercent ?? 0;
  }

  dropOffInsight(): string {
    const bands = this.scrollBands();
    if (bands.length < 2) return '';
    let worstFrom = bands[0];
    let worstTo = bands[1];
    let worstDrop = -1;
    for (let i = 0; i < bands.length - 1; i++) {
      const drop = bands[i].reachPercent - bands[i + 1].reachPercent;
      if (drop > worstDrop) {
        worstDrop = drop;
        worstFrom = bands[i];
        worstTo = bands[i + 1];
      }
    }
    if (worstDrop < 8) return '';
    return `Biggest drop-off: ${worstDrop.toFixed(0)}% stop between “${worstFrom.label}” and “${worstTo.label}”. Consider moving key content higher.`;
  }

  private reloadActiveTab() {
    if (this.activeTab() === 'click') this.loadHeatmap();
    else this.loadScrollDepth();
  }

  private loadHeatmap() {
    const site = this.activeSite.site();
    if (!site) {
      this.applyClickPoints([]);
      return;
    }
    const days = timeRangeToDays('30d');
    const url = this.selectedPageUrl;
    this.api
      .heatmap(site.siteId, url, days)
      .pipe(
        map(rows => ({ ok: true as const, rows })),
        catchError(err => of({ ok: false as const, err, rows: [] as HeatmapPointDto[] })),
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        this.applyClickPoints(result.rows);
      });
  }

  private loadScrollDepth() {
    const site = this.activeSite.site();
    if (!site) {
      this.applyScrollDepth([]);
      return;
    }
    const days = timeRangeToDays('30d');
    const url = this.selectedPageUrl;
    this.api
      .scrollDepth(site.siteId, url, days)
      .pipe(
        map(rows => ({ ok: true as const, rows })),
        catchError(err => of({ ok: false as const, err, rows: [] as ScrollDepthPointDto[] })),
      )
      .subscribe(result => {
        if (result.ok) this.loadError.set('');
        else this.loadError.set(httpErrorMessage(result.err));
        this.applyScrollDepth(result.rows);
      });
  }

  private applyClickPoints(rows: HeatmapPointDto[]) {
    // Exclude scroll-milestone rows stored at (0,0) so the click map stays about real clicks.
    const clickRows = rows.filter(r => !(r.x === 0 && r.y === 0));
    if (!clickRows.length) {
      this.points.set([]);
      this.clickZones.set([]);
      this.totalClicks.set(0);
      this.selectedPointId.set(null);
      return;
    }

    const maxX = Math.max(...clickRows.map(r => r.x), 1);
    const maxY = Math.max(...clickRows.map(r => r.y), 1);
    const maxC = Math.max(...clickRows.map(r => r.count), 1);
    const total = clickRows.reduce((s, r) => s + r.count, 0);
    this.totalClicks.set(total);

    const mapped: ClickPoint[] = clickRows
      .map((r, i) => {
        const xPct = Math.min(96, Math.max(4, (r.x / maxX) * 100));
        const yPct = Math.min(96, Math.max(4, (r.y / maxY) * 100));
        const intensity = r.count / maxC;
        const zone = yPct < 33 ? 'top' : yPct < 66 ? 'middle' : 'bottom';
        const zoneLabel =
          zone === 'top' ? 'Near the top' : zone === 'middle' ? 'Around the middle' : 'Near the bottom';
        const size = Math.round(28 + intensity * 36);
        const share = Math.round((r.count / total) * 1000) / 10;
        const warm = Math.round(80 + intensity * 175);
        const cool = Math.round(200 - intensity * 140);
        return {
          id: `${r.x}-${r.y}-${i}`,
          xPct,
          yPct,
          count: r.count,
          share,
          size,
          intensity,
          zone: zone as ClickZoneKey,
          zoneLabel,
          hint:
            zone === 'top'
              ? 'This area is above the fold for most screens.'
              : zone === 'middle'
                ? 'Visitors usually reach here after a short scroll.'
                : 'Only visitors who scroll farther tend to click here.',
          background: `radial-gradient(circle, rgba(${warm}, ${Math.round(60 + intensity * 40)}, ${cool}, ${0.55 + intensity * 0.35}) 0%, rgba(${warm}, 80, ${cool}, 0.12) 55%, transparent 72%)`,
        };
      })
      .sort((a, b) => b.count - a.count);

    this.points.set(mapped);

    const zoneDefs: { key: ClickZoneKey; label: string; color: string }[] = [
      { key: 'top', label: 'Top of page', color: '#ef4444' },
      { key: 'middle', label: 'Middle of page', color: '#f97316' },
      { key: 'bottom', label: 'Bottom of page', color: '#3b82f6' },
    ];
    this.clickZones.set(
      zoneDefs.map(z => {
        const clicks = mapped.filter(p => p.zone === z.key).reduce((s, p) => s + p.count, 0);
        return {
          key: z.key,
          label: z.label,
          color: z.color,
          clicks,
          share: total > 0 ? Math.round((clicks / total) * 1000) / 10 : 0,
        };
      }),
    );

    const stillSelected = mapped.some(p => p.id === this.selectedPointId());
    this.selectedPointId.set(stillSelected ? this.selectedPointId() : mapped[0]?.id ?? null);
  }

  private applyScrollDepth(rows: ScrollDepthPointDto[]) {
    if (!rows.length) {
      this.scrollBands.set([]);
      this.selectedDepth.set(0);
      return;
    }

    const colorRgbs: [number, number, number][] = [
      [249, 115, 22],
      [251, 146, 60],
      [56, 189, 248],
      [96, 165, 250],
      [147, 197, 253],
    ];
    const baseline = rows.find(r => r.depth === 0)?.reached ?? Math.max(...rows.map(r => r.reached), 1);

    const bands: ScrollBand[] = rows
      .slice()
      .sort((a, b) => a.depth - b.depth)
      .map((r, i) => {
        const reach = Math.max(0, Math.min(100, r.reachPercent));
        const [cr, cg, cb] = colorRgbs[i % colorRgbs.length];
        const alpha = 0.22 + (reach / 100) * 0.55;
        const hex = `#${((1 << 24) | (cr << 16) | (cg << 8) | cb).toString(16).slice(1)}`;
        return {
          depth: r.depth,
          reached: r.reached,
          reachPercent: reach,
          label: r.label,
          hint: r.hint,
          color: hex,
          background: `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(2)})`,
          bandFlex: Math.max(1, 5 - i),
          baseline,
        };
      });

    this.scrollBands.set(bands);
    if (!bands.some(b => b.depth === this.selectedDepth())) {
      this.selectedDepth.set(bands[0]?.depth ?? 0);
    }
  }
}

interface ClickPoint {
  id: string;
  xPct: number;
  yPct: number;
  count: number;
  share: number;
  size: number;
  intensity: number;
  zone: ClickZoneKey;
  zoneLabel: string;
  hint: string;
  background: string;
}

type ClickZoneKey = 'top' | 'middle' | 'bottom';

interface ClickZone {
  key: ClickZoneKey;
  label: string;
  color: string;
  clicks: number;
  share: number;
}

interface ScrollBand {
  depth: number;
  reached: number;
  reachPercent: number;
  label: string;
  hint: string;
  color: string;
  background: string;
  bandFlex: number;
  baseline: number;
}

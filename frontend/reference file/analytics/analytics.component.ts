import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { SmartLinkService } from '../../services/smart-link.service';
import { UniversalLinkService } from '../../services/universal-link.service';
import {
  AnalyticsSummary,
  AnalyticsByCountry,
  AnalyticsByDevice,
  AnalyticsByRetailer,
  AnalyticsByDay
} from '../../models/smart-link.model';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <!-- Hero Header -->
      <div class="hero-banner">
        <div class="hero-left">
          <button class="btn-back-hero" routerLink="/dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <div>
            <h1 class="hero-title">Analytics Dashboard</h1>
            <p class="hero-subtitle">Performance data & insights for your smart link</p>
          </div>
        </div>
        <button class="btn-export" (click)="exportData()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>

      <div class="loading-state" *ngIf="isLoading">
        <div class="spinner"></div><p>Loading analytics...</p>
      </div>

      <!-- ═══════ SUMMARY CARDS ═══════ -->
      <div class="stats-grid" *ngIf="!isLoading">
        <div class="stat-card gradient-blue">
          <div class="stat-icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></div>
          <div class="stat-info"><span class="stat-value">{{ summary?.totalClicks ?? 0 | number }}</span><span class="stat-label">Total Clicks</span></div>
          <div class="stat-sparkline">
            <svg viewBox="0 0 60 20" preserveAspectRatio="none"><polyline [attr.points]="miniSparkline" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-circle purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>
          <div class="stat-info"><span class="stat-value">{{ countries.length }}</span><span class="stat-label">Countries</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-circle teal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
          <div class="stat-info"><span class="stat-value">{{ devices.length }}</span><span class="stat-label">Devices</span></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-circle orange"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
          <div class="stat-info"><span class="stat-value">{{ retailers.length }}</span><span class="stat-label">Retailers</span></div>
        </div>
      </div>

      <!-- ═══════ CLICK TREND — AREA CHART ═══════ -->
      <div class="chart-card" *ngIf="!isLoading && dailyClicks.length">
        <div class="chart-card-header">
          <div>
            <h3 class="chart-title">Click Trend</h3>
            <p class="chart-subtitle">Daily clicks over the last 30 days</p>
          </div>
          <div class="chart-pills">
            <div class="pill"><span class="pill-dot brand"></span><span class="pill-text">Peak: {{ maxClicks }}</span></div>
            <div class="pill"><span class="pill-dot gray"></span><span class="pill-text">Avg: {{ avgClicks | number:'1.0-1' }}</span></div>
          </div>
        </div>
        <div class="trend-chart-wrap">
          <!-- Y-axis labels -->
          <div class="y-axis">
            <span>{{ maxClicks }}</span>
            <span>{{ (maxClicks * 0.75) | number:'1.0-0' }}</span>
            <span>{{ (maxClicks * 0.5) | number:'1.0-0' }}</span>
            <span>{{ (maxClicks * 0.25) | number:'1.0-0' }}</span>
            <span>0</span>
          </div>
          <div class="trend-chart-inner" (mousemove)="onChartHover($event)" (mouseleave)="onChartLeave()">
            <!-- Grid lines -->
            <svg class="grid-lines" viewBox="0 0 100 60" preserveAspectRatio="none">
              <line x1="0" y1="6" x2="100" y2="6" stroke="rgba(0,0,0,0.04)" stroke-width="0.25"/>
              <line x1="0" y1="19.5" x2="100" y2="19.5" stroke="rgba(0,0,0,0.04)" stroke-width="0.25"/>
              <line x1="0" y1="33" x2="100" y2="33" stroke="rgba(0,0,0,0.04)" stroke-width="0.25"/>
              <line x1="0" y1="46.5" x2="100" y2="46.5" stroke="rgba(0,0,0,0.04)" stroke-width="0.25"/>
              <line x1="0" y1="54" x2="100" y2="54" stroke="rgba(0,0,0,0.04)" stroke-width="0.25"/>
            </svg>
            <!-- Main chart -->
            <svg class="trend-svg" viewBox="0 0 100 60" preserveAspectRatio="none">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgb(28,46,74)" stop-opacity="0.18"/>
                  <stop offset="100%" stop-color="rgb(28,46,74)" stop-opacity="0.01"/>
                </linearGradient>
              </defs>
              <polyline class="area-fill" [attr.points]="trendAreaPoints"/>
              <polyline class="area-line" [attr.points]="trendLinePoints"/>
              <line *ngIf="avgClicks" class="avg-dash" x1="0" [attr.y1]="avgY" x2="100" [attr.y2]="avgY"/>
              <!-- Data dots -->
              <circle *ngFor="let pt of trendDots; let i = index" [attr.cx]="pt.x" [attr.cy]="pt.y"
                      [attr.r]="hoveredDotIndex === i ? 1.6 : 0.6"
                      [attr.fill]="hoveredDotIndex === i ? 'rgb(28,46,74)' : 'rgb(28,46,74)'"
                      [class.active-dot]="hoveredDotIndex === i"
                      class="data-dot"/>
              <!-- Hover vertical line -->
              <line *ngIf="hoveredDotIndex >= 0" class="hover-line"
                    [attr.x1]="trendDots[hoveredDotIndex]?.x" y1="6"
                    [attr.x2]="trendDots[hoveredDotIndex]?.x" y2="54"/>
            </svg>
            <!-- Tooltip -->
            <div class="chart-tooltip" *ngIf="hoveredDotIndex >= 0"
                 [style.left.px]="tooltipX" [style.top.px]="tooltipY">
              <span class="tooltip-date">{{ formatDate(dailyClicks[hoveredDotIndex]?.date || '') }}</span>
              <span class="tooltip-clicks">{{ dailyClicks[hoveredDotIndex]?.clicks }} clicks</span>
            </div>
            <div class="x-labels">
              <span *ngFor="let d of xLabels">{{ d }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════ BREAKDOWN CHARTS ═══════ -->
      <div class="charts-grid" *ngIf="!isLoading">

        <!-- COUNTRY — Horizontal Bar Chart -->
        <div class="chart-card">
          <h3 class="chart-title">Clicks by Country</h3>
          <div class="h-bar-chart" *ngIf="countries.length">
            <div class="h-bar-row" *ngFor="let item of countries; let i = index" [style.animationDelay]="(i * 0.08)+'s'">
              <div class="h-bar-label">
                <span class="country-flag">{{ getCountryFlag(item.country) }}</span>
                <span class="h-bar-name">{{ getCountryName(item.country) }}</span>
              </div>
              <div class="h-bar-track">
                <div class="h-bar-fill" [style.width]="item.percentage + '%'"
                     [style.background]="getBarColor(i)"></div>
              </div>
              <div class="h-bar-stats">
                <span class="h-bar-clicks">{{ item.clicks | number }}</span>
                <span class="h-bar-pct">{{ item.percentage }}%</span>
              </div>
            </div>
          </div>
          <div class="empty-chart" *ngIf="!countries.length"><p>No country data yet. Clicks will be tracked with geolocation.</p></div>
        </div>

        <!-- DEVICE — Donut Chart -->
        <div class="chart-card">
          <h3 class="chart-title">Clicks by Device</h3>
          <div class="donut-layout" *ngIf="devices.length">
            <div class="donut-chart">
              <svg viewBox="0 0 120 120">
                <circle *ngFor="let seg of donutSegments" class="donut-segment"
                        cx="60" cy="60" r="48"
                        [attr.stroke]="seg.color"
                        [attr.stroke-dasharray]="seg.dash"
                        [attr.stroke-dashoffset]="seg.offset"
                        fill="none" stroke-width="14" stroke-linecap="round"/>
              </svg>
              <div class="donut-center">
                <span class="donut-total">{{ summary?.totalClicks ?? 0 }}</span>
                <span class="donut-label">clicks</span>
              </div>
            </div>
            <div class="donut-legend">
              <div class="legend-item" *ngFor="let item of devices; let i = index">
                <span class="legend-dot" [style.background]="deviceColors[i % deviceColors.length]"></span>
                <span class="legend-name">{{ item.deviceType || 'Unknown' }}</span>
                <span class="legend-val">{{ item.clicks | number }} ({{ item.percentage }}%)</span>
              </div>
            </div>
          </div>
          <div class="empty-chart" *ngIf="!devices.length"><p>No device data yet.</p></div>
        </div>

        <!-- RETAILER — Vertical Bar Chart (full width) -->
        <div class="chart-card full-span">
          <h3 class="chart-title">Clicks by Retailer</h3>
          <div class="v-bar-chart" *ngIf="retailers.length">
            <div class="v-bar-col" *ngFor="let item of retailers; let i = index" [style.animationDelay]="(i * 0.1)+'s'">
              <span class="v-bar-value">{{ item.clicks }}</span>
              <div class="v-bar-track">
                <div class="v-bar-fill" [style.height]="item.percentage + '%'"
                     [style.background]="getRetailerColor(i)"></div>
              </div>
              <span class="v-bar-label">{{ item.retailer }}</span>
              <span class="v-bar-pct">{{ item.percentage }}%</span>
            </div>
          </div>
          <div class="empty-chart" *ngIf="!retailers.length"><p>No retailer data yet.</p></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; animation: fadeIn 0.5s ease-out; }

    /* Hero Banner */
    .hero-banner {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1.5rem 2rem;
      background: linear-gradient(135deg, rgb(22,38,62) 0%, rgb(38,65,108) 50%, rgba(139,92,246,0.8) 100%);
      border-radius: 22px; margin-bottom: 1.75rem; position: relative; overflow: hidden;
      box-shadow: 0 8px 32px rgba(22,38,62,0.3);
    }
    .hero-banner::before {
      content: ''; position: absolute; top: -50%; right: -10%; width: 350px; height: 350px;
      background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 65%); border-radius: 50%;
    }
    .hero-left { display: flex; align-items: center; gap: 1rem; z-index: 1; }
    .btn-back-hero {
      width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.12); border: none; border-radius: 12px; cursor: pointer; transition: all 0.2s;
    }
    .btn-back-hero svg { width: 20px; height: 20px; color: white; }
    .btn-back-hero:hover { background: rgba(255,255,255,0.2); }
    .hero-title { font-size: 1.625rem; font-weight: 700; color: white; margin: 0 0 0.2rem 0; letter-spacing: -0.02em; }
    .hero-subtitle { font-size: 0.9rem; color: rgba(255,255,255,0.6); margin: 0; }
    .btn-export {
      display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.7rem 1.25rem;
      background: white; color: rgb(22,38,62); border: none; border-radius: 12px;
      font-size: 0.8125rem; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer;
      transition: all 0.3s; box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 1; white-space: nowrap;
    }
    .btn-export:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .btn-export svg { width: 16px; height: 16px; }

    /* ═══════ STATS GRID ═══════ */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; margin-bottom: 1.75rem; }
    .stat-card {
      display: flex; align-items: center; gap: 1rem; padding: 1.375rem 1.5rem;
      background: white; border: 1px solid var(--border-light); border-radius: 18px;
      box-shadow: var(--shadow-sm); transition: all 0.3s; position: relative; overflow: hidden;
    }
    .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
    .stat-card.gradient-blue {
      background: linear-gradient(135deg, rgb(22,38,62), rgb(38,65,108)); border: none; color: white;
    }
    .stat-card.gradient-blue .stat-label { color: rgba(255,255,255,0.7); }
    .stat-sparkline { position: absolute; right: 1rem; bottom: 0.75rem; width: 60px; height: 20px; opacity: 0.6; }
    .stat-sparkline svg { width: 100%; height: 100%; }
    .stat-icon-circle {
      width: 48px; height: 48px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .stat-icon-circle svg { width: 22px; height: 22px; }
    .stat-card.gradient-blue .stat-icon-circle { background: rgba(255,255,255,0.2); color: white; }
    .stat-icon-circle.purple { background: rgba(28,46,74,0.08); color: rgb(28,46,74); }
    .stat-icon-circle.teal { background: rgba(20,184,166,0.1); color: #14b8a6; }
    .stat-icon-circle.orange { background: rgba(245,158,11,0.1); color: #f59e0b; }
    .stat-info { display: flex; flex-direction: column; }
    .stat-value { font-size: 1.5rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; }
    .stat-label { font-size: 0.6875rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.125rem; }

    /* ═══════ CHART CARD ═══════ */
    .chart-card {
      background: white; border: 1px solid var(--border-light); border-radius: 20px;
      padding: 1.75rem; box-shadow: var(--shadow-sm); margin-bottom: 1.5rem;
      transition: all 0.3s;
    }
    .chart-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    .chart-card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem; }
    .chart-title { font-size: 1.0625rem; font-weight: 700; color: var(--text-primary); margin: 0 0 0.2rem 0; }
    .chart-subtitle { font-size: 0.8rem; color: var(--text-muted); margin: 0; }
    .chart-pills { display: flex; gap: 0.5rem; }
    .pill {
      display: flex; align-items: center; gap: 0.375rem; padding: 0.35rem 0.75rem;
      background: var(--background); border-radius: 999px; border: 1px solid var(--border-light);
    }
    .pill-dot { width: 8px; height: 8px; border-radius: 50%; }
    .pill-dot.brand { background: rgb(28,46,74); }
    .pill-dot.gray { background: #94a3b8; }
    .pill-text { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); }

    /* ═══════ TREND AREA CHART ═══════ */
    .trend-chart-wrap { display: flex; gap: 0.5rem; }
    .y-axis {
      display: flex; flex-direction: column; justify-content: space-between; text-align: right;
      font-size: 0.625rem; color: var(--text-muted); font-weight: 500; width: 32px; padding: 0 0.25rem 1.5rem 0;
    }
    .trend-chart-inner { flex: 1; position: relative; }
    .grid-lines, .trend-svg { width: 100%; height: 200px; position: absolute; top: 0; left: 0; }
    .trend-svg { z-index: 1; }
    .trend-chart-inner { height: 200px; position: relative; }
    .area-fill { fill: url(#areaGrad); stroke: none; }
    .area-line { fill: none; stroke: rgb(28,46,74); stroke-width: 0.8; stroke-linejoin: round; stroke-linecap: round; }
    .avg-dash { stroke: #94a3b8; stroke-dasharray: 3 3; stroke-width: 0.5; opacity: 0.5; }
    .data-dot { transition: all 0.15s ease; }
    .data-dot.active-dot { filter: drop-shadow(0 0 3px rgba(28,46,74,0.4)); }
    .hover-line { stroke: rgba(28,46,74,0.15); stroke-width: 0.3; stroke-dasharray: 2 2; }
    .chart-tooltip {
      position: absolute; pointer-events: none; z-index: 10;
      background: rgb(28,46,74); color: white; padding: 0.4rem 0.75rem;
      border-radius: 8px; font-size: 0.75rem; white-space: nowrap;
      box-shadow: 0 4px 16px rgba(28,46,74,0.3); transform: translate(-50%, -110%);
      display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
    }
    .chart-tooltip::after {
      content: ''; position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%);
      border-left: 5px solid transparent; border-right: 5px solid transparent;
      border-top: 5px solid rgb(28,46,74);
    }
    .tooltip-date { font-weight: 500; font-size: 0.6875rem; opacity: 0.8; }
    .tooltip-clicks { font-weight: 700; font-size: 0.8125rem; }
    .x-labels {
      display: flex; justify-content: space-between; font-size: 0.625rem; color: var(--text-muted);
      margin-top: 0.5rem; position: absolute; bottom: -1.5rem; left: 0; right: 0;
    }
    .trend-chart-inner { margin-bottom: 1.5rem; cursor: crosshair; }

    /* ═══════ CHARTS GRID ═══════ */
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .charts-grid .chart-card { margin-bottom: 0; }
    .full-span { grid-column: 1 / -1; }

    /* ═══════ HORIZONTAL BAR CHART (Country) ═══════ */
    .h-bar-chart { display: flex; flex-direction: column; gap: 0.875rem; }
    .h-bar-row { display: flex; align-items: center; gap: 0.75rem; opacity: 0; animation: slideInLeft 0.4s ease-out forwards; }
    .h-bar-label { display: flex; align-items: center; gap: 0.5rem; min-width: 120px; }
    .country-flag { font-size: 1.25rem; }
    .h-bar-name { font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); }
    .h-bar-track { flex: 1; height: 10px; background: var(--background); border-radius: 100px; overflow: hidden; }
    .h-bar-fill { height: 100%; border-radius: 100px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
    .h-bar-stats { display: flex; gap: 0.5rem; min-width: 90px; justify-content: flex-end; }
    .h-bar-clicks { font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); }
    .h-bar-pct { font-size: 0.75rem; font-weight: 500; color: var(--text-muted); }

    /* ═══════ DONUT CHART (Device) ═══════ */
    .donut-layout { display: flex; align-items: center; gap: 2rem; }
    .donut-chart { position: relative; width: 160px; height: 160px; flex-shrink: 0; }
    .donut-chart svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .donut-segment { transition: stroke-dasharray 0.8s ease; }
    .donut-center {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .donut-total { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1; }
    .donut-label { font-size: 0.6875rem; color: var(--text-muted); font-weight: 500; }
    .donut-legend { display: flex; flex-direction: column; gap: 0.75rem; flex: 1; }
    .legend-item { display: flex; align-items: center; gap: 0.625rem; }
    .legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
    .legend-name { font-size: 0.8125rem; font-weight: 600; color: var(--text-primary); flex: 1; text-transform: capitalize; }
    .legend-val { font-size: 0.8125rem; color: var(--text-muted); font-weight: 500; }

    /* ═══════ VERTICAL BAR CHART (Retailer) ═══════ */
    .v-bar-chart { display: flex; align-items: flex-end; gap: 1.5rem; padding: 1rem 0; justify-content: center; }
    .v-bar-col {
      display: flex; flex-direction: column; align-items: center; gap: 0.375rem; min-width: 60px; flex: 1; max-width: 100px;
      opacity: 0; animation: growUp 0.5s ease-out forwards;
    }
    .v-bar-value { font-size: 0.8125rem; font-weight: 700; color: var(--text-primary); }
    .v-bar-track { width: 100%; height: 140px; background: var(--background); border-radius: 10px; overflow: hidden; display: flex; align-items: flex-end; }
    .v-bar-fill { width: 100%; border-radius: 10px; transition: height 0.8s cubic-bezier(0.4,0,0.2,1); min-height: 4px; }
    .v-bar-label { font-size: 0.6875rem; font-weight: 600; color: var(--text-primary); text-align: center; line-height: 1.2; max-width: 80px; word-break: break-word; }
    .v-bar-pct { font-size: 0.625rem; color: var(--text-muted); font-weight: 500; }

    /* Empty & Loading */
    .empty-chart { text-align: center; padding: 2.5rem 1rem; }
    .empty-chart p { color: var(--text-muted); font-size: 0.875rem; margin: 0; }
    .loading-state { display: flex; flex-direction: column; align-items: center; padding: 4rem; color: var(--text-muted); }
    .spinner { width: 32px; height: 32px; border: 3px solid var(--border-light); border-top-color: var(--accent-blue); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem; }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideInLeft { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes growUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: 1fr; }
      .charts-grid { grid-template-columns: 1fr; }
      .donut-layout { flex-direction: column; }
      .hero-banner { flex-direction: column; text-align: center; gap: 1rem; }
    }
  `]
})
export class AnalyticsComponent implements OnInit {
  Math = Math;
  linkId = '';
  isLoading = true;
  summary: AnalyticsSummary | null = null;
  countries: AnalyticsByCountry[] = [];
  devices: AnalyticsByDevice[] = [];
  retailers: AnalyticsByRetailer[] = [];
  dailyClicks: AnalyticsByDay[] = [];
  maxClicks = 1;
  avgClicks = 0;
  trendLinePoints = '';
  trendAreaPoints = '';
  avgY = 0;
  trendDots: { x: number; y: number }[] = [];
  miniSparkline = '';
  xLabels: string[] = [];

  // Hover tooltip state
  hoveredDotIndex = -1;
  tooltipX = 0;
  tooltipY = 0;

  // Donut chart
  donutSegments: { color: string; dash: string; offset: number }[] = [];
  deviceColors = ['rgb(28,46,74)', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444'];

  // Country bar colors
  barColors = [
    'linear-gradient(90deg, rgb(28,46,74), rgb(48,72,112))',
    'linear-gradient(90deg, #8b5cf6, #a78bfa)',
    'linear-gradient(90deg, #14b8a6, #5eead4)',
    'linear-gradient(90deg, #f59e0b, #fbbf24)',
    'linear-gradient(90deg, #ef4444, #f87171)',
    'linear-gradient(90deg, #ec4899, #f472b6)',
    'linear-gradient(90deg, #6366f1, #818cf8)',
  ];

  retailerColors = ['rgb(28,46,74)', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#10b981'];

  isUniversal = false;

  constructor(
    private route: ActivatedRoute,
    private smartLinkService: SmartLinkService,
    private universalLinkService: UniversalLinkService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.linkId = this.route.snapshot.paramMap.get('id') || '';
    this.isUniversal = this.route.snapshot.data['linkType'] === 'universal';
    if (!this.linkId) return;

    this.cdr.detectChanges();
    let completed = 0;
    const checkDone = () => {
      completed++;
      if (completed >= 5) {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    };

    if (this.isUniversal) {
      this.universalLinkService.getAnalyticsSummary(this.linkId).subscribe({
        next: (d: { totalClicks: number; from?: string; to?: string }) => {
          this.summary = { smartLinkId: this.linkId, totalClicks: d.totalClicks, from: d.from, to: d.to };
          checkDone();
        },
        error: () => checkDone()
      });
    } else {
      this.smartLinkService.getAnalyticsSummary(this.linkId).subscribe({
        next: (d) => { this.summary = d; checkDone(); },
        error: () => checkDone()
      });
    }

    const country$ = this.isUniversal
      ? this.universalLinkService.getAnalyticsByCountry(this.linkId)
      : this.smartLinkService.getAnalyticsByCountry(this.linkId);
    country$.subscribe({ next: d => { this.countries = d; checkDone(); }, error: () => checkDone() });

    const device$ = this.isUniversal
      ? this.universalLinkService.getAnalyticsByDevice(this.linkId)
      : this.smartLinkService.getAnalyticsByDevice(this.linkId);
    device$.subscribe({
      next: d => { this.devices = d; this.buildDonut(); checkDone(); },
      error: () => checkDone()
    });

    const retailer$ = this.isUniversal
      ? this.universalLinkService.getAnalyticsByRetailer(this.linkId)
      : this.smartLinkService.getAnalyticsByRetailer(this.linkId);
    retailer$.subscribe({ next: d => { this.retailers = d; checkDone(); }, error: () => checkDone() });

    const day$ = this.isUniversal
      ? this.universalLinkService.getAnalyticsByDay(this.linkId)
      : this.smartLinkService.getAnalyticsByDay(this.linkId);
    day$.subscribe({
      next: d => {
        this.dailyClicks = d;
        this.maxClicks = Math.max(1, ...d.map(x => x.clicks));
        this.avgClicks = d.length ? d.reduce((s, x) => s + x.clicks, 0) / d.length : 0;
        this.rebuildTrendPaths();
        this.buildSparkline();
        this.buildXLabels();
        checkDone();
      },
      error: () => checkDone()
    });
  }

  private rebuildTrendPaths() {
    if (!this.dailyClicks.length) return;
    const H = 60, TP = 6, BP = 6, UH = H - TP - BP;
    const count = this.dailyClicks.length;
    const stepX = count > 1 ? 100 / (count - 1) : 0;
    const linePts: string[] = [];
    const areaPts: string[] = [];
    this.trendDots = [];

    this.dailyClicks.forEach((p, i) => {
      const x = count > 1 ? i * stepX : 50;
      const y = Math.max(TP, Math.min(H - BP, H - BP - (p.clicks / this.maxClicks) * UH));
      linePts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      areaPts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      this.trendDots.push({ x: +x.toFixed(2), y: +y.toFixed(2) });
    });

    this.trendAreaPoints = `0,${H - BP} ${areaPts.join(' ')} 100,${H - BP}`;
    this.trendLinePoints = linePts.join(' ');
    this.avgY = Math.max(TP, Math.min(H - BP, H - BP - (this.avgClicks / this.maxClicks) * UH));
  }

  private buildSparkline() {
    if (!this.dailyClicks.length) return;
    const pts = this.dailyClicks.map((d, i) => {
      const x = this.dailyClicks.length > 1 ? (i / (this.dailyClicks.length - 1)) * 60 : 30;
      const y = 20 - (d.clicks / this.maxClicks) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    this.miniSparkline = pts.join(' ');
  }

  private buildXLabels() {
    if (!this.dailyClicks.length) return;
    // Show more dates — every 3rd date for dense x-axis
    const step = Math.max(1, Math.floor(this.dailyClicks.length / 10));
    this.xLabels = this.dailyClicks.filter((_, i) => i % step === 0 || i === this.dailyClicks.length - 1)
      .map(d => this.formatDate(d.date));
  }

  // ─── Hover tooltip handlers ───
  onChartHover(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    if (!target || !this.dailyClicks.length) return;
    const rect = target.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const pct = relX / rect.width;
    const idx = Math.round(pct * (this.dailyClicks.length - 1));
    this.hoveredDotIndex = Math.max(0, Math.min(this.dailyClicks.length - 1, idx));

    // Position tooltip at the data dot's screen position
    const dot = this.trendDots[this.hoveredDotIndex];
    if (dot) {
      this.tooltipX = (dot.x / 100) * rect.width;
      // Map SVG y (viewBox 0-60) to pixel y within the 200px chart
      this.tooltipY = (dot.y / 60) * rect.height;
    }
  }

  onChartLeave() {
    this.hoveredDotIndex = -1;
  }

  private buildDonut() {
    if (!this.devices.length) return;
    const circumference = 2 * Math.PI * 48;
    let offset = 0;
    this.donutSegments = this.devices.map((d, i) => {
      const pct = d.percentage / 100;
      const dash = `${pct * circumference} ${circumference}`;
      const seg = { color: this.deviceColors[i % this.deviceColors.length], dash, offset: -offset };
      offset += pct * circumference;
      return seg;
    });
  }

  getBarColor(i: number): string { return this.barColors[i % this.barColors.length]; }
  getRetailerColor(i: number): string { return this.retailerColors[i % this.retailerColors.length]; }

  getCountryFlag(code: string): string {
    if (!code || code.length !== 2) return '🌍';
    const c = code.toUpperCase();
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
  }

  getCountryName(code: string): string {
    const names: Record<string, string> = {
      US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
      DE: 'Germany', FR: 'France', IN: 'India', BR: 'Brazil', PK: 'Pakistan',
      JP: 'Japan', CN: 'China', KR: 'South Korea', MX: 'Mexico', IT: 'Italy',
      ES: 'Spain', NL: 'Netherlands', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
      FI: 'Finland', PL: 'Poland', RU: 'Russia', ZA: 'South Africa', AE: 'UAE',
      SG: 'Singapore', NZ: 'New Zealand', IE: 'Ireland', PT: 'Portugal', TR: 'Turkey'
    };
    return names[code?.toUpperCase()] || code || 'Unknown';
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
  }

  exportData() {
    let csv = 'Metric,Value\n';
    csv += `Total Clicks,${this.summary?.totalClicks ?? 0}\n`;
    csv += `Countries,${this.countries.length}\n`;
    csv += `Devices,${this.devices.length}\n\n`;
    csv += 'Date,Clicks\n';
    for (const d of this.dailyClicks) csv += `${d.date},${d.clicks}\n`;
    csv += '\nCountry,Clicks,Percentage\n';
    for (const c of this.countries) csv += `${c.country},${c.clicks},${c.percentage}\n`;
    csv += '\nDevice,Clicks,Percentage\n';
    for (const d of this.devices) csv += `${d.deviceType},${d.clicks},${d.percentage}\n`;
    csv += '\nRetailer,Clicks,Percentage\n';
    for (const r of this.retailers) csv += `${r.retailer},${r.clicks},${r.percentage}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${this.linkId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

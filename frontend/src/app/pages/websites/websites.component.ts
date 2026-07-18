import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize, catchError } from 'rxjs/operators';
import { of, interval, Subscription } from 'rxjs';
import { ActiveSiteService } from '../../services/active-site.service';
import { TrafficApiService } from '../../services/traffic-api.service';
import type { SiteDto, LiveStatsDto, VerifyResultDto } from '../../models/analytics.types';

@Component({
  selector: 'app-websites',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Connect Websites</h1>
          <p class="page-sub">Add any website or storefront and start seeing traffic, conversions, funnels, and heatmaps in minutes.</p>
        </div>
        <button class="btn-primary" (click)="openWizard()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Add Website
        </button>
      </div>

      <!-- Quick Start Card -->
      <div class="quick-start-card animate-in">
        <div class="quick-start-header">
          <div>
            <p class="quick-start-label">Quick start</p>
            <h2 class="quick-start-title">Connect your first website</h2>
          </div>
          <span class="quick-start-pill">Unlimited websites</span>
        </div>
        <p class="quick-start-copy">Connect WordPress, Shopify, Wix, Squarespace, or any custom storefront and track your book sales and landing pages seamlessly.</p>
        <button class="btn-primary" style="margin-top: 8px; justify-content: center; width: fit-content;" (click)="openWizard()">
          Launch Connection Setup Wizard
        </button>
      </div>

      <!-- Sites List -->
      @if (loading()) {
        <div class="empty-state">
          <div class="spinner"></div>
          <p>Loading your websites…</p>
        </div>
      } @else if (sites().length === 0) {
        <div class="empty-state">
          <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
            <circle cx="32" cy="32" r="28"/>
            <path d="M4 32h56M32 4a44 44 0 0 1 0 56M32 4a44 44 0 0 0 0 56"/>
          </svg>
          <p>No websites yet. Click <strong>Add Website</strong> to get started.</p>
        </div>
      } @else {
        <div class="sites-grid">
          @for (site of sites(); track site.siteId) {
            <div class="site-card" [class.site-card--active]="activeSiteId() === site.siteId">

              <!-- Card Header -->
              <div class="site-card-header">
                <div class="site-favicon">
                  <img
                    [src]="'https://www.google.com/s2/favicons?domain=' + site.domain + '&sz=32'"
                    [alt]="site.domain"
                    width="20" height="20"
                    (error)="onFaviconError($event)"
                  />
                </div>
                <div class="site-info">
                  <div class="site-domain">{{ site.domain }}</div>
                  <div class="site-platform-badge">{{ getPlatformName(site.platform) }}</div>
                </div>
                <div class="site-actions">
                  @if (activeSiteId() !== site.siteId) {
                    <button class="btn-sm btn-outline" (click)="selectSite(site)">Select</button>
                  } @else {
                    <span class="active-badge">Active</span>
                  }
                </div>
              </div>

              <!-- Tracked Link -->
              <div class="tracked-link-row">
                <span class="tracked-link-label">Tracked link</span>
                <a
                  class="tracked-link"
                  [href]="'https://' + site.domain"
                  target="_blank"
                  rel="noopener"
                  (click)="onTrackedLinkClick($event, site)"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  https://{{ site.domain }}
                </a>
                <span class="click-hint">Test PageView</span>
              </div>

              <!-- Live Stats & Status -->
              <div class="live-stats-row">
                <div class="live-dot-wrap">
                  @if (liveMap()[site.siteId]?.todayEvents ?? 0 > 0) {
                    <span class="live-dot dot--active"></span>
                    <span class="live-label text--active">Active — receiving data</span>
                  } @else {
                    <span class="live-dot dot--waiting"></span>
                    <span class="live-label text--waiting">Connected — waiting for first data</span>
                  }
                </div>
                @if (liveMap()[site.siteId]; as stats) {
                  <div class="stats-chips">
                    <div class="chip chip--green">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {{ stats.activeVisitors }} active
                    </div>
                    <div class="chip chip--blue">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      {{ stats.todayPageViews }} views
                    </div>
                    <div class="chip chip--purple">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
                      {{ stats.todayClicks }} clicks
                    </div>
                    <div class="chip chip--orange">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                      {{ stats.engagementRate }}% engaged
                    </div>
                    <div class="chip chip--teal">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {{ stats.todayConversions }} conv.
                    </div>
                  </div>
                } @else {
                  <div class="stats-loading">
                    <div class="mini-spinner"></div>
                    <span>Loading stats…</span>
                  </div>
                }
              </div>

              <!-- View Analytics Button -->
              <div class="card-footer">
                <button class="btn-sm btn-primary-sm" (click)="viewAnalytics(site)">
                  View Analytics →
                </button>
                <span class="events-today">
                  {{ liveMap()[site.siteId]?.todayEvents ?? 0 }} events today
                </span>
              </div>

            </div>
          }
        </div>
      }

      <!-- Redesigned 4-Step Connection Wizard Modal -->
      @if (wizardVisible()) {
        <div class="wizard-overlay fade-in" (click)="closeWizard()">
          <div class="wizard-modal scale-in" (click)="$event.stopPropagation()">
            
            <!-- Header -->
            <div class="wizard-header-row">
              <div>
                <span class="wizard-step-badge">Step {{ wizardStep() }} of 4</span>
                <h2 class="wizard-modal-title">
                  @if (wizardStep() === 1) { Let's register your website }
                  @else if (wizardStep() === 2) { What platform do you use? }
                  @else if (wizardStep() === 3) { Install your tracking code }
                  @else if (wizardStep() === 4) { Verify your connection }
                </h2>
              </div>
              <button class="btn-close" (click)="closeWizard()">&times;</button>
            </div>

            <!-- Progress bar -->
            <div class="wizard-progress-bar">
              <div class="progress-fill" [style.width.%]="(wizardStep() / 4) * 100"></div>
            </div>

            <!-- Content Area (Scrollable) -->
            <div class="wizard-body">
              
              <!-- STEP 1: Website Details -->
              @if (wizardStep() === 1) {
                <div class="wizard-step-content animate-slide">
                  <p class="wizard-welcome-copy">Let's set up tracking for your website. You'll only need to do this once per site.</p>
                  
                  <div class="wizard-row">
                    <!-- Left: Form -->
                    <div class="wizard-main-col">
                      <div class="form-group-relative">
                        <label class="wizard-label">Website Name</label>
                        <input 
                          type="text" 
                          class="wizard-input" 
                          [(ngModel)]="wizardSiteName" 
                          placeholder="e.g. My Author Site" 
                        />
                      </div>

                      <div class="form-group-relative" id="url-input-container">
                        <label class="wizard-label">Website URL</label>
                        <div class="input-wrapper">
                          <input 
                            type="url" 
                            class="wizard-input" 
                            [(ngModel)]="wizardUrl" 
                            (input)="validateUrl()"
                            placeholder="https://myauthorwebsite.com" 
                          />
                          @if (urlValid()) {
                            <span class="check-icon">✓</span>
                          }
                        </div>
                        @if (detectingPlatform()) {
                          <div class="auto-detect-loader">
                            <div class="mini-spinner"></div>
                            <span>Checking platform...</span>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Right: Inline Speech bubble pointer Step 1 -->
                    <div class="wizard-side-col">
                      <div class="guided-pointer-inline pointer-arrow-left">
                        <div class="pointer-bubble">
                          <span class="pointer-badge">Step 1 of 4</span>
                          <strong>Tell Us About Your Website</strong>
                          <p>Enter your website name and URL. We'll automatically validate it and check if it uses WordPress, Shopify, or Wix.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="wizard-footer">
                    <button class="btn-ghost" (click)="closeWizard()">Cancel</button>
                    <button 
                      class="btn-primary" 
                      [disabled]="!urlValid()" 
                      (click)="goToStep2()"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              }

              <!-- STEP 2: Platform Selection -->
              @if (wizardStep() === 2) {
                <div class="wizard-step-content animate-slide" id="platform-grid-container">
                  <p class="wizard-welcome-copy">Select the platform your website is built on so we can customize your copy-paste instructions.</p>
                  
                  <div class="wizard-row">
                    <!-- Left: Platform Grid -->
                    <div class="wizard-main-col">
                      <div class="platform-grid">
                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 1"
                          (click)="selectedPlatform.set(1)"
                        >
                          <div class="platform-icon wp-icon">W</div>
                          <span class="platform-label">WordPress</span>
                        </button>
                        
                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 2"
                          (click)="selectedPlatform.set(2)"
                        >
                          <div class="platform-icon shopify-icon">S</div>
                          <span class="platform-label">Shopify</span>
                        </button>

                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 3"
                          (click)="selectedPlatform.set(3)"
                        >
                          <div class="platform-icon wix-icon">WiX</div>
                          <span class="platform-label">Wix</span>
                        </button>

                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 5"
                          (click)="selectedPlatform.set(5)"
                        >
                          <div class="platform-icon sq-icon">SQ</div>
                          <span class="platform-label">Squarespace</span>
                        </button>

                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 6"
                          (click)="selectedPlatform.set(6)"
                        >
                          <div class="platform-icon vercel-icon">▲</div>
                          <span class="platform-label">Vercel</span>
                        </button>

                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 7"
                          (click)="selectedPlatform.set(7)"
                        >
                          <div class="platform-icon railway-icon">🛤</div>
                          <span class="platform-label">Railway</span>
                        </button>

                        <button 
                          class="platform-card" 
                          [class.platform-card--selected]="selectedPlatform() === 4"
                          (click)="selectedPlatform.set(4)"
                        >
                          <div class="platform-icon other-icon">&lt;/&gt;</div>
                          <span class="platform-label">Custom / Other</span>
                        </button>
                      </div>
                    </div>

                    <!-- Right: Inline Speech bubble pointer Step 2 -->
                    <div class="wizard-side-col">
                      <div class="guided-pointer-inline pointer-arrow-left">
                        <div class="pointer-bubble">
                          <span class="pointer-badge">Step 2 of 4</span>
                          <strong>Select Your Platform</strong>
                          <p>Select your platform. We auto-selected this based on your website's source code, but you can change it if we guessed wrong!</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  @if (addError()) {
                    <p class="form-error">{{ addError() }}</p>
                  }

                  <div class="wizard-footer">
                    <button class="btn-ghost" (click)="wizardStep.set(1)">Back</button>
                    <button 
                      class="btn-primary" 
                      [disabled]="adding()"
                      (click)="goToStep3()"
                    >
                      {{ adding() ? 'Registering...' : 'Continue' }}
                    </button>
                  </div>
                </div>
              }

              <!-- STEP 3: Snippet Installation -->
              @if (wizardStep() === 3 && createdSite()) {
                <div class="wizard-step-content animate-slide">
                  <p class="wizard-welcome-copy">Copy the code snippet below and paste it onto your site. We've automatically embedded your tracking key.</p>

                  <div class="installation-panel">
                    <!-- Left: Instructions & Yellow Help Bubble Inline -->
                    <div class="instruction-col">
                      
                      <div class="guided-pointer-inline pointer-arrow-right">
                        <div class="pointer-bubble">
                          <span class="pointer-badge">Step 3 of 4</span>
                          <strong>Copy & Paste Code</strong>
                          <p>Click "Copy Code" to copy the pre-configured tracking snippet. We've already embedded your custom key, so no coding is required!</p>
                        </div>
                      </div>

                      <!-- Framework selector for Vercel, Railway, Other -->
                      @if (selectedPlatform() === 4 || selectedPlatform() === 6 || selectedPlatform() === 7) {
                        <div class="framework-selector" style="margin-top: 10px;">
                          <button 
                            class="btn-fw" 
                            [class.btn-fw--active]="selectedFramework() === 'html'"
                            (click)="selectedFramework.set('html')"
                          >
                            Static HTML
                          </button>
                          <button 
                            class="btn-fw" 
                            [class.btn-fw--active]="selectedFramework() === 'react'"
                            (click)="selectedFramework.set('react')"
                          >
                            React / Next.js (JSX/TSX)
                          </button>
                        </div>
                      }

                      <h4 class="instruction-subtitle" style="margin-top: 10px;">How to install:</h4>
                      
                      @if (selectedPlatform() === 1) {
                        <!-- WordPress -->
                        <ol class="step-list">
                          <li>Log in to your <strong>WordPress Dashboard</strong>.</li>
                          <li>Go to <strong>Appearance > Theme File Editor</strong>.</li>
                          <li>Open the <strong>header.php</strong> file on the right side.</li>
                          <li>Paste the snippet just before the closing <code>&lt;/head&gt;</code> tag.</li>
                          <li>Click <strong>Update File</strong> to save.</li>
                        </ol>
                      } @else if (selectedPlatform() === 2) {
                        <!-- Shopify -->
                        <ol class="step-list">
                          <li>Go to your <strong>Shopify Admin</strong> dashboard.</li>
                          <li>Click <strong>Online Store > Themes</strong>, and click the three dots button next to Customize, then choose <strong>Edit Code</strong>.</li>
                          <li>Open the <strong>theme.liquid</strong> file.</li>
                          <li>Paste the snippet just before the closing <code>&lt;/head&gt;</code> tag.</li>
                          <li>Click <strong>Save</strong> at the top right.</li>
                        </ol>
                      } @else if (selectedPlatform() === 3) {
                        <!-- Wix -->
                        <ol class="step-list">
                          <li>Log in to your <strong>Wix Site Dashboard</strong>.</li>
                          <li>Go to <strong>Settings</strong> and click on <strong>Custom Code</strong>.</li>
                          <li>Click <strong>Add Code</strong> at the top right.</li>
                          <li>Paste the code, select <strong>Head</strong> placement, and apply it to **All Pages**.</li>
                          <li>Click <strong>Apply</strong>.</li>
                        </ol>
                      } @else if (selectedPlatform() === 5) {
                        <!-- Squarespace -->
                        <ol class="step-list">
                          <li>Log in to your <strong>Squarespace Dashboard</strong> and select your site.</li>
                          <li>Navigate to <strong>Settings > Developer Tools > Code Injection</strong>.</li>
                          <li>Paste the code into the <strong>Header</strong> text area.</li>
                          <li>Click <strong>Save</strong> at the top left of the screen.</li>
                        </ol>
                      } @else if (selectedPlatform() === 6) {
                        <!-- Vercel -->
                        @if (selectedFramework() === 'react') {
                          <ol class="step-list">
                            <li>Create a <code>useEffect</code> hook in your React root component (e.g. <code>App.tsx</code> or <code>main.tsx</code>) or layouts.</li>
                            <li>Copy and paste the dynamic script-loader code on the right.</li>
                            <li>Commit and push your changes to your git repository to trigger a <strong>Vercel Deployment</strong>.</li>
                          </ol>
                        } @else {
                          <ol class="step-list">
                            <li>Open your website's main HTML file (usually <code>public/index.html</code> or <code>pages/index.html</code>).</li>
                            <li>Paste the snippet just before the closing <code>&lt;/head&gt;</code> tag.</li>
                            <li>Commit and push to trigger an automated **Vercel Deploy**.</li>
                          </ol>
                        }
                      } @else if (selectedPlatform() === 7) {
                        <!-- Railway -->
                        @if (selectedFramework() === 'react') {
                          <ol class="step-list">
                            <li>Insert a <code>useEffect</code> script loader in your main React setup (e.g. <code>App.tsx</code> or <code>main.tsx</code>).</li>
                            <li>Copy and paste the TSX hook code on the right.</li>
                            <li>Commit and deploy the changes to **Railway** via GitHub push or the Railway CLI.</li>
                          </ol>
                        } @else {
                          <ol class="step-list">
                            <li>Locate your project's main <code>index.html</code> file.</li>
                            <li>Paste the code block inside the <code>&lt;head&gt;</code> section.</li>
                            <li>Commit and redeploy the changes on **Railway**.</li>
                          </ol>
                        }
                      } @else {
                        <!-- Custom / Other -->
                        @if (selectedFramework() === 'react') {
                          <ol class="step-list">
                            <li>Create a <code>useEffect</code> hook in your main React setup (e.g. <code>App.tsx</code>, <code>index.tsx</code>, or <code>main.tsx</code>).</li>
                            <li>Paste the TSX loader code shown on the right.</li>
                            <li>Build and publish your custom Single Page App (SPA) changes.</li>
                          </ol>
                        } @else {
                          <ol class="step-list">
                            <li>Open your website's main HTML template or index page.</li>
                            <li>Locate the <code>&lt;head&gt;</code> section.</li>
                            <li>Paste the snippet just before the closing <code>&lt;/head&gt;</code> tag.</li>
                            <li>Deploy the changes to your server or hosting provider.</li>
                          </ol>
                        }
                      }
                    </div>

                    <!-- Right: Code block & CSS mockup visualization -->
                    <div class="visual-col">
                      <!-- Code Block & Copy Button -->
                      <div class="code-block-container" id="copy-code-container" style="margin-bottom: 14px;">
                        <pre class="snippet-code"><code>{{ 
                          ((selectedPlatform() === 4 || selectedPlatform() === 6 || selectedPlatform() === 7) && selectedFramework() === 'react') 
                            ? getReactSnippet(createdSite()!) 
                            : getSnippetForSite(createdSite()!) 
                        }}</code></pre>
                        <button class="btn-primary btn-copy" (click)="copyWizardSnippet()">
                          {{ copiedSnippet() ? '✓ Copied' : 'Copy Code' }}
                        </button>
                      </div>

                      <div class="autotrack-note">
                        <strong>Paste it once — it tracks your whole site.</strong>
                        <ul>
                          <li>Works with React / Next.js and any single-page app: every page change is tracked automatically.</li>
                          <li>Cart / Buy / Checkout clicks are tracked as intent — <em>not</em> as conversions.</li>
                          <li>A conversion is counted when the buyer reaches <code>/order/:id</code>, a thank-you page, or you call <code>tracker.track('order_completed', &#123; orderId, value &#125;)</code>.</li>
                          <li>After login call <code>tracker.identify('buyer_id')</code> (or rely on auto-detect for Supabase sessions) so different accounts count as different visitors. Call <code>tracker.reset()</code> on logout.</li>
                        </ul>
                        @if (isLocalhostCollect()) {
                          <p class="localhost-warn">
                            <strong>Mobile / other devices will not track</strong> while the snippet points at
                            <code>localhost</code>. On a phone, localhost is the phone itself — not your PC.
                            For phone testing on the same Wi‑Fi, replace <code>localhost</code> with your computer’s
                            LAN IP (e.g. <code>http://192.168.x.x:4200</code>) in both the script <code>src</code>
                            and <code>endpoint</code>, and run the dashboard/API so they listen on the network.
                            For a live site (Vercel/Netlify), use a public HTTPS URL for the tracker and collect API.
                          </p>
                        }
                      </div>

                      <h4 class="instruction-subtitle" style="margin-bottom: 8px;">Visual Diagram:</h4>
                      
                      @if (selectedPlatform() === 1) {
                        <!-- WordPress Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar">
                            <div class="mockup-side-item">Dashboard</div>
                            <div class="mockup-side-item active">Appearance</div>
                            <div class="mockup-sub-item active">Editor</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">header.php</div>
                            <div class="editor-content">
                              <span class="c-tag">&lt;head&gt;</span>
                              <span class="c-code highlight">&lt;script src=".../scribe-count..."&gt;&lt;/script&gt;</span>
                              <span class="c-tag">&lt;/head&gt;</span>
                            </div>
                            <div class="editor-btn">Update File</div>
                          </div>
                        </div>
                      } @else if (selectedPlatform() === 2) {
                        <!-- Shopify Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar bg--shopify">
                            <div class="mockup-side-item">Online Store</div>
                            <div class="mockup-sub-item active">Edit Code</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">theme.liquid</div>
                            <div class="editor-content">
                              <span class="c-tag">&lt;head&gt;</span>
                              <span class="c-code highlight">&lt;script src=".../scribe-count..."&gt;&lt;/script&gt;</span>
                              <span class="c-tag">&lt;/head&gt;</span>
                            </div>
                            <div class="editor-btn btn--shopify">Save</div>
                          </div>
                        </div>
                      } @else if (selectedPlatform() === 3) {
                        <!-- Wix Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar bg--wix">
                            <div class="mockup-side-item">Settings</div>
                            <div class="mockup-sub-item active">Custom Code</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">Custom Code</div>
                            <div class="editor-content">
                              <div class="wix-box">
                                <span class="c-tag">Head placement</span>
                              </div>
                            </div>
                            <div class="editor-btn btn--wix">Apply</div>
                          </div>
                        </div>
                      } @else if (selectedPlatform() === 5) {
                        <!-- Squarespace Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar bg--squarespace">
                            <div class="mockup-side-item">Settings</div>
                            <div class="mockup-sub-item active">Code Injection</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">Header Box</div>
                            <div class="editor-content">
                              <div class="squarespace-box">
                                <span class="c-code highlight">&lt;script src="..."&gt;&lt;/script&gt;</span>
                              </div>
                            </div>
                            <div class="editor-btn btn--squarespace">Save</div>
                          </div>
                        </div>
                      } @else if ((selectedPlatform() === 4 || selectedPlatform() === 6 || selectedPlatform() === 7) && selectedFramework() === 'react') {
                        <!-- React/TSX Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar bg--react">
                            <div class="mockup-side-item active">src/</div>
                            <div class="mockup-sub-item active">App.tsx</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">App.tsx</div>
                            <div class="editor-content" style="font-size: 7.5px; line-height: 1.4;">
                              <span class="c-code">import &#123; useEffect &#125; from 'react';</span>
                              <span class="c-comment">// Dynamic script insertion</span>
                              <span class="c-code highlight">useEffect(() => &#123; ... &#125;, []);</span>
                            </div>
                            <div class="editor-btn btn--react">Deploy App</div>
                          </div>
                        </div>
                      } @else if (selectedPlatform() === 6) {
                        <!-- Vercel HTML Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar bg--vercel">
                            <div class="mockup-side-item active">public/</div>
                            <div class="mockup-sub-item active">index.html</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">index.html</div>
                            <div class="editor-content" style="font-size: 7.5px; line-height: 1.4;">
                              <span class="c-tag">&lt;head&gt;</span>
                              <span class="c-code highlight">&lt;script src="..."&gt;&lt;/script&gt;</span>
                              <span class="c-tag">&lt;/head&gt;</span>
                            </div>
                            <div class="editor-btn btn--vercel">Deploy</div>
                          </div>
                        </div>
                      } @else if (selectedPlatform() === 7) {
                        <!-- Railway HTML Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar bg--railway">
                            <div class="mockup-side-item active">public/</div>
                            <div class="mockup-sub-item active">index.html</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">index.html</div>
                            <div class="editor-content" style="font-size: 7.5px; line-height: 1.4;">
                              <span class="c-tag">&lt;head&gt;</span>
                              <span class="c-code highlight">&lt;script src="..."&gt;&lt;/script&gt;</span>
                              <span class="c-tag">&lt;/head&gt;</span>
                            </div>
                            <div class="editor-btn btn--railway">Deploy</div>
                          </div>
                        </div>
                      } @else {
                        <!-- Custom HTML Mockup -->
                        <div class="mockup-wp">
                          <div class="mockup-sidebar">
                            <div class="mockup-side-item active">Files</div>
                            <div class="mockup-sub-item active">index.html</div>
                          </div>
                          <div class="mockup-editor">
                            <div class="editor-filename">index.html</div>
                            <div class="editor-content">
                              <span class="c-tag">&lt;head&gt;</span>
                              <span class="c-code highlight">&lt;script src=".../scribe-count..."&gt;&lt;/script&gt;</span>
                              <span class="c-tag">&lt;/head&gt;</span>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Expandable Advanced Docs Link -->
                  <div class="advanced-docs-section">
                    <button class="btn-advanced-toggle" (click)="showAdvancedDev.set(!showAdvancedDev())">
                      {{ showAdvancedDev() ? 'Hide' : 'Show' }} Advanced / Developer Integration Docs
                    </button>
                    
                    @if (showAdvancedDev()) {
                      <div class="advanced-docs-content animate-slide">
                        <h5>Manual API Event Collection</h5>
                        <p>If you're building a custom server-side application, you can POST raw JSON events directly to ScribeCount.</p>
                        <p><strong>Endpoint:</strong> <code>{{ collectUrl() }}</code></p>
                        <p><strong>Headers:</strong> <code>Content-Type: application/json</code></p>
                        <p><strong>Body Schema:</strong></p>
                        <pre class="advanced-code-box"><code>{{ getSampleJson() }}</code></pre>
                      </div>
                    }
                  </div>

                  <div class="wizard-footer">
                    <button class="btn-ghost" (click)="wizardStep.set(2)">Back</button>
                    <button class="btn-primary" (click)="goToStep4()">I've Installed It</button>
                  </div>
                </div>
              }

              <!-- STEP 4: Verification -->
              @if (wizardStep() === 4 && createdSite()) {
                <div class="wizard-step-content animate-slide">
                  <p class="wizard-welcome-copy">We'll scan your website HTML or verify active incoming data to confirm the connection is active.</p>

                  <div class="wizard-row">
                    <!-- Left: Verification Content -->
                    <div class="wizard-main-col">
                      <div class="verification-card" id="verify-button-container">
                        
                        @if (verifying()) {
                          <!-- Verifying State -->
                          <div class="verify-state state--checking">
                            <div class="spinner"></div>
                            <h4>Checking installation...</h4>
                            <p>Pinging {{ createdSite()!.domain }} and waiting for events...</p>
                          </div>
                        } @else if (verificationResult()?.isVerified) {
                          <!-- Success State -->
                          <div class="verify-state state--success">
                            <div class="verify-icon-big">✓</div>
                            <h4 class="text--success">Connection Verified!</h4>
                            <p>Your website is connected. You'll start seeing data within a few minutes.</p>
                            <button class="btn-primary" style="margin-top: 8px;" (click)="closeWizard()">Go to Analytics</button>
                          </div>
                        } @else if (verificationResult()) {
                          <!-- Troubleshooting Failure State -->
                          <div class="verify-state state--failed">
                            <div class="verify-icon-big text--warning">!</div>
                            <h4>Could not detect code snippet yet</h4>
                            <p class="text-muted" style="font-size: 13px; margin: 4px 0 10px 0;">We checked {{ createdSite()!.domain }} but couldn't verify the tracking script.</p>
                            
                            <div class="troubleshoot-box">
                              <h5 style="margin-bottom: 6px;">Checklist of common issues:</h5>
                              <ul class="troubleshoot-list">
                                <li><strong>Caching:</strong> If you use a cache plugin (W3 Total Cache, WP Rocket) or Cloudflare, clear your site cache first.</li>
                                <li><strong>Placement:</strong> Double check that the code is pasted inside the <code>&lt;head&gt;</code> tags and saved/published.</li>
                                <li><strong>Incognito Test:</strong> Open your site in an incognito tab and click around a few pages to send first live hits.</li>
                              </ul>
                              <p class="support-label">Still having issues? <a href="mailto:support@scribecount.com" class="settings-link">Contact ScribeCount Support</a></p>
                            </div>

                            <div class="verify-actions">
                              <button class="btn-secondary" (click)="verifyConnection()">Re-verify connection</button>
                              <button class="btn-ghost" (click)="closeWizard()">Setup later</button>
                            </div>
                          </div>
                        } @else {
                          <!-- Ready to verify -->
                          <div class="verify-state">
                            <div class="verify-icon-big text--neutral">?</div>
                            <h4>Ready to verify connection</h4>
                            <p>Click below to verify the setup.</p>
                            <button class="btn-primary" (click)="verifyConnection()">Verify Connection</button>
                          </div>
                        }
                      </div>
                    </div>

                    <!-- Right: Inline Speech bubble pointer Step 4 -->
                    <div class="wizard-side-col">
                      <div class="guided-pointer-inline pointer-arrow-left">
                        <div class="pointer-bubble">
                          <span class="pointer-badge">Step 4 of 4</span>
                          <strong>Verify Setup</strong>
                          <p>Click this button. ScribeCount will scan your site for the script. If you already loaded your website, it will immediately detect it and verify your setup!</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="wizard-footer">
                    <button class="btn-ghost" [disabled]="verifying()" (click)="wizardStep.set(3)">Back</button>
                    @if (!verificationResult()?.isVerified) {
                      <button class="btn-primary" [disabled]="verifying()" (click)="verifyConnection()">
                        Verify Connection
                      </button>
                    }
                  </div>
                </div>
              }

            </div>
          </div>
        </div>
      }

      <!-- Toast -->
      @if (toast()) {
        <div class="toast" [class.toast--error]="toastType() === 'error'">
          {{ toast() }}
        </div>
      }

    </div>
  `,
  styles: [`
    .page {
      padding: 28px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 28px;
      gap: 16px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }

    .page-sub {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
    }

    .quick-start-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 18px;
      padding: 20px 24px;
      margin-bottom: 24px;
      display: grid;
      gap: 14px;
    }

    .quick-start-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .quick-start-label {
      font-size: 12px;
      font-weight: 700;
      color: rgb(var(--color-accent));
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .quick-start-title {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
      color: rgb(var(--color-text-primary));
    }

    .quick-start-pill {
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.12);
      color: rgb(var(--color-accent));
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .quick-start-copy {
      margin: 0;
      color: rgb(var(--color-text-muted));
      font-size: 13px;
      line-height: 1.7;
    }

    /* Buttons */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      background: rgb(var(--color-accent));
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 150ms;
      white-space: nowrap;
    }
    .btn-primary:hover:not(:disabled) { opacity: 0.88; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary {
      padding: 9px 18px;
      background: transparent;
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      color: rgb(var(--color-text-secondary));
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 150ms;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-secondary:hover { background: rgb(var(--color-surface-hover)); }

    .btn-ghost {
      padding: 9px 16px;
      background: transparent;
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      color: rgb(var(--color-text-secondary));
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-ghost:hover { background: rgb(var(--color-surface-hover)); }

    .wizard-modal .btn-ghost {
      background: transparent;
      border: 1px solid #475569;
      color: #cbd5e1;
      font-weight: 600;
      transition: background 150ms, color 150ms, border-color 150ms;
    }
    .wizard-modal .btn-ghost:hover:not(:disabled) {
      background: #334155;
      color: #fff;
      border-color: #64748b;
    }
    .wizard-modal .btn-ghost:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .wizard-modal .btn-secondary {
      background: transparent;
      border: 1px solid #475569;
      color: #cbd5e1;
      font-weight: 600;
      transition: background 150ms, color 150ms, border-color 150ms;
    }
    .wizard-modal .btn-secondary:hover:not(:disabled) {
      background: #334155;
      color: #fff;
      border-color: #64748b;
    }
    .wizard-modal .btn-secondary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-sm {
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    .btn-outline {
      background: transparent;
      border: 1px solid rgb(var(--color-border)) !important;
      color: rgb(var(--color-text-secondary));
    }
    .btn-outline:hover { background: rgb(var(--color-surface-hover)); }

    .btn-primary-sm {
      background: rgb(var(--color-accent));
      color: #fff;
    }
    .btn-primary-sm:hover { opacity: 0.88; }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 80px 20px;
      color: rgb(var(--color-text-muted));
      font-size: 14px;
      text-align: center;
    }

    /* Sites Grid */
    .sites-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
      gap: 20px;
    }

    /* Site Card */
    .site-card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: box-shadow 200ms, border-color 200ms;
    }
    .site-card:hover {
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }
    .site-card--active {
      border-color: rgba(99,102,241,0.5);
      box-shadow: 0 0 0 2px rgba(99,102,241,0.12);
    }

    .site-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .site-favicon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgb(var(--color-surface-hover));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
    }

    .site-info {
      flex: 1;
      min-width: 0;
    }

    .site-domain {
      font-size: 15px;
      font-weight: 700;
      color: rgb(var(--color-text-primary));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .site-platform-badge {
      display: inline-block;
      font-size: 11px;
      color: rgb(var(--color-text-muted));
      margin-top: 2px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .active-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      background: rgba(52,211,153,0.12);
      color: rgb(52,211,153);
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }

    /* Tracked Link */
    .tracked-link-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgb(var(--color-surface-hover));
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      padding: 10px 14px;
      flex-wrap: wrap;
    }

    .tracked-link-label {
      font-size: 11px;
      font-weight: 600;
      color: rgb(var(--color-text-muted));
      text-transform: uppercase;
      letter-spacing: 0.06em;
      flex-shrink: 0;
    }

    .tracked-link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      font-weight: 600;
      color: rgb(var(--color-accent));
      text-decoration: none;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tracked-link:hover { text-decoration: underline; }

    .click-hint {
      font-size: 11px;
      color: rgb(var(--color-text-muted));
      flex-shrink: 0;
    }

    /* Live Stats */
    .live-stats-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .live-dot-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot--active {
      background: rgb(52,211,153);
      box-shadow: 0 0 0 0 rgba(52,211,153,0.4);
      animation: pulse-dot 2s infinite;
    }
    .dot--waiting {
      background: rgb(245, 158, 11);
      box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
      animation: pulse-dot-yellow 2s infinite;
    }

    .live-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .text--active { color: rgb(52,211,153); }
    .text--waiting { color: rgb(245, 158, 11); }

    @keyframes pulse-dot {
      0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
      70%  { box-shadow: 0 0 0 7px rgba(52,211,153,0); }
      100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); }
    }
    @keyframes pulse-dot-yellow {
      0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
      70%  { box-shadow: 0 0 0 7px rgba(245, 158, 11, 0); }
      100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
    }

    .stats-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .chip--green  { background: rgba(52,211,153,0.1);  color: rgb(52,211,153); }
    .chip--blue   { background: rgba(96,165,250,0.1);  color: rgb(96,165,250); }
    .chip--purple { background: rgba(167,139,250,0.1); color: rgb(167,139,250); }
    .chip--orange { background: rgba(251,146,60,0.1);  color: rgb(251,146,60); }
    .chip--teal   { background: rgba(45,212,191,0.1);  color: rgb(45,212,191); }

    .stats-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: rgb(var(--color-text-muted));
    }

    /* Card Footer */
    .card-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 1px solid rgb(var(--color-border));
    }

    .events-today {
      font-size: 12px;
      color: rgb(var(--color-text-muted));
    }

    /* Redesigned Scrollable Wizard Modal & CSS Mockups */
    .wizard-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      overflow-y: auto; /* Support scrolling the whole overlay on very small viewports */
    }

    .wizard-modal {
      width: 100%;
      max-width: 900px;
      background: #1e293b;
      border: 1px solid #334155;
      color: #f1f5f9;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      position: relative;
      margin: auto; /* Required for scroll alignment in flex container */
      max-height: calc(100vh - 40px); /* Limit modal height */
      overflow: hidden;
    }

    .wizard-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px 12px 24px;
      border-bottom: 1px solid #1e293b;
    }

    .wizard-step-badge {
      display: inline-block;
      padding: 3px 8px;
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .wizard-modal-title {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
      margin: 0;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }
    .btn-close:hover { color: #fff; }

    .wizard-progress-bar {
      width: 100%;
      height: 4px;
      background: #334155;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1 0%, #4f46e5 100%);
      transition: width 0.3s ease;
    }

    /* Scrollable Wizard Body */
    .wizard-body {
      padding: 20px 24px;
      overflow-y: auto; /* Allows vertical scrolling inside modal */
      flex: 1;
    }

    .wizard-welcome-copy {
      font-size: 13px;
      color: #94a3b8;
      margin-bottom: 16px;
      line-height: 1.5;
    }

    .form-group-relative {
      position: relative;
      margin-bottom: 16px;
      width: 100%;
    }

    .wizard-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 4px;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .wizard-input {
      width: 100%;
      height: 38px;
      padding: 0 14px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #fff;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .wizard-input:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .check-icon {
      position: absolute;
      right: 12px;
      color: #10b981;
      font-weight: 700;
      font-size: 16px;
    }

    .auto-detect-loader {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* Inline Pointer speech bubbles (No viewport cutoff) */
    .wizard-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 20px;
      align-items: start;
    }

    .wizard-main-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .wizard-side-col {
      display: flex;
      flex-direction: column;
    }

    .guided-pointer-inline {
      position: relative;
      filter: drop-shadow(0 4px 10px rgba(0,0,0,0.25));
    }

    /* Left-pointing arrow (for bubbles in the right column pointing left) */
    .pointer-arrow-left::before {
      content: '';
      position: absolute;
      left: -8px;
      top: 24px;
      width: 0; height: 0;
      border-style: solid;
      border-width: 8px 8px 8px 0;
      border-color: transparent #f59e0b transparent transparent;
    }

    /* Right-pointing arrow (for bubbles in the left column pointing right) */
    .pointer-arrow-right::before {
      content: '';
      position: absolute;
      right: -8px;
      top: 24px;
      width: 0; height: 0;
      border-style: solid;
      border-width: 8px 0 8px 8px;
      border-color: transparent transparent transparent #f59e0b;
    }

    .pointer-bubble {
      background: #f59e0b; /* Amber */
      color: #0f172a;
      padding: 12px 14px;
      border-radius: 12px;
      font-size: 12px;
      line-height: 1.45;
    }

    .pointer-badge {
      display: inline-block;
      padding: 2px 6px;
      background: rgba(0,0,0,0.12);
      color: #0f172a;
      border-radius: 99px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .pointer-bubble strong {
      display: block;
      font-size: 13px;
      margin-bottom: 2px;
    }

    .pointer-bubble p {
      margin: 0;
      opacity: 0.95;
    }

    .wizard-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1px solid #334155;
    }

    /* Step 2 Platform grid (More compact) */
    .platform-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 12px;
    }

    .platform-card {
      background: #0f172a;
      border: 2px solid #334155;
      border-radius: 12px;
      padding: 14px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 150ms;
      color: #fff;
    }
    .platform-card:hover {
      border-color: #4f46e5;
      transform: translateY(-1px);
      background: #1e293b;
    }
    .platform-card--selected {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.15);
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
    }

    .platform-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 15px;
    }
    .wp-icon { background: #21759b; color: #fff; }
    .shopify-icon { background: #96bf48; color: #fff; }
    .wix-icon { background: #000; color: #fff; font-size: 11px; }
    .sq-icon { background: #fff; color: #000; }
    .other-icon { background: #475569; color: #fff; }
    .vercel-icon { background: #000; color: #fff; font-size: 14px; }
    .railway-icon { background: #0b0d19; color: #f92672; font-size: 14px; }

    .platform-label {
      font-size: 11px;
      font-weight: 600;
    }

    /* Step 3 layout (More compact) */
    .installation-panel {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 20px;
    }

    .instruction-col {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .instruction-subtitle {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #94a3b8;
      letter-spacing: 0.05em;
      margin: 0;
    }

    .step-list {
      margin: 0;
      padding-left: 16px;
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.5;
    }
    .step-list li {
      margin-bottom: 6px;
    }

    .code-block-container {
      position: relative;
    }

    .snippet-code {
      margin: 0;
      padding: 10px 12px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      font-size: 11px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      color: #38bdf8;
      font-family: ui-monospace, monospace;
      line-height: 1.35;
    }

    .btn-copy {
      margin-top: 8px;
      width: 100%;
      justify-content: center;
      padding: 8px;
    }

    .autotrack-note {
      margin: 0 0 14px;
      padding: 12px 14px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 10px;
      font-size: 12px;
      color: #0c4a6e;
      line-height: 1.5;
    }
    .autotrack-note strong { display: block; margin-bottom: 6px; color: #075985; }
    .autotrack-note ul { margin: 0; padding-left: 16px; }
    .autotrack-note li { margin-bottom: 6px; }
    .autotrack-note code {
      background: #0f172a; color: #7dd3fc; padding: 2px 6px;
      border-radius: 4px; font-size: 11px; word-break: break-all;
    }
    .localhost-warn {
      margin: 12px 0 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fff7ed;
      border: 1px solid #fed7aa;
      color: #9a3412;
      font-size: 12px;
      line-height: 1.55;
    }
    .localhost-warn strong { display: inline; color: #9a3412; }

    /* Advanced docs */
    .advanced-docs-section {
      border-top: 1px dashed #334155;
      margin-top: 14px;
      padding-top: 10px;
    }

    .btn-advanced-toggle {
      background: transparent;
      border: none;
      color: #818cf8;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
    }
    .btn-advanced-toggle:hover { text-decoration: underline; }

    .advanced-docs-content {
      background: #0f172a;
      border: 1px solid #1e293b;
      padding: 12px;
      border-radius: 8px;
      margin-top: 8px;
    }
    .advanced-docs-content h5 {
      margin: 0 0 4px 0;
      color: #fff;
      font-size: 12px;
    }
    .advanced-docs-content p {
      font-size: 11px;
      color: #cbd5e1;
      margin: 0 0 6px 0;
    }
    .advanced-code-box {
      background: #1e293b;
      padding: 8px;
      border-radius: 6px;
      font-size: 11px;
      color: #f1f5f9;
      margin: 4px 0 0 0;
    }

    /* Step 3 CMS Mockups (Reduced height) */
    .mockup-wp {
      width: 100%;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      display: grid;
      grid-template-columns: 70px 1fr;
      overflow: hidden;
      max-height: 140px;
    }
    .mockup-sidebar {
      background: #1e293b;
      border-right: 1px solid #334155;
      padding: 8px 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bg--shopify { background: #1a2210; }
    .bg--wix { background: #111; }
    .bg--squarespace { background: #000; }

    .mockup-side-item {
      font-size: 8px;
      color: #64748b;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .mockup-side-item.active {
      background: rgba(255,255,255,0.06);
      color: #fff;
      font-weight: 700;
    }
    .mockup-sub-item {
      font-size: 8px;
      color: #94a3b8;
      padding: 1px 8px;
    }
    .mockup-sub-item.active {
      color: #6366f1;
      font-weight: 700;
    }
    .mockup-editor {
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .editor-filename {
      font-size: 9px;
      color: #94a3b8;
      font-family: monospace;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .editor-content {
      font-family: monospace;
      font-size: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .c-tag { color: #f43f5e; }
    .c-comment { color: #64748b; font-style: italic; }
    .c-code { color: #10b981; }
    .c-code.highlight {
      background: rgba(16, 185, 129, 0.15);
      border-left: 2px solid #10b981;
      padding-left: 3px;
    }
    .editor-btn {
      align-self: flex-end;
      padding: 3px 8px;
      background: #007cba;
      color: #fff;
      font-size: 8px;
      font-weight: 700;
      border-radius: 3px;
      margin-top: 6px;
    }
    .btn--shopify { background: #008060; }
    .btn--wix { background: #0099ff; }
    .btn--squarespace { background: #111; border: 1px solid #334155; }
    .bg--vercel { background: #000; }
    .btn--vercel { background: #fff; color: #000; border: 1px solid #334155; }
    .bg--railway { background: #0b0d19; }
    .btn--railway { background: #f92672; color: #fff; }
    .bg--react { background: #20232a; }
    .btn--react { background: #61dafb; color: #000; }

    .framework-selector {
      display: inline-flex;
      background: #0f172a;
      border: 1px solid #334155;
      padding: 3px;
      border-radius: 8px;
      margin-bottom: 12px;
      width: 100%;
    }
    .btn-fw {
      flex: 1;
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 150ms;
      text-align: center;
    }
    .btn-fw:hover {
      color: #fff;
    }
    .btn-fw--active {
      background: #334155;
      color: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .wix-box, .squarespace-box {
      border: 1px dashed #334155;
      padding: 4px;
      border-radius: 4px;
      background: rgba(255,255,255,0.01);
    }

    /* Verification card styles (Compact) */
    .verification-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
    }

    .verify-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .verify-icon-big {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 700;
    }
    .state--checking .spinner {
      margin-bottom: 8px;
    }
    .state--success .verify-icon-big {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    .state--failed .verify-icon-big {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }
    .verify-icon-big.text--neutral {
      background: #1e293b;
      color: #64748b;
    }

    .troubleshoot-box {
      text-align: left;
      background: #1e293b;
      border: 1px solid #334155;
      padding: 12px;
      border-radius: 8px;
      width: 100%;
      margin: 10px 0;
    }
    .troubleshoot-box h5 {
      margin: 0 0 6px 0;
      color: #fff;
      font-size: 12px;
    }
    .troubleshoot-list {
      margin: 0 0 8px 0;
      padding-left: 14px;
      font-size: 11px;
      color: #cbd5e1;
      line-height: 1.45;
    }
    .troubleshoot-list li {
      margin-bottom: 4px;
    }
    .support-label {
      font-size: 11px;
      color: #94a3b8;
      margin: 0;
    }

    .verify-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-left: 4px solid rgb(52,211,153);
      border-radius: 12px;
      padding: 14px 20px;
      font-size: 13px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slide-in 0.25s ease;
    }
    .toast--error {
      border-left-color: rgb(248,113,113);
    }

    .form-error {
      color: #ef4444;
      font-size: 12px;
      margin-top: 6px;
    }

    @keyframes slide-in {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    .animate-in {
      animation: fadeIn 0.4s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .animate-slide {
      animation: slideStep 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes slideStep {
      from { opacity: 0; transform: translateX(10px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    /* Responsive grid collapses pointer speech arrows */
    @media (max-width: 1024px) {
      .wizard-row {
        grid-template-columns: 1fr;
        gap: 16px;
      }
      .pointer-arrow-left::before,
      .pointer-arrow-right::before {
        display: none;
      }
      .installation-panel {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .page { padding: 16px; }
      .sites-grid { grid-template-columns: 1fr; }
      .page-header { flex-direction: column; }
    }
  `]
})
export class WebsitesComponent implements OnInit, OnDestroy {
  private readonly api = inject(TrafficApiService);
  readonly activeSite = inject(ActiveSiteService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  sites = signal<SiteDto[]>([]);
  loading = signal(true);
  adding = signal(false);
  addError = signal('');
  activeSiteId = signal<string | null>(null);

  /** Map of siteId -> live stats */
  liveMap = signal<Record<string, LiveStatsDto>>({});

  toast = signal('');
  toastType = signal<'success' | 'error'>('success');

  // Wizard state signals
  wizardVisible = signal(false);
  wizardStep = signal(1);
  wizardSiteName = signal('');
  wizardUrl = signal('');
  urlValid = signal(false);
  detectingPlatform = signal(false);
  selectedPlatform = signal<number>(4); // default Custom/Other
  selectedFramework = signal<'html' | 'react'>('html');
  createdSite = signal<SiteDto | null>(null);
  verifying = signal(false);
  verificationResult = signal<VerifyResultDto | null>(null);
  showAdvancedDev = signal(false);
  copiedSnippet = signal(false);

  private liveInterval: Subscription | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.loadSites();
    // Sync active site from service
    const active = this.activeSite.site();
    if (active) this.activeSiteId.set(active.siteId);

    // Auto-launch the Connection Setup Wizard on first sign-up (?setup=1) so new users
    // start by connecting a website instead of a demo walkthrough.
    if (this.route.snapshot.queryParamMap.get('setup') === '1') {
      this.openWizard();
      // Strip the flag so a refresh doesn't reopen the wizard.
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.liveInterval?.unsubscribe();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  loadSites(): void {
    this.loading.set(true);
    this.api.listSites().pipe(
      finalize(() => this.loading.set(false)),
      catchError(() => of<SiteDto[]>([]))
    ).subscribe(sites => {
      this.sites.set(sites);
      const active = this.activeSite.site();
      if (active) this.activeSiteId.set(active.siteId);
      this.startLivePolling(sites);
    });
  }

  getPlatformName(platform: number): string {
    switch (platform) {
      case 1: return 'WordPress';
      case 2: return 'Shopify';
      case 3: return 'Wix';
      case 5: return 'Squarespace';
      case 6: return 'Vercel';
      case 7: return 'Railway';
      default: return 'Custom / Other';
    }
  }

  openWizard(): void {
    this.wizardStep.set(1);
    this.wizardSiteName.set('');
    this.wizardUrl.set('');
    this.urlValid.set(false);
    this.detectingPlatform.set(false);
    this.selectedPlatform.set(4);
    this.selectedFramework.set('html');
    this.createdSite.set(null);
    this.verifying.set(false);
    this.verificationResult.set(null);
    this.showAdvancedDev.set(false);
    this.copiedSnippet.set(false);
    this.wizardVisible.set(true);
  }

  closeWizard(): void {
    this.wizardVisible.set(false);
    this.loadSites();
    // Refresh the header switcher, preferring the site that was just set up (if it completed).
    this.activeSite.refresh(this.createdSite()?.siteId);
  }

  validateUrl(): void {
    const raw = this.wizardUrl().trim();
    if (!raw) {
      this.urlValid.set(false);
      return;
    }
    // Simple URL regex check
    const pattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    const isValid = pattern.test(raw);
    this.urlValid.set(isValid);

    if (isValid) {
      // Suggest site friendly name from domain
      if (!this.wizardSiteName().trim()) {
        try {
          const clean = raw.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
          this.wizardSiteName.set(clean);
        } catch {
          // ignore error
        }
      }

      // Auto detect platform in the background
      this.detectingPlatform.set(true);
      this.api.detectPlatform(raw).pipe(
        finalize(() => this.detectingPlatform.set(false))
      ).subscribe({
        next: res => {
          if (res && res.platform) {
            this.selectedPlatform.set(res.platform);
          }
        },
        error: () => {
          // ignore, keep Other
        }
      });
    }
  }

  goToStep2(): void {
    if (this.urlValid()) {
      this.wizardStep.set(2);
    }
  }

  goToStep3(): void {
    this.adding.set(true);
    this.addError.set('');
    
    // Register the site, but keep it out of the connected list until the wizard is
    // fully completed (verified). completeSetup=false marks it pending.
    this.activeSite.register(this.wizardUrl().trim(), this.wizardSiteName().trim(), this.selectedPlatform(), false).pipe(
      finalize(() => this.adding.set(false))
    ).subscribe({
      next: site => {
        this.createdSite.set(site);
        this.wizardStep.set(3);
        this.activeSiteId.set(site.siteId);
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? 'Failed to register website.';
        this.addError.set(msg);
      }
    });
  }

  goToStep4(): void {
    this.wizardStep.set(4);
    // Auto-trigger verification once
    this.verifyConnection();
  }

  verifyConnection(): void {
    const site = this.createdSite();
    if (!site) return;
    this.verifying.set(true);
    this.verificationResult.set(null);

    this.api.verifySite(site.siteId).pipe(
      finalize(() => this.verifying.set(false))
    ).subscribe({
      next: res => {
        this.verificationResult.set(res);
      },
      error: err => {
        this.verificationResult.set({
          siteId: site.siteId,
          isVerified: false,
          details: err?.error?.message ?? err?.message ?? 'Verification failed'
        });
      }
    });
  }

  copyWizardSnippet(): void {
    const site = this.createdSite();
    if (!site) return;
    const isReact = (this.selectedPlatform() === 4 || this.selectedPlatform() === 6 || this.selectedPlatform() === 7) && this.selectedFramework() === 'react';
    const snippet = isReact ? this.getReactSnippet(site) : this.getSnippetForSite(site);
    
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(snippet).then(() => {
        this.copiedSnippet.set(true);
        setTimeout(() => this.copiedSnippet.set(false), 2000);
      });
    }
  }

  getSnippetForSite(site: SiteDto): string {
    const origin = this.collectUrl();
    const src = this.trackerScriptSrc();
    // Config-first pattern: setting window.scribeCountTracking before the (deferred) SDK
    // loads means the snippet works no matter the script execution order, and the SDK
    // auto-initializes on load. Handles SPA route changes + conversions automatically.
    return `<script>
  window.scribeCountTracking = {
    trackingKey: '${site.trackingKey}',
    endpoint: '${origin}'
  };
</script>
<script src="${src}" defer></script>`;
  }

  getReactSnippet(site: SiteDto): string {
    const origin = this.collectUrl();
    const src = this.trackerScriptSrc();
    return `import { useEffect } from 'react';

// Paste inside App.tsx or root layout component
useEffect(() => {
  const script = document.createElement('script');
  script.src = '${src}';
  script.defer = true;
  script.onload = () => {
    (window as any).tracker?.init('${site.trackingKey}', { endpoint: '${origin}' });
  };
  document.head.appendChild(script);
}, []);`;
  }

  collectUrl(): string {
    if (typeof window === 'undefined') return '/api/collect';
    return `${window.location.origin}/api/collect`;
  }

  /** Snippet uses this PC's localhost — phones/other devices cannot reach it. */
  isLocalhostCollect(): boolean {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  }

  trackerScriptSrc(): string {
    if (typeof window === 'undefined') return '/scribe-count.tracker.js';
    return `${window.location.origin}/scribe-count.tracker.js`;
  }

  getSampleJson(): string {
    const key = this.createdSite()?.trackingKey ?? 'sc_live_YOUR_TRACKING_KEY';
    return JSON.stringify(
      {
        trackingKey: key,
        eventType: 1,
        pageUrl: 'https://your-website.com/',
        metadata: {},
        timestamp: null,
      },
      null,
      2,
    );
  }

  selectSite(site: SiteDto): void {
    this.activeSite.selectSiteById(site.siteId);
    this.activeSiteId.set(site.siteId);
    this.showToast(`Switched to ${site.domain}`, 'success');
  }

  viewAnalytics(site: SiteDto): void {
    this.selectSite(site);
    void this.router.navigate(['/']);
  }

  onTrackedLinkClick(event: MouseEvent, site: SiteDto): void {
    // Fire a PageView tracking event for this site
    this.api.collectEvent({
      siteId: site.siteId,
      eventType: 1, // PageView
      pageUrl: `https://${site.domain}/`,
      metadata: { source: 'dashboard_tracked_link', trigger: 'manual_click' },
      timestamp: new Date().toISOString(),
    }).pipe(catchError(() => of(null))).subscribe(() => {
      this.showToast(`Test hit sent for ${site.domain}`, 'success');
      // Refresh live stats immediately
      this.fetchLiveStats(site.siteId);
    });
  }

  onFaviconError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  private startLivePolling(sites: SiteDto[]): void {
    this.liveInterval?.unsubscribe();
    if (!sites.length) return;

    // Fetch immediately
    sites.forEach(s => this.fetchLiveStats(s.siteId));

    // Then every 15 seconds
    this.liveInterval = interval(15000).subscribe(() => {
      this.sites().forEach(s => this.fetchLiveStats(s.siteId));
    });
  }

  private fetchLiveStats(siteId: string): void {
    this.api.liveStats(siteId).pipe(
      catchError(() => of(null))
    ).subscribe(stats => {
      if (!stats) return;
      this.liveMap.update(map => ({ ...map, [siteId]: stats }));
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set(msg);
    this.toastType.set(type);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3500);
  }
}

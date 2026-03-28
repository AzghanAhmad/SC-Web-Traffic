import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Configure your web traffic analytics preferences</p>
      </div>

      <div class="settings-layout">
        <!-- Settings Navigation -->
        <nav class="settings-nav">
          <button *ngFor="let section of sections"
                  class="nav-item"
                  [class.active]="activeSection === section.id"
                  (click)="activeSection = section.id">
            <div class="nav-icon" [innerHTML]="section.icon"></div>
            {{ section.label }}
          </button>
        </nav>

        <!-- Settings Content -->
        <div class="settings-content">
          <!-- Account -->
          <div class="settings-section" *ngIf="activeSection === 'account'">
            <div class="card">
              <h2 class="section-title">Account Information</h2>
              <div class="form-group">
                <label class="form-label">Display Name</label>
                <input type="text" class="form-input" [(ngModel)]="accountName">
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" class="form-input" [(ngModel)]="accountEmail">
              </div>
              <div class="form-group">
                <label class="form-label">Organization</label>
                <input type="text" class="form-input" [(ngModel)]="organization">
              </div>
              <button class="btn-primary" style="margin-top: 0.75rem;" (click)="saveSettings()" [disabled]="saving">
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>

            <div class="card">
              <h2 class="section-title">Security</h2>
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input type="password" class="form-input" [(ngModel)]="currentPassword" placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input type="password" class="form-input" [(ngModel)]="newPassword" placeholder="Enter new password">
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input type="password" class="form-input" [(ngModel)]="confirmPassword" placeholder="Confirm new password">
              </div>
              <button class="btn-secondary" style="margin-top: 0.75rem;" (click)="changePassword()">Change Password</button>
            </div>
          </div>

          <!-- Appearance -->
          <div class="settings-section" *ngIf="activeSection === 'appearance'">
            <div class="card">
              <h2 class="section-title">Theme</h2>
              <p class="section-desc">Change how the dashboard looks</p>
              <div class="theme-options">
                <div class="theme-option" [class.active]="theme === 'light'" (click)="theme = 'light'">
                  <div class="theme-preview light">
                    <div class="preview-header"></div>
                    <div class="preview-sidebar"></div>
                    <div class="preview-content"></div>
                  </div>
                  <span class="theme-label">Light</span>
                </div>
                <div class="theme-option" [class.active]="theme === 'dark'" (click)="theme = 'dark'">
                  <div class="theme-preview dark">
                    <div class="preview-header"></div>
                    <div class="preview-sidebar"></div>
                    <div class="preview-content"></div>
                  </div>
                  <span class="theme-label">Dark</span>
                </div>
                <div class="theme-option" [class.active]="theme === 'auto'" (click)="theme = 'auto'">
                  <div class="theme-preview auto">
                    <div class="preview-header"></div>
                    <div class="preview-sidebar"></div>
                    <div class="preview-content"></div>
                  </div>
                  <span class="theme-label">Auto</span>
                </div>
              </div>
              <button class="btn-primary" style="margin-top: 0.75rem;" (click)="saveSettings()" [disabled]="saving">
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>

            <div class="card">
              <h2 class="section-title">Dashboard Preferences</h2>
              <p class="section-desc">Set your default page and layout</p>
              <div class="form-group">
                <label class="form-label">Default Landing Page</label>
                <select class="form-input" [(ngModel)]="defaultPage">
                  <option value="overview">Overview</option>
                  <option value="traffic">Traffic Analytics</option>
                  <option value="conversions">Conversions</option>
                  <option value="heatmaps">Heatmaps</option>
                </select>
              </div>
              <div class="setting-item">
                <div class="setting-info">
                  <span class="setting-label">Compact Sidebar</span>
                  <span class="setting-desc">Use a narrower sidebar for more content space</span>
                </div>
                <input type="checkbox" class="toggle" [(ngModel)]="compactSidebar">
              </div>
              <button class="btn-primary" style="margin-top: 0.75rem;" (click)="saveSettings()" [disabled]="saving">
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>

          <!-- Billing -->
          <div class="settings-section" *ngIf="activeSection === 'billing'">
            <div class="card plan-card">
              <div class="plan-header">
                <div>
                  <h2 class="plan-name">Pro Plan</h2>
                  <p class="plan-price">$29/month</p>
                </div>
                <span class="plan-badge">Current Plan</span>
              </div>
              <ul class="plan-features">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Unlimited Websites
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Advanced Analytics
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Heatmaps & Funnels
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Priority Support
                </li>
              </ul>
            </div>

            <div class="card">
              <h2 class="section-title">Billing History</h2>
              <div class="billing-table">
                <div class="billing-row header">
                  <span>Date</span>
                  <span>Description</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                <div class="billing-row" *ngFor="let inv of invoices">
                  <span>{{ inv.date }}</span>
                  <span>{{ inv.description }}</span>
                  <span class="billing-amount">{{ inv.amount }}</span>
                  <span class="billing-status paid">{{ inv.status }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast" [class.show]="showToast">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        {{ toastMessage }}
      </div>
    </div>
  `,
  styles: [`
    .page {
      max-width: 1440px;
      margin: 10px;
      padding: 28px;
      animation: fadeIn 0.5s ease-out;
    }

    .page-header { margin-bottom: 28px; }

    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: rgb(28, 46, 74);
      letter-spacing: -0.01em;
      margin: 0 0 4px 0;
    }

    .page-subtitle {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      margin: 0;
    }

    .settings-layout {
      display: grid;
      grid-template-columns: 220px 1fr;
      gap: 16px;
    }

    .settings-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: sticky;
      top: 1rem;
      align-self: flex-start;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 10px 14px;
      background: transparent;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      color: rgb(var(--color-text-secondary));
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      font-family: inherit;
    }

    .nav-item:hover {
      background: rgb(var(--color-surface-hover));
      color: rgb(var(--color-text-primary));
    }

    .nav-item.active {
      background: rgba(59, 130, 246, 0.1);
      color: rgb(var(--color-accent));
      font-weight: 600;
    }

    .nav-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .nav-icon :global(svg) {
      width: 18px;
      height: 18px;
    }

    /* Cards */
    .card {
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
      transition: all var(--transition-base);
    }

    .card:hover {
      border-color: rgb(var(--color-border-light));
      box-shadow: var(--shadow-glow);
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: rgb(var(--color-text-primary));
      margin: 0 0 2px 0;
    }

    .section-desc {
      font-size: 13px;
      color: rgb(var(--color-text-muted));
      margin: 0 0 16px 0;
    }

    .form-group { margin-bottom: 16px; }

    .form-label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: rgb(var(--color-text-secondary));
      margin-bottom: 6px;
    }

    .form-input {
      width: 100%;
      padding: 10px 14px;
      background: rgb(var(--color-surface));
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      font-size: 14px;
      font-family: inherit;
      color: rgb(var(--color-text-primary));
      transition: all var(--transition-fast);
      outline: none;
    }

    .form-input:focus {
      border-color: rgb(var(--color-accent));
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    /* Setting Items */
    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px;
      background: rgb(var(--color-surface-elevated));
      border-radius: 12px;
      margin-bottom: 0.5rem;
    }

    .setting-label { font-size: 14px; font-weight: 600; color: rgb(var(--color-text-primary)); display: block; }
    .setting-desc { font-size: 13px; color: rgb(var(--color-text-muted)); }

    /* Toggle */
    .toggle {
      appearance: none;
      width: 44px;
      height: 24px;
      background: rgb(var(--color-border));
      border: none;
      border-radius: 12px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle:checked {
      background: rgb(var(--color-accent));
    }

    .toggle:checked::after {
      transform: translateX(20px);
    }

    /* Theme */
    .theme-options {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .theme-option {
      flex: 1;
      padding: 1rem;
      background: transparent;
      border: 2px solid rgb(var(--color-border));
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .theme-option:hover { border-color: rgb(var(--color-border-light)); }

    .theme-option.active {
      border-color: rgb(var(--color-accent));
      background: rgba(59, 130, 246, 0.04);
    }

    .theme-preview {
      width: 100%;
      height: 64px;
      border-radius: 8px;
      overflow: hidden;
      display: grid;
      grid-template-columns: 20px 1fr;
      grid-template-rows: 10px 1fr;
      gap: 2px;
      background: rgb(var(--color-border));
      margin-bottom: 0.75rem;
    }

    .preview-header { grid-column: 1 / -1; background: #1c2e4a; }
    .preview-sidebar { background: #1c2e4a; }
    .preview-content { background: #f5f7fa; }
    .theme-preview.dark .preview-content { background: #0f172a; }
    .theme-preview.auto .preview-content { background: linear-gradient(135deg, #f5f7fa 50%, #0f172a 50%); }
    .theme-label { font-size: 13px; font-weight: 500; color: rgb(var(--color-text-primary)); }

    /* Plan Card */
    .plan-card {
      background: linear-gradient(135deg, rgb(28, 46, 74) 0%, rgb(45, 75, 120) 100%);
      border: none;
      color: white;
    }

    .plan-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .plan-name {
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 0 0.25rem 0;
    }

    .plan-price {
      font-size: 1rem;
      color: rgba(255,255,255,0.7);
      margin: 0;
    }

    .plan-badge {
      padding: 0.375rem 1rem;
      background: rgba(255,255,255,0.2);
      border-radius: 100px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .plan-features li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .plan-features svg {
      width: 18px;
      height: 18px;
      color: #6ee7b7;
      flex-shrink: 0;
    }

    /* Billing Table */
    .billing-table { margin-top: 0.75rem; }

    .billing-row {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr 1fr;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgb(var(--color-border, 38 48 72));
      font-size: 0.875rem;
      color: rgb(var(--color-text-secondary));
    }

    .billing-row.header {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgb(var(--color-text-muted));
    }

    .billing-row:last-child { border-bottom: none; }
    .billing-amount { font-weight: 600; }

    .billing-status.paid {
      color: rgb(52, 211, 153);
      font-weight: 500;
      text-transform: capitalize;
    }

    /* Buttons */
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      background: rgb(var(--color-accent));
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary:hover:not(:disabled) {
      background: rgb(var(--color-accent-light));
      box-shadow: 0 0 16px rgba(59, 130, 246, 0.3);
    }

    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .btn-secondary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.25rem;
      background: transparent;
      color: rgb(var(--color-text-secondary));
      border: 1px solid rgb(var(--color-border));
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      border-color: rgb(var(--color-border-light));
      color: rgb(var(--color-text-primary));
      background: rgb(var(--color-surface-hover));
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.25rem;
      background: rgb(28,46,74);
      color: white;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 12px 32px rgba(0,0,0,0.2);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      z-index: 1000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast svg { width: 18px; height: 18px; color: #6ee7b7; }

    @media (max-width: 768px) {
      .page { padding: 16px; }
      .settings-layout { grid-template-columns: 1fr; }
      .settings-nav { flex-direction: row; overflow-x: auto; position: static; }
      .plan-features { grid-template-columns: 1fr; }
      .theme-options { flex-direction: column; }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class SettingsComponent {
  activeSection = 'account';
  defaultDateRange = '7d';
  defaultView = 'overview';
  trackPageViews = true;
  trackUniqueVisitors = true;
  enableHeatmaps = true;
  accountName = 'Admin User';
  accountEmail = 'admin@scribecount.com';
  organization = 'ScribeCount';
  theme = 'light';
  defaultPage = 'overview';
  compactSidebar = false;
  showToast = false;
  toastMessage = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  saving = false;

  constructor(private cdr: ChangeDetectorRef) { }

  saveSettings() {
    this.saving = true;
    this.cdr.detectChanges();

    // Simulated save
    setTimeout(() => {
      this.saving = false;
      this.toastMessage = 'Settings saved!';
      this.showToast = true;
      this.cdr.detectChanges();
      setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
    }, 800);
  }

  changePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.showToastMsg('Please fill all password fields.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.showToastMsg('New password and confirm do not match.');
      return;
    }
    if (this.newPassword.length < 6) {
      this.showToastMsg('New password must be at least 6 characters.');
      return;
    }
    // Simulated password change
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.showToastMsg('Password changed successfully.');
  }

  private showToastMsg(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
    this.cdr.detectChanges();
    setTimeout(() => { this.showToast = false; this.cdr.detectChanges(); }, 2500);
  }

  sections = [
    { id: 'account', label: 'Account', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' },
    { id: 'appearance', label: 'Appearance', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' },
    { id: 'billing', label: 'Billing', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>' }
  ];

  emailNotifications = [
    { title: 'Traffic Spike Alerts', description: 'Get notified when traffic exceeds normal thresholds', enabled: true },
    { title: 'Weekly Traffic Reports', description: 'Summary of your website performance every Monday', enabled: true },
    { title: 'Conversion Milestones', description: 'Notifications when you hit conversion goals', enabled: true },
    { title: 'Product Updates', description: 'News about ScribeCount Traffic features', enabled: false }
  ];

  invoices = [
    { date: 'Mar 1, 2026', description: 'Pro Plan — Monthly', amount: '$29.00', status: 'paid' },
    { date: 'Feb 1, 2026', description: 'Pro Plan — Monthly', amount: '$29.00', status: 'paid' },
    { date: 'Jan 1, 2026', description: 'Pro Plan — Monthly', amount: '$29.00', status: 'paid' }
  ];
}

import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ActiveSiteService } from '../../services/active-site.service';
import { httpErrorMessage } from '../../utils/analytics.helpers';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <header class="top-bar">
      <div class="top-bar-left">
        <button class="menu-toggle" type="button" (click)="toggleMenu()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 5h14M3 10h14M3 15h14" stroke-linecap="round"/>
          </svg>
        </button>
        <a class="brand" routerLink="/">
          <img
            class="brand-logo-img"
            src="/ScribeCount%20logo%20-%20promo%20tile%20large-01.jpg"
            height="36"
            alt="ScribeCount"
          />
          <span class="logo-badge">Traffic</span>
        </a>
      </div>

      <div class="top-bar-center">
        <form class="site-track-form" (ngSubmit)="onTrackSite()">
          <label class="sr-only" for="track-site-url">Website to analyze</label>
          <input
            id="track-site-url"
            name="siteUrl"
            type="url"
            class="site-url-input"
            [(ngModel)]="siteUrlInput"
            placeholder="Paste site URL (e.g. https://example.com)"
            autocomplete="url"
            [disabled]="registering()"
          />
          <button type="submit" class="site-track-btn" [disabled]="registering()">
            {{ registering() ? '…' : 'Track' }}
          </button>
        </form>
        <div class="site-switcher-wrap">
          <label class="sr-only" for="site-switcher">Switch tracked website</label>
          <select
            id="site-switcher"
            class="site-switcher"
            [ngModel]="activeSite.site()?.siteId ?? ''"
            (ngModelChange)="onSiteSwitch($event)"
            [disabled]="!activeSite.sites().length || activeSite.loading()"
            title="Switch between your registered properties"
          >
            @if (!activeSite.sites().length) {
              <option value="">No sites — use Track above</option>
            } @else {
              @for (s of activeSite.sites(); track s.siteId) {
                <option [value]="s.siteId">{{ s.domain }}</option>
              }
            }
          </select>
        </div>
        @if (siteError()) {
          <span class="site-error">{{ siteError() }}</span>
        }
      </div>

      <div class="top-bar-right">
        <button class="user-avatar" type="button" (click)="$event.stopPropagation(); menuOpen.set(!menuOpen())">
          <span>{{ auth.initials() }}</span>
        </button>

        <div class="profile-menu" *ngIf="menuOpen()" (click)="$event.stopPropagation()">
          <div class="profile-menu-head">
            <div class="menu-avatar">{{ auth.initials() }}</div>
            <div class="menu-meta">
              <div class="menu-name">{{ auth.displayName() }}</div>
              <div class="menu-email" *ngIf="auth.email()">{{ auth.email() }}</div>
            </div>
          </div>
          <a class="menu-item" routerLink="/settings" (click)="menuOpen.set(false)">Account Settings</a>
          <a class="menu-item" routerLink="/traffic" (click)="menuOpen.set(false)">Traffic Analytics</a>
          <a class="menu-item" routerLink="/conversions" (click)="menuOpen.set(false)">Conversions</a>
          <button type="button" class="menu-item signout" (click)="signOut()">Sign out</button>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .top-bar {
      height: 64px;
      background: linear-gradient(135deg, rgb(22, 38, 62) 0%, rgb(38, 65, 108) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 20px;
      width: 100%;
      z-index: 60;
    }

    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }

    .top-bar-center {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .site-track-form {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 520px;
      width: 100%;
    }

    .site-url-input {
      flex: 1;
      min-width: 0;
      height: 36px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(15, 23, 42, 0.35);
      color: #f8fafc;
      font-size: 13px;
      outline: none;
    }

    .site-url-input::placeholder {
      color: rgba(248, 250, 252, 0.45);
    }

    .site-url-input:focus {
      border-color: rgba(129, 140, 248, 0.7);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
    }

    .site-url-input:disabled {
      opacity: 0.6;
    }

    .site-track-btn {
      height: 36px;
      padding: 0 14px;
      border-radius: 10px;
      border: none;
      background: rgba(255, 255, 255, 0.95);
      color: rgb(22, 38, 62);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
    }

    .site-track-btn:hover:not(:disabled) {
      background: #fff;
    }

    .site-track-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .site-switcher-wrap {
      flex-shrink: 0;
    }

    .site-switcher {
      height: 36px;
      min-width: 160px;
      max-width: 260px;
      padding: 0 32px 0 12px;
      border-radius: 10px;
      border: 1px solid rgba(129, 140, 248, 0.45);
      background: rgba(15, 23, 42, 0.5) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%23a5b4fc' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;
      color: #e0e7ff;
      font-size: 12px;
      font-weight: 600;
      text-transform: none;
      letter-spacing: 0.02em;
      cursor: pointer;
      outline: none;
      appearance: none;
      -webkit-appearance: none;
    }

    .site-switcher:focus {
      border-color: rgba(165, 180, 252, 0.85);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
    }

    .site-switcher:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .site-switcher option {
      color: #1e293b;
      background: #f8fafc;
    }

    .site-error {
      font-size: 11px;
      color: #fecaca;
      max-width: 280px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .menu-toggle {
      display: none;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      transition: all var(--transition-fast);
    }

    .menu-toggle:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #ffffff;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #ffffff;
      text-decoration: none;
    }

    .brand-logo-img {
      display: block;
      height: 36px;
      width: auto;
      max-width: min(240px, 46vw);
      object-fit: contain;
      object-position: left center;
      flex-shrink: 1;
    }

    .logo-badge {
      padding: 2px 8px;
      background: rgba(129, 140, 248, 0.12);
      border: 1px solid rgba(129, 140, 248, 0.35);
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      color: #a5b4fc;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
      flex-shrink: 0;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: rgb(22, 38, 62);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .user-avatar:hover {
      box-shadow: 0 0 16px rgba(255, 255, 255, 0.35);
      transform: scale(1.05);
    }

    .profile-menu {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 360px;
      background: #fff;
      border-radius: 20px;
      border: 1px solid rgb(var(--color-border));
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22);
      overflow: hidden;
      z-index: 80;
    }

    .profile-menu-head {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px;
      border-bottom: 1px solid rgb(var(--color-border-light));
    }

    .menu-avatar {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f7cff 0%, #7a5af8 100%);
      color: #fff;
      font-size: 18px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .menu-name {
      color: rgb(28, 46, 74);
      font-weight: 700;
      font-size: .8125rem;
      line-height: 1;
    }

    .menu-email {
      color: #9caec8;
      font-weight: 600;
      font-size: .6875rem;
      margin-top: 4px;
    }

    .menu-item {
      width: 100%;
      text-align: left;
      border: none;
      background: #fff;
      padding: 12px 16px;
      font-size: .8125rem;
      font-weight: 600;
      color: rgb(28, 46, 74);
      cursor: pointer;
      text-decoration: none;
      display: block;
    }

    .menu-item:hover {
      background: rgb(var(--color-surface-hover));
    }

    .menu-item.signout {
      color: #ff3b42;
      border-top: 1px solid rgb(var(--color-border-light));
      width: 100%;
      cursor: pointer;
      font-family: inherit;
    }

    @media (max-width: 1024px) {
      .logo-badge { display: none; }
    }

    @media (max-width: 900px) {
      .top-bar-center {
        order: 3;
        flex-basis: 100%;
        justify-content: flex-start;
        padding-bottom: 8px;
      }
      .top-bar {
        flex-wrap: wrap;
        height: auto;
        min-height: 64px;
        padding-top: 10px;
        padding-bottom: 10px;
      }
    }

    @media (max-width: 768px) {
      .menu-toggle { display: flex; }
      .top-bar { padding-left: 16px; padding-right: 16px; }
    }
  `]
})
export class TopBarComponent {
  menuOpen = signal(false);
  siteUrlInput = '';
  siteError = signal('');
  registering = signal(false);

  readonly auth = inject(AuthService);
  readonly activeSite = inject(ActiveSiteService);
  private readonly router = inject(Router);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

  onSiteSwitch(siteId: string): void {
    if (!siteId || siteId === this.activeSite.site()?.siteId) return;
    this.activeSite.selectSiteById(siteId);
  }

  onTrackSite(): void {
    const url = this.siteUrlInput.trim();
    this.siteError.set('');
    if (!url) {
      this.siteError.set('Enter a website URL.');
      return;
    }
    this.registering.set(true);
    this.activeSite.register(url).pipe(finalize(() => this.registering.set(false))).subscribe({
      next: () => {
        this.siteUrlInput = '';
        void this.router.navigateByUrl('/');
      },
      error: err => this.siteError.set(httpErrorMessage(err)),
    });
  }

  signOut(): void {
    this.activeSite.clear();
    this.auth.clearSession();
    this.menuOpen.set(false);
    void this.router.navigate(['/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.menuOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.menuOpen.set(false);
    }
  }

  toggleMenu() {
    this.menuOpen.update(v => !v);
  }
}

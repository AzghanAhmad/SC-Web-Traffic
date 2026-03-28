import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-top-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="top-bar">
      <div class="top-bar-left">
        <button class="menu-toggle" (click)="toggleMenu()">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 5h14M3 10h14M3 15h14" stroke-linecap="round"/>
          </svg>
        </button>
        <a class="brand" href="/">
          <div class="brand-icon">↗</div>
          <div class="brand-text">
            <span class="brand-title">SC Smart Links</span>
            <span class="brand-subtitle">Universal Book Links</span>
          </div>
        </a>
      </div>

      <div class="top-bar-right">
        <button class="user-avatar" type="button" (click)="$event.stopPropagation(); menuOpen.set(!menuOpen())">
          <span>SC</span>
        </button>

        <div class="profile-menu" *ngIf="menuOpen()" (click)="$event.stopPropagation()">
          <div class="profile-menu-head">
            <div class="menu-avatar">FN</div>
            <div class="menu-meta">
              <div class="menu-name">Fast Nuces</div>
              <div class="menu-email">fastnuces22@gmail.com</div>
            </div>
          </div>
          <a class="menu-item" routerLink="/settings" (click)="menuOpen.set(false)">⚙️ Account Settings</a>
          <a class="menu-item" routerLink="/traffic" (click)="menuOpen.set(false)">📈 Traffic Analytics</a>
          <a class="menu-item" routerLink="/conversions" (click)="menuOpen.set(false)">💰 Conversions</a>
          <a class="menu-item signout" routerLink="/auth/login" (click)="menuOpen.set(false)">⎋ Sign out</a>
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
      padding: 0 28px;
      width: 100%;
      z-index: 60;
    }

    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 16px;
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

    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4f7cff 0%, #7a5af8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.05;
    }

    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .brand-subtitle {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.75;
    }

    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
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
    }

    @media (max-width: 1024px) {
      .brand-subtitle { display: none; }
    }

    @media (max-width: 768px) {
      .menu-toggle { display: flex; }
      .top-bar { padding: 0 16px; }
    }
  `]
})
export class TopBarComponent {
  menuOpen = signal(false);
  private readonly hostRef = inject(ElementRef<HTMLElement>);

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

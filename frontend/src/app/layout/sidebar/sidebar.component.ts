import { Component, signal, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar" [class.collapsed]="collapsed()">
      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div class="nav-section-label" *ngIf="!collapsed()">Analytics</div>
        @for (item of navItems; track item.route) {
          <a class="nav-item"
             [routerLink]="item.route"
             routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: item.route === '/' }">
            <span class="nav-icon" [ngSwitch]="item.icon">
              <svg *ngSwitchCase="'home'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 10.5 12 3l9 7.5"></path>
                <path d="M5 9.8V21h14V9.8"></path>
              </svg>
              <svg *ngSwitchCase="'chart'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h16"></path>
                <path d="M7 16V9"></path>
                <path d="M12 16V5"></path>
                <path d="M17 16v-3"></path>
              </svg>
              <svg *ngSwitchCase="'conversion'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6h9"></path>
                <path d="m10 3 3 3-3 3"></path>
                <path d="M20 18h-9"></path>
                <path d="m14 15-3 3 3 3"></path>
              </svg>
              <svg *ngSwitchCase="'funnels'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 5h18"></path>
                <path d="M6 10h12"></path>
                <path d="M9 15h6"></path>
                <path d="M11 19h2"></path>
              </svg>
              <svg *ngSwitchCase="'heatmap'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>
                <path d="M12 3v2"></path>
                <path d="M12 19v2"></path>
                <path d="M3 12h2"></path>
                <path d="M19 12h2"></path>
                <path d="m5.6 5.6 1.4 1.4"></path>
                <path d="m17 17 1.4 1.4"></path>
                <path d="m18.4 5.6-1.4 1.4"></path>
                <path d="m7 17-1.4 1.4"></path>
              </svg>
              <svg *ngSwitchCase="'pages'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 4h16v16H4z"></path>
                <path d="M8 9h8"></path>
                <path d="M8 13h8"></path>
                <path d="M8 17h5"></path>
              </svg>
              <svg *ngSwitchCase="'campaigns'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12h2l2-6 4 12 2-6h6"></path>
              </svg>
              <svg *ngSwitchCase="'devices'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 6h13v11H3z"></path>
                <path d="M18 9h3v8h-3z"></path>
                <path d="M8 20h3"></path>
              </svg>
              <svg *ngSwitchCase="'settings'" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"></path>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <svg *ngSwitchDefault viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 8v8"></path>
                <path d="M8 12h8"></path>
                <path d="M12 3.5v2"></path>
                <path d="M12 18.5v2"></path>
                <path d="M3.5 12h2"></path>
                <path d="M18.5 12h2"></path>
              </svg>
            </span>
            <span class="nav-label" *ngIf="!collapsed()">{{ item.label }}</span>
            <div class="nav-active-indicator"></div>
          </a>
        }
      </nav>

      <div class="sidebar-divider"></div>

      <div class="sidebar-user" *ngIf="!collapsed()">
        <div class="profile-avatar">{{ auth.initials() }}</div>
        <div class="profile-meta">
          <div class="profile-name">{{ auth.displayName() }}</div>
          <div class="profile-email" *ngIf="auth.email()">{{ auth.email() }}</div>
        </div>
      </div>

      <button class="logout-btn" *ngIf="!collapsed()" type="button" (click)="logout()">Logout</button>

      <button class="collapse-btn" (click)="toggleCollapse()" [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'">
        <span>{{ collapsed() ? '→' : '←' }}</span>
      </button>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      min-width: 260px;
      height: 100vh;
      background: linear-gradient(180deg, rgb(22, 38, 62) 0%, rgb(14, 24, 40) 100%);
      border-right: 1px solid rgba(255, 255, 255, 0.12);
      display: flex;
      flex-direction: column;
      padding: 80px 12px 20px;
      transition: all var(--transition-base);
      position: fixed;
      left: 0;
      top: 0;
      z-index: 40;
    }

    .sidebar.collapsed {
      width: 72px;
      min-width: 72px;
    }

    .nav-section-label {
      padding: 4px 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(255, 255, 255, 0.6);
      margin-bottom: 8px;
    }

    .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
      padding-top: 12px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      transition: all var(--transition-fast);
      position: relative;
      cursor: pointer;
    }

    .nav-item:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .nav-item.active {
      background: rgba(59, 130, 246, 0.25);
      color: #ffffff;
    }

    .nav-active-indicator {
      position: absolute;
      right: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 0;
      background: #ffffff;
      border-radius: 3px;
      transition: height var(--transition-base);
    }

    .nav-item.active .nav-active-indicator {
      height: 20px;
    }

    .nav-icon {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      text-align: center;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .nav-icon svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.92;
    }

    .nav-label {
      white-space: nowrap;
    }

    .sidebar-divider {
      height: 1px;
      margin: 12px 4px 10px;
      background: rgba(255, 255, 255, 0.1);
    }

    .sidebar-user {
      display: flex;
      align-items: center;
      gap: .75rem;
      margin: 0 4px 12px;
      padding: .625rem .75rem;
      border-radius: 14px;
      background: #ffffff0a;
      transition: background .2s;
    }

    .profile-avatar {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f7cff 0%, #7a5af8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 18px;
      flex-shrink: 0;
    }

    .profile-name {
      color: #fff;
      font-size: .8125rem;
      line-height: 1.2;
      font-weight: 700;
    }

    .profile-email {
      color: rgba(255, 255, 255, 0.6);
      font-size: .6875rem;
      margin-top: 2px;
      line-height: 1.2;
    }

    .logout-btn {
      margin: 0 4px 12px;
      display: flex;
      align-items: center;
      gap: .75rem;
      width: calc(100% - 8px);
      padding: .625rem 1rem;
      background: #ef444414;
      border: 1px solid rgba(239, 68, 68, .1);
      border-radius: 10px;
      color: #fca5a5cc;
      font-size: .8125rem;
      font-weight: 500;
      font-family: Inter, sans-serif;
      text-align: left;
      cursor: pointer;
      transition: all .25s cubic-bezier(.4, 0, .2, 1);
    }

    .logout-btn:hover {
      background: rgba(55, 28, 40, 0.6);
      color: #ffb1bb;
    }

    .collapse-btn {
      margin: 0 4px;
      padding: 10px;
      border-radius: 10px;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.75);
      cursor: pointer;
      font-size: 16px;
      transition: all var(--transition-fast);
    }

    .collapse-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
      }
      .sidebar.mobile-open {
        transform: translateX(0);
      }
    }
  `]
})
export class SidebarComponent {
  collapsed = signal(false);
  @Output() collapsedChange = new EventEmitter<boolean>();
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  navItems: NavItem[] = [
    { label: 'Overview', icon: 'home', route: '/' },
    { label: 'Traffic Analytics', icon: 'chart', route: '/traffic' },
    { label: 'Conversions', icon: 'conversion', route: '/conversions' },
    { label: 'Funnels', icon: 'funnels', route: '/funnels' },
    { label: 'Heatmaps', icon: 'heatmap', route: '/heatmaps' },
    { label: 'Pages Performance', icon: 'pages', route: '/pages' },
    { label: 'Sources & Campaigns', icon: 'campaigns', route: '/campaigns' },
    { label: 'Device Insights', icon: 'devices', route: '/devices' },
    { label: 'Settings', icon: 'settings', route: '/settings' },
  ];

  toggleCollapse() {
    this.collapsed.update(v => !v);
    this.collapsedChange.emit(this.collapsed());
  }

  logout(): void {
    this.auth.clearSession();
    void this.router.navigate(['/login']);
  }
}

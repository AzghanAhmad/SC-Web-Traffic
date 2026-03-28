import { Component, signal, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

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
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label" *ngIf="!collapsed()">{{ item.label }}</span>
            <div class="nav-active-indicator"></div>
          </a>
        }
      </nav>

      <div class="sidebar-divider"></div>

      <div class="sidebar-user" *ngIf="!collapsed()">
        <div class="profile-avatar">FN</div>
        <div class="profile-meta">
          <div class="profile-name">Fast Nuces</div>
          <div class="profile-email">fastnuces22@gmail.com</div>
        </div>
      </div>

      <button class="logout-btn" *ngIf="!collapsed()" type="button">⤴ Logout</button>

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
      font-size: 18px;
      line-height: 1;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
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

  navItems: NavItem[] = [
    { label: 'Overview', icon: '🏠', route: '/' },
    { label: 'Traffic Analytics', icon: '📈', route: '/traffic' },
    { label: 'Conversions', icon: '💰', route: '/conversions' },
    { label: 'Funnels', icon: '🔁', route: '/funnels' },
    { label: 'Heatmaps', icon: '🔥', route: '/heatmaps' },
    { label: 'Pages Performance', icon: '📄', route: '/pages' },
    { label: 'Sources & Campaigns', icon: '📢', route: '/campaigns' },
    { label: 'Device Insights', icon: '📱', route: '/devices' },
    { label: 'Settings', icon: '⚙️', route: '/settings' },
  ];

  toggleCollapse() {
    this.collapsed.update(v => !v);
    this.collapsedChange.emit(this.collapsed());
  }
}

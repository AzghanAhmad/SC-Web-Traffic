import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopBarComponent } from '../top-bar/top-bar.component';
import { ActiveSiteService } from '../../services/active-site.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopBarComponent],
  template: `
    <div class="app-layout" [class.sidebar-collapsed]="sidebarCollapsed()">
      <app-sidebar (collapsedChange)="onSidebarCollapse($event)"></app-sidebar>
      <div class="main-area">
        <div class="topbar-wrap">
          <app-top-bar></app-top-bar>
        </div>
        <main class="main-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      min-height: 100vh;
      background: rgb(var(--color-bg));
    }

    .main-area {
      flex: 1;
      margin-left: 260px;
      display: flex;
      flex-direction: column;
      transition: margin-left 250ms cubic-bezier(0.4, 0, 0.2, 1);
      min-width: 0;
    }

    .sidebar-collapsed .main-area {
      margin-left: 72px;
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      padding-top: 64px;
    }

    .topbar-wrap {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
    }

    @media (max-width: 768px) {
      .main-area {
        margin-left: 0 !important;
      }
      .main-content {
        padding-top: 64px;
      }
      .topbar-wrap {
        left: 0 !important;
      }
    }
  `]
})
export class DashboardLayoutComponent implements OnInit {
  private readonly activeSite = inject(ActiveSiteService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  sidebarCollapsed = signal(false);

  ngOnInit(): void {
    // Load sites immediately so the overview child does not wait on /Auth/me finishing first.
    if (this.auth.isAuthenticated()) {
      this.activeSite.refresh();
    }
    this.http.get<{ email: string; displayName: string }>('/api/Auth/me').subscribe({
      next: () => this.activeSite.refresh(),
      error: err => {
        const status = err instanceof HttpErrorResponse ? err.status : 0;
        if (status === 401 || status === 403) {
          this.activeSite.clear();
          this.auth.clearSession();
          void this.router.navigate(['/login']);
          return;
        }
        this.activeSite.refresh();
      },
    });
  }

  onSidebarCollapse(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
  }
}

import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  // Auth pages (no sidebar/topbar)
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/signup/signup.component').then(m => m.SignupComponent),
  },

  // Dashboard pages (with sidebar/topbar)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/dashboard-layout/dashboard-layout.component').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/overview/overview.component').then(m => m.OverviewComponent),
      },
      {
        path: 'traffic',
        loadComponent: () =>
          import('./pages/traffic/traffic.component').then(m => m.TrafficComponent),
      },
      {
        path: 'conversions',
        loadComponent: () =>
          import('./pages/conversions/conversions.component').then(m => m.ConversionsComponent),
      },
      {
        path: 'funnels',
        loadComponent: () =>
          import('./pages/funnels/funnels.component').then(m => m.FunnelsComponent),
      },
      {
        path: 'heatmaps',
        loadComponent: () =>
          import('./pages/heatmaps/heatmaps.component').then(m => m.HeatmapsComponent),
      },
      {
        path: 'pages',
        loadComponent: () =>
          import('./pages/pages-performance/pages.component').then(m => m.PagesComponent),
      },
      {
        path: 'campaigns',
        loadComponent: () =>
          import('./pages/campaigns/campaigns.component').then(m => m.CampaignsComponent),
      },
      {
        path: 'devices',
        loadComponent: () =>
          import('./pages/devices/devices.component').then(m => m.DevicesComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: 'websites',
        loadComponent: () =>
          import('./pages/websites/websites.component').then(m => m.WebsitesComponent),
      },
    ]
  },
  {
    path: '**',
    redirectTo: '',
  },
];

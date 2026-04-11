import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="nav" [class.scrolled]="navScrolled">
      <div class="nav-inner">
        <a routerLink="/" class="nav-logo">
          <img
            class="brand-logo-img"
            src="/ScribeCount%20logo%20-%20promo%20tile%20large-01.jpg"
            height="34"
            alt="ScribeCount"
          />
          <span class="logo-badge">Traffic</span>
        </a>
        <nav class="nav-links">
          <a routerLink="/" routerLinkActive="nav-active" [routerLinkActiveOptions]="{exact:true}">Dashboard</a>
          <a routerLink="/traffic" routerLinkActive="nav-active">Traffic</a>
          <a routerLink="/conversions" routerLinkActive="nav-active">Conversions</a>
          <a routerLink="/login" class="nav-link-login">Log In</a>
          <a routerLink="/signup" class="btn-signup">Sign Up</a>
        </nav>
        <button class="mobile-toggle" (click)="mobileOpen = !mobileOpen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path *ngIf="!mobileOpen" d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/>
            <path *ngIf="mobileOpen" d="M6 6l12 12M6 18L18 6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <!-- Mobile Menu -->
      <div class="mobile-menu" *ngIf="mobileOpen">
        <a routerLink="/" (click)="mobileOpen=false">Dashboard</a>
        <a routerLink="/traffic" (click)="mobileOpen=false">Traffic</a>
        <a routerLink="/conversions" (click)="mobileOpen=false">Conversions</a>
        <div class="mobile-divider"></div>
        <a routerLink="/login" (click)="mobileOpen=false">Log In</a>
        <a routerLink="/signup" (click)="mobileOpen=false" class="btn-signup-mobile">Sign Up</a>
      </div>
    </header>
  `,
  styles: [`
    :host { display:block; }

    .nav {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 100;
      background: transparent;
      transition: background .35s, box-shadow .35s, backdrop-filter .35s;
    }

    .nav.scrolled {
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(18px);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.25);
    }

    .nav-inner {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .nav-logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: white;
    }

    .brand-logo-img {
      display: block;
      height: 34px;
      width: auto;
      max-width: min(220px, 50vw);
      object-fit: contain;
      object-position: left center;
    }

    .logo-badge {
      padding: 2px 8px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 6px;
      font-size: 0.65rem;
      font-weight: 700;
      color: #818cf8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .nav-links a {
      color: rgba(255, 255, 255, 0.75);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .nav-links a:hover, .nav-active {
      color: white !important;
    }

    .nav-link-login {
      color: rgba(255, 255, 255, 0.85) !important;
    }

    .btn-signup {
      background: white !important;
      color: #1e293b !important;
      padding: 0.55rem 1.2rem;
      border-radius: 10px;
      font-weight: 600 !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s, box-shadow 0.2s !important;
    }

    .btn-signup:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25) !important;
    }

    .mobile-toggle {
      display: none;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.85);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .mobile-toggle:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .mobile-menu {
      display: none;
      flex-direction: column;
      padding: 0.75rem 1.5rem 1.25rem;
      background: rgba(15, 23, 42, 0.97);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .mobile-menu a {
      display: block;
      padding: 0.75rem 0;
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      transition: color 0.2s;
    }

    .mobile-menu a:hover { color: white; }

    .mobile-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 0.5rem 0;
    }

    .btn-signup-mobile {
      display: inline-block;
      background: white;
      color: #1e293b !important;
      padding: 0.65rem 1.25rem;
      border-radius: 10px;
      font-weight: 600;
      text-align: center;
      margin-top: 0.5rem;
    }

    @media (max-width: 768px) {
      .nav-links { display: none; }
      .mobile-toggle { display: flex; }
      .mobile-menu { display: flex; }
    }
  `]
})
export class HeaderComponent {
  navScrolled = false;
  mobileOpen = false;

  @HostListener('window:scroll')
  onScroll() {
    this.navScrolled = window.scrollY > 40;
  }
}

import { Component, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-signup',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    template: `
    <div class="auth-root">
      <!-- NAVBAR -->
      <header class="nav" [class.scrolled]="navScrolled">
        <div class="nav-inner">
          <a routerLink="/" class="nav-logo">
            <span class="logo-mark"><svg viewBox="0 0 36 36" fill="none"><defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="50%" stop-color="#818cf8"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient></defs><rect width="36" height="36" rx="10" fill="url(#lg)" opacity="0.15"/><path d="M13 14.5a3.5 3.5 0 0 1 5.25.38l1.75-1.75a3.5 3.5 0 0 0-4.95-4.95l-2 2" stroke="url(#lg)" stroke-width="2.2" stroke-linecap="round"/><path d="M23 21.5a3.5 3.5 0 0 1-5.25-.38l-1.75 1.75a3.5 3.5 0 0 0 4.95 4.95l2-2" stroke="url(#lg)" stroke-width="2.2" stroke-linecap="round"/><line x1="14" y1="22" x2="22" y2="14" stroke="url(#lg)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 3"/></svg></span>
            <span class="logo-text">ScribeCount</span>
          </a>
          <nav class="nav-links">
            <a routerLink="/login">Log In</a>
            <a routerLink="/signup" class="btn-signup nav-active">Sign Up</a>
          </nav>
        </div>
      </header>

      <!-- SPLIT HERO + FORM -->
      <section class="auth-hero">
        <div class="auth-hero-inner">
          <!-- LEFT -->
          <div class="hero-left">
            <h1 class="hero-title anim-up">Start Growing<br>Your <span class="gradient-text">Readership</span></h1>
            <p class="hero-sub anim-up d2">
              Join thousands of authors using ScribeCount to create Universal Book Links, track clicks, and discover which marketing channels work best.
            </p>
            <div class="hero-badges anim-up d3">
              <span class="badge-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> Free in Beta</span>
              <span class="badge-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Full Analytics</span>
              <span class="badge-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Unlimited Links</span>
            </div>
          </div>

          <!-- RIGHT -->
          <div class="form-side anim-up d2">
            <div class="auth-card">
              <h2 class="card-title">Create your account</h2>
              <p class="card-subtitle">By continuing you agree to our <a href="#" class="link-accent">Terms of Service</a> and <a href="#" class="link-accent">Privacy Policy</a>.</p>

              <!-- Success -->
              <div class="auth-success" *ngIf="successMessage()">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/></svg>
                {{ successMessage() }}
              </div>

              <!-- Error -->
              <div class="auth-error animate-shake" *ngIf="generalError()">
                <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd"/></svg>
                {{ generalError() }}
              </div>

              <form (ngSubmit)="onSubmit()" class="auth-form" novalidate>
                <div class="form-group">
                  <input id="signup-name" type="text" [(ngModel)]="name" name="name"
                    placeholder="Full name" autocomplete="name"
                    (input)="clearError('name')" [class.input-error]="errors().name" class="auth-input" />
                  <p class="field-error" *ngIf="errors().name">{{ errors().name }}</p>
                </div>
                <div class="form-group">
                  <input id="signup-email" type="email" [(ngModel)]="email" name="email"
                    placeholder="Email address" autocomplete="email"
                    (input)="clearError('email')" [class.input-error]="errors().email" class="auth-input" />
                  <p class="field-error" *ngIf="errors().email">{{ errors().email }}</p>
                </div>
                <div class="form-group">
                  <div class="input-wrapper">
                    <input id="signup-password" [type]="showPassword ? 'text' : 'password'"
                      [(ngModel)]="password" name="password" placeholder="Password (min 6 characters)"
                      autocomplete="new-password" (input)="clearError('password')"
                      [class.input-error]="errors().password" class="auth-input" />
                    <button type="button" class="toggle-pw" (click)="showPassword = !showPassword">
                      <svg *ngIf="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                      <svg *ngIf="showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                    </button>
                  </div>
                  <p class="field-error" *ngIf="errors().password">{{ errors().password }}</p>
                </div>
                <div class="form-group">
                  <div class="input-wrapper">
                    <input id="signup-confirm-password" [type]="showConfirmPassword ? 'text' : 'password'"
                      [(ngModel)]="confirmPassword" name="confirmPassword" placeholder="Confirm password"
                      autocomplete="new-password" (input)="clearError('confirmPassword')"
                      [class.input-error]="errors().confirmPassword" class="auth-input" />
                    <button type="button" class="toggle-pw" (click)="showConfirmPassword = !showConfirmPassword">
                      <svg *ngIf="!showConfirmPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                      <svg *ngIf="showConfirmPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                    </button>
                  </div>
                  <p class="field-error" *ngIf="errors().confirmPassword">{{ errors().confirmPassword }}</p>
                </div>

                <button id="signup-submit-btn" type="submit" class="auth-submit-btn" [disabled]="isSubmitting() || !!successMessage()">
                  <span class="spinner" *ngIf="isSubmitting()"></span>
                  {{ isSubmitting() ? 'Creating account...' : 'Create Account' }}
                </button>
              </form>

              <div class="card-divider"><span>or</span></div>
              <p class="card-alt-text">Already have an account?</p>
              <a routerLink="/login" class="btn-outline">Log in</a>
            </div>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <div class="footer-top">
          <div class="footer-brand">
            <a routerLink="/" class="nav-logo"><span class="logo-mark"><svg viewBox="0 0 36 36" fill="none"><defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient></defs><rect width="36" height="36" rx="10" fill="url(#lg2)" opacity="0.15"/><path d="M13 14.5a3.5 3.5 0 0 1 5.25.38l1.75-1.75a3.5 3.5 0 0 0-4.95-4.95l-2 2" stroke="url(#lg2)" stroke-width="2.2" stroke-linecap="round"/><path d="M23 21.5a3.5 3.5 0 0 1-5.25-.38l-1.75 1.75a3.5 3.5 0 0 0 4.95 4.95l2-2" stroke="url(#lg2)" stroke-width="2.2" stroke-linecap="round"/></svg></span><span class="logo-text">ScribeCount</span></a>
            <p class="footer-tagline">Smart links &amp; analytics for authors.</p>
          </div>
          <div class="footer-links">
            <div class="footer-col"><h4>Product</h4><a routerLink="/">Universal Links</a><a routerLink="/">Pricing</a></div>
            <div class="footer-col"><h4>Company</h4><a href="#">About</a><a href="#">Contact</a></div>
            <div class="footer-col"><h4>Legal</h4><a href="#">Privacy Policy</a><a href="#">Terms of Service</a></div>
          </div>
        </div>
        <div class="footer-bottom"><span>&copy; {{ year }} ScribeCount. All rights reserved.</span></div>
      </footer>
    </div>
  `,
    styles: [`
    :host { display:block; }
    .auth-root { min-height:100vh;background:#f8fafc;font-family:'Inter',system-ui,sans-serif;overflow-x:hidden; }

    @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    .anim-up { opacity:0;animation:fadeUp .7s cubic-bezier(.4,0,.2,1) forwards; }
    .d2{animation-delay:.12s} .d3{animation-delay:.24s}
    .animate-shake { animation:shake .4s ease-in-out; }

    /* NAV */
    .nav { position:fixed;top:0;left:0;right:0;z-index:100;background:transparent;transition:background .35s,box-shadow .35s; }
    .nav.scrolled { background:rgba(15,23,42,.92);backdrop-filter:blur(18px);box-shadow:0 4px 30px rgba(0,0,0,.25); }
    .nav-inner { max-width:1200px;margin:0 auto;padding:.85rem 1.5rem;display:flex;align-items:center;justify-content:space-between; }
    .nav-logo { display:flex;align-items:center;gap:.6rem;text-decoration:none;color:white; }
    .logo-mark { width:32px;height:32px;display:flex;align-items:center;justify-content:center; }
    .logo-mark svg { width:100%;height:100%; }
    .logo-text { font-weight:700;font-size:1.1rem;letter-spacing:-.02em; }
    .nav-links { display:flex;align-items:center;gap:1.5rem; }
    .nav-links a { color:rgba(255,255,255,.8);text-decoration:none;font-size:.9rem;font-weight:500;transition:color .2s; }
    .nav-links a:hover { color:white; }
    .nav-active { color:white !important; }
    .btn-signup { background:white !important;color:#1e293b !important;padding:.55rem 1.2rem;border-radius:10px;font-weight:600 !important;box-shadow:0 4px 14px rgba(0,0,0,.15);transition:transform .2s,box-shadow .2s !important; }
    .btn-signup:hover { transform:translateY(-2px) !important;box-shadow:0 8px 24px rgba(0,0,0,.25) !important; }

    /* HERO */
    .auth-hero {
      min-height:100vh;background:linear-gradient(135deg,rgb(22,38,62) 0%,rgb(30,55,95) 40%,rgb(16,28,46) 100%);
      display:flex;align-items:center;padding:5rem 1.5rem 3rem;position:relative;
    }
    .auth-hero::before { content:'';position:absolute;top:0;right:0;width:55%;height:100%;background:linear-gradient(180deg,rgba(255,255,255,.03) 0%,rgba(255,255,255,.01) 100%);pointer-events:none; }
    .auth-hero-inner { max-width:1200px;margin:0 auto;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center; }

    .hero-left { color:white; }
    .hero-title { font-size:3rem;font-weight:800;line-height:1.1;letter-spacing:-.04em;margin:0 0 1.25rem; }
    .gradient-text { background:linear-gradient(135deg,#60a5fa,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
    .hero-sub { font-size:1.05rem;line-height:1.65;color:rgba(226,232,240,.85);max-width:480px;margin:0 0 2rem; }
    .hero-badges { display:flex;gap:.6rem;flex-wrap:wrap; }
    .badge-pill { display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .9rem;background:rgba(255,255,255,.08);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.12);border-radius:100px;font-size:.8rem;font-weight:600;color:rgba(255,255,255,.85); }

    /* CARD */
    .form-side { display:flex;justify-content:center; }
    .auth-card { width:100%;max-width:420px;background:white;border-radius:18px;padding:2.25rem;box-shadow:0 20px 60px rgba(0,0,0,.2),0 0 0 1px rgba(0,0,0,.03); }
    .card-title { font-size:1.35rem;font-weight:700;color:#0f172a;margin:0 0 .35rem;text-align:center; }
    .card-subtitle { font-size:.82rem;color:#64748b;text-align:center;margin:0 0 1.5rem;line-height:1.5; }
    .link-accent { color:#6366f1;font-weight:600;text-decoration:none; }
    .link-accent:hover { text-decoration:underline; }

    .auth-form { display:flex;flex-direction:column;gap:.9rem; }
    .form-group { display:flex;flex-direction:column; }
    .input-wrapper { position:relative;display:flex;align-items:center; }
    .auth-input { width:100%;padding:.8rem 1rem;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;font-size:.9rem;font-family:inherit;color:#0f172a;transition:all .2s;outline:none; }
    .auth-input:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1); }
    .auth-input::placeholder { color:#94a3b8; }
    .auth-input.input-error { border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.08); }
    .toggle-pw { position:absolute;right:.85rem;display:flex;background:none;border:none;cursor:pointer;padding:0;color:#94a3b8;transition:color .2s; }
    .toggle-pw:hover { color:#0f172a; }
    .toggle-pw svg { width:18px;height:18px; }
    .field-error { margin:.3rem 0 0;font-size:.75rem;color:#ef4444;font-weight:500; }

    .auth-success { display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;background:#f0fdf4;border:1px solid rgba(34,197,94,.15);border-radius:10px;color:#22c55e;font-size:.85rem;font-weight:500;margin-bottom:1rem; }
    .auth-success svg { width:16px;height:16px;flex-shrink:0; }
    .auth-error { display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;background:#fef2f2;border:1px solid rgba(239,68,68,.15);border-radius:10px;color:#ef4444;font-size:.85rem;font-weight:500;margin-bottom:1rem; }
    .auth-error svg { width:16px;height:16px;flex-shrink:0; }

    .auth-submit-btn { width:100%;padding:.85rem 1rem;background:linear-gradient(135deg,rgb(22,38,62),rgb(35,60,100));color:white;border:none;border-radius:12px;font-size:.9rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all .25s;box-shadow:0 6px 20px rgba(22,38,62,.35);display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:.25rem; }
    .auth-submit-btn:hover:not(:disabled) { transform:translateY(-1px);box-shadow:0 10px 30px rgba(22,38,62,.45); }
    .auth-submit-btn:disabled { opacity:.6;cursor:not-allowed; }
    .spinner { width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;animation:spin .8s linear infinite; }

    .card-divider { display:flex;align-items:center;gap:1rem;margin:1.25rem 0 1rem; }
    .card-divider::before,.card-divider::after { content:'';flex:1;height:1px;background:#e2e8f0; }
    .card-divider span { font-size:.8rem;color:#94a3b8;font-weight:500; }
    .card-alt-text { text-align:center;font-size:.85rem;color:#64748b;margin:0 0 .6rem; }
    .btn-outline { display:block;width:100%;padding:.8rem;text-align:center;border:1.5px solid #e2e8f0;border-radius:12px;background:white;color:#0f172a;font-size:.9rem;font-weight:600;text-decoration:none;font-family:inherit;cursor:pointer;transition:all .2s; }
    .btn-outline:hover { border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.03); }

    /* FOOTER */
    .footer { background:#0b1120;color:#94a3b8; }
    .footer-top { max-width:1100px;margin:0 auto;padding:2.5rem 1.5rem 1.5rem;display:grid;grid-template-columns:1fr 2fr;gap:3rem;border-bottom:1px solid rgba(255,255,255,.06); }
    .footer-brand .nav-logo { margin-bottom:.5rem; }
    .footer-tagline { font-size:.85rem;color:#64748b;margin:0; }
    .footer-links { display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem; }
    .footer-col h4 { font-size:.8rem;font-weight:700;color:white;text-transform:uppercase;letter-spacing:.08em;margin:0 0 .6rem; }
    .footer-col a { display:block;color:#64748b;font-size:.85rem;text-decoration:none;padding:.2rem 0;transition:color .2s; }
    .footer-col a:hover { color:white; }
    .footer-bottom { max-width:1100px;margin:0 auto;padding:1rem 1.5rem;font-size:.8rem;color:#475569; }

    @media(max-width:900px) {
      .auth-hero-inner { grid-template-columns:1fr;gap:2.5rem; }
      .hero-left { text-align:center; }
      .hero-title { font-size:2.2rem; }
      .hero-sub { margin-left:auto;margin-right:auto; }
      .hero-badges { justify-content:center; }
      .footer-top { grid-template-columns:1fr; }
    }
    @media(max-width:480px) {
      .hero-title { font-size:1.8rem; }
      .auth-card { padding:1.5rem; }
      .footer-links { grid-template-columns:1fr; }
    }
  `]
})
export class SignupComponent {
    name = '';
    email = '';
    password = '';
    confirmPassword = '';
    showPassword = false;
    showConfirmPassword = false;
    navScrolled = false;
    readonly year = new Date().getFullYear();

    isSubmitting = signal(false);
    generalError = signal('');
    successMessage = signal('');
    errors = signal<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({});

    constructor(private authService: AuthService, private router: Router) { }

    @HostListener('window:scroll')
    onScroll() { this.navScrolled = window.scrollY > 40; }

    clearError(field: 'name' | 'email' | 'password' | 'confirmPassword') {
        this.errors.update(e => ({ ...e, [field]: undefined }));
    }

    onSubmit() {
        const errs: { name?: string; email?: string; password?: string; confirmPassword?: string } = {};

        if (!this.name.trim()) errs.name = 'Full name is required';
        if (!this.email.trim()) {
            errs.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
            errs.email = 'Please enter a valid email address';
        }
        if (!this.password) {
            errs.password = 'Password is required';
        } else if (this.password.length < 6) {
            errs.password = 'Password must be at least 6 characters';
        }
        if (!this.confirmPassword) {
            errs.confirmPassword = 'Please confirm your password';
        } else if (this.password !== this.confirmPassword) {
            errs.confirmPassword = 'Passwords do not match';
        }

        if (Object.keys(errs).length > 0) {
            this.errors.set(errs);
            return;
        }

        this.isSubmitting.set(true);
        this.generalError.set('');
        this.errors.set({});

        this.authService.register(this.name, this.email, this.password).subscribe({
            next: () => {
                this.successMessage.set('Account created successfully! Redirecting...');
                this.isSubmitting.set(false);
                setTimeout(() => { this.router.navigate(['/dashboard']); }, 1500);
            },
            error: (err) => {
                if (err.status === 409) {
                    this.errors.set({ email: err.message || 'This email is already registered' });
                } else {
                    this.generalError.set(err.message);
                }
                this.isSubmitting.set(false);
            }
        });
    }
}

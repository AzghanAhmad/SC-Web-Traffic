import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { AuthResultDto } from '../models/analytics.types';
import { ActiveSiteService } from './active-site.service';

export interface SessionUser {
  displayName: string;
  email: string;
}

interface StoredAuth {
  accessToken: string;
  expiresAtUtc: string;
  userId: string;
  email: string;
  displayName: string;
}

/**
 * Decode JWT payload (UTF-8). `atob` + JSON.parse breaks when claims contain non-ASCII
 * (e.g. display name), which made `exp` unreadable and dropped the Bearer token on every request.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function jwtExpiresAtMs(token: string): number | null {
  const json = decodeJwtPayload(token);
  if (!json) return null;
  const exp = json['exp'];
  if (typeof exp === 'number') return exp * 1000;
  if (typeof exp === 'string') {
    const n = Number(exp);
    return Number.isFinite(n) ? n * 1000 : null;
  }
  return null;
}

/** API may send UTC without `Z`; parsing as local time makes the session look expired early. */
function normalizeApiUtcString(iso: string): string {
  const s = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return `${s}Z`;
  }
  return s;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private static readonly storageKey = 'scribecount_auth';
  private readonly http = inject(HttpClient);
  private readonly activeSite = inject(ActiveSiteService);

  readonly user = signal<SessionUser | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private readonly expiresAtUtc = signal<string | null>(null);

  readonly displayName = computed(() => {
    const u = this.user();
    return u?.displayName?.trim() || u?.email?.trim() || 'Guest';
  });

  readonly email = computed(() => this.user()?.email?.trim() ?? '');

  readonly initials = computed(() => {
    const u = this.user();
    if (!u) return '?';
    const name = u.displayName?.trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
      return parts[0][0].toUpperCase();
    }
    const em = u.email?.trim();
    if (em) return em.slice(0, 2).toUpperCase();
    return '?';
  });

  constructor() {
    this.hydrate();
  }

  /** Clock skew: treat token as valid shortly after `exp` (client fast) or use slack when reading `exp`. */
  private static readonly expirySkewMs = 120_000;

  /**
   * Token sent on API calls. Send whenever we have a string unless JWT `exp` proves it is dead
   * (decode failures → still send; server validates).
   */
  getBearerToken(): string | null {
    const t = this.accessToken();
    if (!t) return null;
    const jwtEnd = jwtExpiresAtMs(t);
    if (jwtEnd != null && jwtEnd < Date.now() - AuthService.expirySkewMs) {
      return null;
    }
    return t;
  }

  isAuthenticated(): boolean {
    return this.sessionLooksValid();
  }

  /** Route guard: user + token, and not beyond expiry (JWT first, then API date string). */
  private sessionLooksValid(): boolean {
    const t = this.accessToken();
    if (!t || !this.user()?.email) return false;

    const jwtEnd = jwtExpiresAtMs(t);
    if (jwtEnd != null) {
      return jwtEnd > Date.now() - AuthService.expirySkewMs;
    }

    const expStr = this.expiresAtUtc();
    if (expStr) {
      const end = new Date(normalizeApiUtcString(expStr)).getTime();
      if (!Number.isNaN(end)) {
        return end > Date.now() - AuthService.expirySkewMs;
      }
    }
    return true;
  }

  private hydrate(): void {
    try {
      const raw = localStorage.getItem(AuthService.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredAuth;
      if (!parsed?.accessToken || !parsed?.email) return;
      this.accessToken.set(parsed.accessToken);
      this.expiresAtUtc.set(parsed.expiresAtUtc);
      this.user.set({
        email: parsed.email,
        displayName: parsed.displayName ?? '',
      });
    } catch {
      /* ignore */
    }
  }

  applyAuthResult(dto: AuthResultDto): void {
    this.accessToken.set(dto.accessToken);
    this.expiresAtUtc.set(dto.expiresAtUtc);
    this.user.set({
      email: dto.email,
      displayName: dto.displayName ?? '',
    });
    const payload: StoredAuth = {
      accessToken: dto.accessToken,
      expiresAtUtc: dto.expiresAtUtc,
      userId: dto.userId,
      email: dto.email,
      displayName: dto.displayName ?? '',
    };
    try {
      localStorage.setItem(AuthService.storageKey, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  /** Legacy: sync display name only (e.g. settings). */
  setSession(user: SessionUser): void {
    this.user.set({ displayName: user.displayName.trim(), email: user.email.trim() });
    const t = this.accessToken();
    const exp = this.expiresAtUtc();
    if (t && exp) {
      try {
        const raw = localStorage.getItem(AuthService.storageKey);
        const prev = raw ? (JSON.parse(raw) as StoredAuth) : null;
        const payload: StoredAuth = {
          accessToken: t,
          expiresAtUtc: exp,
          userId: prev?.userId ?? '',
          email: user.email.trim(),
          displayName: user.displayName.trim(),
        };
        localStorage.setItem(AuthService.storageKey, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    }
  }

  clearSession(): void {
    this.user.set(null);
    this.accessToken.set(null);
    this.expiresAtUtc.set(null);
    localStorage.removeItem(AuthService.storageKey);
    this.activeSite.clear();
  }

  login(email: string, password: string): Observable<AuthResultDto> {
    return this.http
      .post<AuthResultDto>('/api/Auth/login', { email, password })
      .pipe(
        tap(dto => this.applyAuthResult(dto)),
        catchError(err => throwError(() => err))
      );
  }

  signup(email: string, password: string, displayName: string): Observable<AuthResultDto> {
    return this.http
      .post<AuthResultDto>('/api/Auth/signup', { email, password, displayName })
      .pipe(
        tap(dto => this.applyAuthResult(dto)),
        catchError(err => throwError(() => err))
      );
  }
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() || email.trim();
  if (!local) return 'User';
  return local
    .replace(/[._-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/** Pathname for `/api/...` whether `req.url` is relative or absolute (e.g. after a base URL). */
function apiPathname(url: string): string {
  const noQuery = url.split('?')[0];
  if (noQuery.startsWith('http://') || noQuery.startsWith('https://')) {
    try {
      return new URL(noQuery).pathname.toLowerCase();
    } catch {
      return noQuery.toLowerCase();
    }
  }
  return noQuery.toLowerCase();
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const pathname = apiPathname(req.url);
  if (!pathname.startsWith('/api/')) {
    return next(req);
  }
  if (pathname.endsWith('/api/auth/login') || pathname.endsWith('/api/auth/signup')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.getBearerToken();
  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  );
};

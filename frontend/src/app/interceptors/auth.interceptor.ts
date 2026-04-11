import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
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
  const router = inject(Router);
  const token = auth.getBearerToken();
  const outReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        auth.clearSession();
        void router.navigate(['/login'], { replaceUrl: true });
      }
      return throwError(() => err);
    }),
  );
};

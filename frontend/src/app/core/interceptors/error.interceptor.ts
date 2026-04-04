import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthRefreshService } from '../services/auth-refresh.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authRefreshService = inject(AuthRefreshService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || shouldSkipRefresh(req)) {
        return throwError(() => error);
      }

      return authRefreshService.refreshAccessToken().pipe(
        switchMap((accessToken) =>
          next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${accessToken}`,
                'X-Refresh-Attempt': 'true',
              },
            }),
          ),
        ),
        catchError((refreshError) => throwError(() => refreshError)),
      );
    }),
  );
};

function shouldSkipRefresh(req: HttpRequest<unknown>): boolean {
  return (
    req.headers.has('X-Refresh-Attempt') ||
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/logout')
  );
}

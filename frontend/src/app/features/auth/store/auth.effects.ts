import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { TokenStorageService } from '../../../core/services/token-storage.service';
import { AuthApi } from '../data-access/auth.api';
import { AuthActions } from './auth.actions';

@Injectable()
export class AuthEffects {
  readonly register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.registerRequested),
      switchMap(({ payload }) =>
        this.authApi.register(payload).pipe(
          map((response) => AuthActions.authSucceeded({ response })),
          catchError((error) => of(AuthActions.authFailed({ message: this.resolveErrorMessage(error, 'Не удалось зарегистрировать пользователя.') }))),
        ),
      ),
    ),
  );

  readonly login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.loginRequested),
      switchMap(({ payload }) =>
        this.authApi.login(payload).pipe(
          map((response) => AuthActions.authSucceeded({ response })),
          catchError((error) => of(AuthActions.authFailed({ message: this.resolveErrorMessage(error, 'Не удалось выполнить вход.') }))),
        ),
      ),
    ),
  );

  readonly refresh$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.refreshRequested),
      switchMap(() =>
        this.authApi.refresh().pipe(
          map(({ accessToken }) => AuthActions.accessTokenRefreshed({ accessToken })),
          catchError(() => of(AuthActions.logoutCompleted())),
        ),
      ),
    ),
  );

  readonly logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logoutRequested),
      switchMap(() =>
        this.authApi.logout().pipe(
          map(() => AuthActions.logoutCompleted()),
          catchError(() => of(AuthActions.logoutCompleted())),
        ),
      ),
    ),
  );

  readonly persistTokenAfterAuth$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.authSucceeded),
        tap(({ response }) => this.tokenStorage.setAccessToken(response.accessToken)),
      ),
    { dispatch: false },
  );

  readonly persistRefreshedToken$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.accessTokenRefreshed),
        tap(({ accessToken }) => this.tokenStorage.setAccessToken(accessToken)),
      ),
    { dispatch: false },
  );

  readonly clearTokenOnLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutCompleted),
        tap(() => this.tokenStorage.clear()),
      ),
    { dispatch: false },
  );

  readonly navigateAfterAuth$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.authSucceeded),
        tap(() => {
          void this.router.navigate(['/search']);
        }),
      ),
    { dispatch: false },
  );

  readonly navigateAfterLogout$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AuthActions.logoutCompleted),
        tap(() => {
          void this.router.navigate(['/auth/login']);
        }),
      ),
    { dispatch: false },
  );

  constructor(
    private readonly actions$: Actions,
    private readonly authApi: AuthApi,
    private readonly tokenStorage: TokenStorageService,
    private readonly router: Router,
  ) {}

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = error.error?.message;

      if (Array.isArray(backendMessage)) {
        return backendMessage.join(', ');
      }

      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage;
      }
    }

    return fallback;
  }
}

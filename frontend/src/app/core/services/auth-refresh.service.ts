import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';

import { AuthActions } from '../../features/auth/store/auth.actions';
import { RefreshResponse } from '../../shared/models/auth.models';
import { API_CONFIG } from '../tokens/api-config.token';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private readonly apiConfig = inject(API_CONFIG);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly store = inject(Store);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));

  private refreshRequest$: Observable<string> | null = null;

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    this.refreshRequest$ = this.rawHttp
      .post<RefreshResponse>(`${this.apiConfig.baseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map(({ accessToken }) => accessToken),
        tap((accessToken) => {
          this.tokenStorage.setAccessToken(accessToken);
          this.store.dispatch(AuthActions.accessTokenRefreshed({ accessToken }));
        }),
        catchError((error) => {
          this.tokenStorage.clear();
          this.store.dispatch(AuthActions.logoutCompleted());
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshRequest$;
  }
}

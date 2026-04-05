import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import {
  EMPTY,
  catchError,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  retry,
  switchMap,
  timer,
} from 'rxjs';

import { SearchApi } from '../data-access/search.api';
import { TelemetryApi } from '../data-access/telemetry.api';
import { SearchActions } from './search.actions';

@Injectable()
export class SearchEffects {
  readonly suggestions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.suggestionsRequested),
      distinctUntilChanged((a, b) => a.query === b.query),
      debounceTime(280),
      switchMap(({ query }) => {
        const trimmed = query.trim();
        if (!trimmed) {
          return of(SearchActions.suggestionsLoaded({ suggestions: [] }));
        }
        return this.searchApi.suggest(query).pipe(
          map((suggestions) => SearchActions.suggestionsLoaded({ suggestions })),
          catchError(() => of(SearchActions.suggestionsLoaded({ suggestions: [] }))),
        );
      }),
    ),
  );

  readonly search$ = createEffect(() =>
    this.actions$.pipe(
      ofType(SearchActions.searchRequested),
      switchMap(({ query }) =>
        this.searchApi.search(query).pipe(
          map((response) => SearchActions.searchLoaded({ response })),
          catchError((error) => of(SearchActions.failureReceived({ message: this.resolveErrorMessage(error, 'Не удалось выполнить поиск.') }))),
        ),
      ),
    ),
  );

  readonly telemetry$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(SearchActions.telemetryFlushRequested),
        concatMap(({ payload }) =>
          this.telemetryApi.flush(payload).pipe(
            retry({ count: 2, delay: () => timer(500) }),
            catchError(() => EMPTY),
          ),
        ),
      ),
    { dispatch: false },
  );

  constructor(
    private readonly actions$: Actions,
    private readonly searchApi: SearchApi,
    private readonly telemetryApi: TelemetryApi,
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

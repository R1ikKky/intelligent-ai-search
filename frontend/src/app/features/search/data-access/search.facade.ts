import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';

import { TelemetryBatchRequest } from '../../../shared/models/telemetry.models';
import { selectSearchError, selectSearchLoading, selectSearchResponse, selectSuggestions } from '../store/search.selectors';
import { SearchActions } from '../store/search.actions';

@Injectable({ providedIn: 'root' })
export class SearchFacade {
  private readonly store = inject(Store);

  readonly suggestions$ = this.store.select(selectSuggestions);
  readonly response$ = this.store.select(selectSearchResponse);
  readonly loading$ = this.store.select(selectSearchLoading);
  readonly error$ = this.store.select(selectSearchError);

  requestSuggestions(query: string): void {
    this.store.dispatch(SearchActions.suggestionsRequested({ query }));
  }

  search(query: string): void {
    this.store.dispatch(SearchActions.searchRequested({ query }));
  }

  flushTelemetry(payload: TelemetryBatchRequest): void {
    this.store.dispatch(SearchActions.telemetryFlushRequested({ payload }));
  }
}

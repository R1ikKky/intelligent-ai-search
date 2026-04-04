import { createReducer, on } from '@ngrx/store';

import { SearchResponse, SearchSuggestion } from '../../../shared/models/search.models';
import { SearchActions } from './search.actions';

export interface SearchState {
  readonly suggestions: readonly SearchSuggestion[];
  readonly response: SearchResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialSearchState: SearchState = {
  suggestions: [],
  response: null,
  loading: false,
  error: null,
};

export const searchReducer = createReducer(
  initialSearchState,
  on(SearchActions.suggestionsRequested, SearchActions.searchRequested, (state) => ({
    ...state,
    loading: true,
    error: null,
  })),
  on(SearchActions.suggestionsLoaded, (state, { suggestions }) => ({
    ...state,
    suggestions,
    loading: false,
  })),
  on(SearchActions.searchLoaded, (state, { response }) => ({
    ...state,
    response,
    suggestions: [],
    loading: false,
  })),
  on(SearchActions.failureReceived, (state, { message }) => ({
    ...state,
    loading: false,
    error: message,
  })),
);

import { createFeatureSelector, createSelector } from '@ngrx/store';

import { SearchState } from './search.reducer';

export const selectSearchState = createFeatureSelector<SearchState>('search');

export const selectSuggestions = createSelector(selectSearchState, (state) => state.suggestions);
export const selectSearchResponse = createSelector(selectSearchState, (state) => state.response);
export const selectSearchLoading = createSelector(selectSearchState, (state) => state.loading);
export const selectSearchError = createSelector(selectSearchState, (state) => state.error);

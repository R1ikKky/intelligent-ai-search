import { createFeatureSelector, createSelector } from '@ngrx/store';

import { AuthState } from './auth.reducer';

export const selectAuthState = createFeatureSelector<AuthState>('auth');

export const selectAuthIdentity = createSelector(selectAuthState, (state) => state.identity);
export const selectAuthAccessToken = createSelector(selectAuthState, (state) => state.accessToken);
export const selectIsAuthenticated = createSelector(selectAuthAccessToken, (accessToken) => Boolean(accessToken));
export const selectAuthLoading = createSelector(selectAuthState, (state) => state.loading);
export const selectAuthError = createSelector(selectAuthState, (state) => state.error);
export const selectUserProfile = createSelector(selectAuthState, (state) => state.profile);
export const selectCustomerRegion = createSelector(selectUserProfile, (profile) => profile?.customerRegion ?? null);
export const selectCustomerName = createSelector(selectUserProfile, (profile) => profile?.customerName ?? null);

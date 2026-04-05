import { createReducer, on } from '@ngrx/store';

import { AuthIdentity, UserProfile } from '../../../shared/models/auth.models';
import { AuthActions } from './auth.actions';

export interface AuthState {
  readonly identity: AuthIdentity | null;
  readonly accessToken: string | null;
  readonly profile: UserProfile | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export const initialAuthState: AuthState = {
  identity: null,
  accessToken: null,
  profile: null,
  loading: false,
  error: null,
};

export const authReducer = createReducer(
  initialAuthState,
  on(
    AuthActions.registerRequested,
    AuthActions.loginRequested,
    AuthActions.refreshRequested,
    AuthActions.customerRegionUpdateRequested,
    (state) => ({
      ...state,
      loading: true,
      error: null,
    }),
  ),
  on(AuthActions.loadProfileRequested, (state) => ({
    ...state,
    error: null,
  })),
  on(AuthActions.authSucceeded, (state, { response }) => ({
    ...state,
    identity: {
      customerId: response.customerId,
      login: response.login,
    },
    accessToken: response.accessToken,
    loading: false,
    error: null,
  })),
  on(AuthActions.accessTokenRefreshed, (state, { accessToken }) => ({
    ...state,
    accessToken,
    loading: false,
    error: null,
  })),
  on(AuthActions.profileLoaded, (state, { profile }) => ({
    ...state,
    profile,
    loading: false,
    error: null,
  })),
  on(AuthActions.authFailed, (state, { message }) => ({
    ...state,
    loading: false,
    error: message,
  })),
  on(AuthActions.logoutCompleted, () => initialAuthState),
);

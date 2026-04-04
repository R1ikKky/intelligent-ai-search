import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '../../../shared/models/auth.models';

export const AuthActions = createActionGroup({
  source: 'Auth',
  events: {
    'Register Requested': props<{ payload: RegisterRequest }>(),
    'Login Requested': props<{ payload: LoginRequest }>(),
    'Auth Succeeded': props<{ response: AuthResponse }>(),
    'Access Token Refreshed': props<{ accessToken: string }>(),
    'Auth Failed': props<{ message: string }>(),
    'Profile Loaded': props<{ profile: UserProfile }>(),
    'Refresh Requested': emptyProps(),
    'Logout Requested': emptyProps(),
    'Logout Completed': emptyProps(),
  },
});

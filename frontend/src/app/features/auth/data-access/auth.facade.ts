import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';

import { LoginRequest, RegisterRequest } from '../../../shared/models/auth.models';
import { AuthActions } from '../store/auth.actions';
import { selectAuthError, selectAuthLoading, selectCustomerName, selectCustomerRegion, selectIsAuthenticated, selectUserProfile } from '../store/auth.selectors';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly store = inject(Store);

  readonly isAuthenticated$ = this.store.select(selectIsAuthenticated);
  readonly loading$ = this.store.select(selectAuthLoading);
  readonly error$ = this.store.select(selectAuthError);
  readonly profile$ = this.store.select(selectUserProfile);
  readonly customerRegion$ = this.store.select(selectCustomerRegion);
  readonly customerName$ = this.store.select(selectCustomerName);

  register(payload: RegisterRequest): void {
    this.store.dispatch(AuthActions.registerRequested({ payload }));
  }

  login(payload: LoginRequest): void {
    this.store.dispatch(AuthActions.loginRequested({ payload }));
  }

  refresh(): void {
    this.store.dispatch(AuthActions.refreshRequested());
  }

  loadProfile(): void {
    this.store.dispatch(AuthActions.loadProfileRequested());
  }

  updateCustomerRegion(region: string): void {
    this.store.dispatch(AuthActions.customerRegionUpdateRequested({ region }));
  }

  logout(): void {
    this.store.dispatch(AuthActions.logoutRequested());
  }
}

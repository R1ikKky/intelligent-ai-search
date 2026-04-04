import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { AuthResponse, LoginRequest, RefreshResponse, RegisterRequest, UserProfile } from '../../../shared/models/auth.models';

interface BackendRegisterRequest {
  readonly inn: string;
  readonly password: string;
  readonly orgName: string;
  readonly location: string;
}

interface BackendLoginRequest {
  readonly inn: string;
  readonly password: string;
}

interface BackendAuthResponse {
  readonly accessToken: string;
  readonly customerId: string;
  readonly login: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  constructor(private readonly http: HttpClient) {}

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>('/auth/register', this.mapRegisterPayload(payload), {
        withCredentials: true,
      })
      .pipe(map((response) => this.mapAuthResponse(response)));
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<BackendAuthResponse>('/auth/login', this.mapLoginPayload(payload), {
        withCredentials: true,
      })
      .pipe(map((response) => this.mapAuthResponse(response)));
  }

  refresh(): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>('/auth/refresh', {}, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>('/auth/logout', {}, { withCredentials: true });
  }

  me(): Observable<UserProfile> {
    return this.http.get<UserProfile>('/auth/me', { withCredentials: true });
  }

  private mapRegisterPayload(payload: RegisterRequest): BackendRegisterRequest {
    return {
      inn: payload.customerInn,
      password: payload.password,
      orgName: payload.customerName,
      location: payload.customerRegion,
    };
  }

  private mapLoginPayload(payload: LoginRequest): BackendLoginRequest {
    return {
      inn: payload.customerInn,
      password: payload.password,
    };
  }

  private mapAuthResponse(response: BackendAuthResponse): AuthResponse {
    return {
      accessToken: response.accessToken,
      customerId: response.customerId,
      login: response.login,
    };
  }
}

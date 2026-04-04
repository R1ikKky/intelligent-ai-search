import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'hackaton.access.jwt';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  setAccessToken(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TelemetrySessionService {
  private currentSearchSessionId: string | null = null;

  getSearchSessionId(): string | null {
    return this.currentSearchSessionId;
  }

  ensureSearchSessionId(): string {
    if (!this.currentSearchSessionId) {
      this.currentSearchSessionId = this.generateId();
    }

    return this.currentSearchSessionId;
  }

  startSearchSession(searchSessionId?: string): string {
    this.currentSearchSessionId = searchSessionId ?? this.generateId();
    return this.currentSearchSessionId;
  }

  clearSearchSession(): void {
    this.currentSearchSessionId = null;
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

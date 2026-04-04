import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import { TelemetryBatchRequest, TelemetryEvent } from '../../../shared/models/telemetry.models';

interface BackendTelemetryEvent {
  readonly event_id: string;
  readonly event_type: string;
  readonly search_query_id?: string;
  readonly ste_id?: string;
  readonly event_at: string;
  readonly dwell_ms?: number;
  readonly active_time_ms?: number;
  readonly payload?: Record<string, unknown>;
}

interface BackendTelemetryBatchRequest {
  readonly session_id: string;
  readonly events: readonly BackendTelemetryEvent[];
}

@Injectable({ providedIn: 'root' })
export class TelemetryApi {
  constructor(private readonly http: HttpClient) {}

  flush(payload: TelemetryBatchRequest): Observable<void> {
    if (!payload.events.length) {
      return of(void 0);
    }

    // return this.http.post<unknown>('/events/bulk', this.mapBatch(payload)).pipe(map(() => void 0));
    return of(void 0);
  }

  private mapBatch(payload: TelemetryBatchRequest): BackendTelemetryBatchRequest {
    return {
      session_id: payload.sessionId,
      events: payload.events.map((event) => this.mapEvent(event)),
    };
  }

  private mapEvent(event: TelemetryEvent): BackendTelemetryEvent {
    return {
      event_id: event.eventId,
      event_type: event.eventType,
      search_query_id: event.searchQueryId,
      ste_id: event.steId,
      event_at: event.eventAt,
      dwell_ms: event.dwellMs,
      active_time_ms: event.activeTimeMs,
      payload: event.payload,
    };
  }
}

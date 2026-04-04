export interface TelemetryEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly searchQueryId?: string;
  readonly steId?: string;
  readonly eventAt: string;
  readonly dwellMs?: number;
  readonly activeTimeMs?: number;
  readonly payload?: Record<string, unknown>;
}

export interface TelemetryBatchRequest {
  readonly sessionId: string;
  readonly events: readonly TelemetryEvent[];
}
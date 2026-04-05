/** Типы событий, обрабатываемые бэкендом (ingest) и клиентом. */
export const TelemetryEventType = {
  searchSubmit: 'search_submit',
  suggestionSelected: 'suggestion_selected',
  productCardClick: 'product_card_click',
  searchQuickRefine: 'search_quick_refine',
  searchCardDeepInterest: 'search_card_deep_interest',
  stePageEnter: 'ste_page_enter',
  stePageLeave: 'ste_page_leave',
  steProductLongEngaged: 'ste_product_long_engaged',
} as const;

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
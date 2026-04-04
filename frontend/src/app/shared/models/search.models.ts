export interface SearchSuggestion {
  readonly text: string;
  readonly kind: string;
  readonly flags: readonly string[];
  readonly score: number;
}

export interface SearchResultItem {
  readonly id: string;
  readonly externalId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly unit: string;
  readonly price?: number;
  readonly score: number;
  readonly personalizedScore: number;
  readonly isPersonalized: boolean;
}

export interface SearchResponse {
  readonly queryId: string;
  readonly originalQuery: string;
  readonly normalizedQuery: string;
  readonly correctedQuery?: string;
  readonly corrections: readonly SearchSuggestion[];
  readonly recommendations: readonly SearchSuggestion[];
  readonly items: readonly SearchResultItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

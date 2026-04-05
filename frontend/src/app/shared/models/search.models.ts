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

export interface SteCardManufacturer {
  readonly inn: string;
  readonly name: string;
}

export interface SteCardItem {
  readonly steId: string;
  readonly name: string;
  readonly category: string;
  readonly attributes: string;
  readonly score: number;
  readonly scoreNorm: number;
  readonly personalizationMult?: number;
}

export interface SteCard {
  readonly manufacturer: SteCardManufacturer | null;
  readonly confidence: number;
  readonly items: readonly SteCardItem[];
}

export interface SearchResponse {
  readonly queryId: string;
  readonly originalQuery: string;
  readonly normalizedQuery: string;
  readonly correctedQuery?: string;
  readonly corrections: readonly SearchSuggestion[];
  readonly recommendations: readonly SearchSuggestion[];
  readonly items: readonly SearchResultItem[];
  /** Группы СТЕ по производителю / смысловой близости (бэкенд GET /products/search). */
  readonly cards?: readonly SteCard[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

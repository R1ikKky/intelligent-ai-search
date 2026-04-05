import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, of } from 'rxjs';

import {
  SearchResponse,
  SearchResultItem,
  SearchSuggestion,
  SteCard,
} from '../../../shared/models/search.models';

export interface SteProductDetail {
  readonly steId: string;
  readonly name: string;
  readonly category: string;
  readonly attributes: string;
  readonly supplierInn: string;
  readonly supplierName: string;
}

interface BackendSearchResponse {
  readonly items: readonly SearchResultItem[];
  readonly cards?: readonly SteCard[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly suggestion: string | null;
}

interface BackendSuggestResponse {
  readonly suggestions: readonly SearchSuggestion[];
}

@Injectable({ providedIn: 'root' })
export class SearchApi {
  constructor(private readonly http: HttpClient) {}

  getSteById(steId: string): Observable<SteProductDetail | null> {
    const id = steId.trim();
    if (!id) {
      return of(null);
    }
    return this.http.get<SteProductDetail>(`/products/ste/${encodeURIComponent(id)}`);
  }

  suggest(query: string): Observable<readonly SearchSuggestion[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return of([]);
    }

    const params = new HttpParams().set('q', normalizedQuery).set('limit', '12');

    return this.http.get<BackendSuggestResponse>('/products/suggest', { params }).pipe(
      map((response) => this.dedupeSuggestions(response.suggestions ?? [])),
    );
  }

  private dedupeSuggestions(items: readonly SearchSuggestion[]): SearchSuggestion[] {
    const seen = new Set<string>();
    const out: SearchSuggestion[] = [];
    for (const s of items) {
      const key = this.suggestionNormKey(s.text);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push({
        text: s.text.trim(),
        kind: s.kind,
        flags: [...(s.flags ?? [])],
        score: typeof s.score === 'number' ? s.score : 0,
      });
    }
    return out;
  }

  private suggestionNormKey(text: string): string {
    return text
      .trim()
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  search(query: string): Observable<SearchResponse> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return of({
        queryId: 'empty-query',
        originalQuery: query,
        normalizedQuery,
        corrections: [],
        recommendations: [],
        items: [],
        cards: [],
        total: 0,
        page: 1,
        limit: 20,
      });
    }

    const params = new HttpParams()
      .set('q', normalizedQuery)
      .set('page', '1')
      .set('limit', '20');

    return this.http
      .get<BackendSearchResponse>('/products/search', { params })
      .pipe(map((response) => this.mapSearchResponse(query, response)));
  }

  private mapSearchResponse(originalQuery: string, response: BackendSearchResponse): SearchResponse {
    const correctedQuery = response.suggestion ?? undefined;

    return {
      queryId: this.buildQueryId(originalQuery, response.page),
      originalQuery,
      normalizedQuery: originalQuery.trim(),
      correctedQuery,
      corrections: correctedQuery
        ? [
            {
              text: correctedQuery,
              kind: 'spellfix',
              flags: ['server_suggestion'],
              score: 1,
            },
          ]
        : [],
      recommendations: [],
      items: response.items,
      cards: response.cards,
      total: response.total,
      page: response.page,
      limit: response.limit,
    };
  }

  private buildQueryId(query: string, page: number): string {
    const normalized = query.trim().replace(/\s+/g, '-').toLowerCase() || 'query';
    const suffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${normalized}-${page}-${suffix}`;
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

import { SearchResponse, SearchResultItem, SearchSuggestion } from '../../../shared/models/search.models';

interface BackendSuggestItem {
  readonly text: string;
  readonly kind: string;
}

interface BackendSuggestResponse {
  readonly normalized_query: string;
  readonly items: readonly BackendSuggestItem[];
}

interface BackendSearchResponse {
  readonly items: readonly SearchResultItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly suggestion: string | null;
}

@Injectable({ providedIn: 'root' })
export class SearchApi {
  constructor(private readonly http: HttpClient) {}

  suggest(query: string): Observable<readonly SearchSuggestion[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return of([]);
    }

    // return this.http
    //   .post<BackendSuggestResponse>('/search/suggest', {
    //     query: normalizedQuery,
    //     limit: 8,
    //   })
    //   .pipe(map((response) => response.items.map((item) => this.mapSuggestion(item))));
    return of([]);
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
        total: 0,
        page: 1,
        limit: 20,
      });
    }

    // const params = new HttpParams().set('q', normalizedQuery).set('page', '1').set('limit', '20');
    // return this.http
    //   .get<BackendSearchResponse>('/products/search', { params })
    //   .pipe(map((response) => this.mapSearchResponse(query, response)));
    return of({
      queryId: this.buildQueryId(query, 1),
      originalQuery: query,
      normalizedQuery: query.trim(),
      corrections: [],
      recommendations: [],
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  }

  private mapSuggestion(item: BackendSuggestItem): SearchSuggestion {
    return {
      text: item.text,
      kind: item.kind,
      flags: item.kind ? [item.kind] : [],
      score: 0,
    };
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
      total: response.total,
      page: response.page,
      limit: response.limit,
    };
  }

  private buildQueryId(query: string, page: number): string {
    const normalized = query.trim().replace(/\s+/g, '-').toLowerCase() || 'query';
    const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${normalized}-${page}-${suffix}`;
  }
}

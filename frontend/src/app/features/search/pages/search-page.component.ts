import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { TelemetrySessionService } from '../../../core/services/telemetry-session.service';
import { SearchResultItem } from '../../../shared/models/search.models';
import { TelemetryEvent } from '../../../shared/models/telemetry.models';
import { ResultsGroupListComponent } from '../components/results-group-list.component';
import { SearchSuggestionsComponent } from '../components/search-suggestions.component';
import { SearchToolbarComponent } from '../components/search-toolbar.component';
import { SearchFacade } from '../data-access/search.facade';

const QUICK_REFINE_MAX_MS = 4000;
const QUICK_REFINE_MAX_SEEN = 4;

@Component({
  standalone: true,
  selector: 'app-search-page',
  imports: [AsyncPipe, SearchToolbarComponent, SearchSuggestionsComponent, ResultsGroupListComponent],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
  private readonly searchFacade = inject(SearchFacade);
  private readonly telemetrySession = inject(TelemetrySessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly currentQuery = signal('');
  readonly suggestions$ = this.searchFacade.suggestions$;
  readonly response$ = this.searchFacade.response$;
  readonly loading$ = this.searchFacade.loading$;
  readonly error$ = this.searchFacade.error$;

  private lastImpression: { loadedAt: number; queryId: string; seen: Set<string> } | null = null;

  constructor() {
    this.telemetrySession.ensureSearchSessionId();

    this.searchFacade.response$.pipe(takeUntilDestroyed()).subscribe((r) => {
      if (!r || r.queryId === 'empty-query') {
        return;
      }
      this.lastImpression = {
        loadedAt: Date.now(),
        queryId: r.queryId,
        seen: new Set(),
      };
    });

    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      const q = String(params['q'] ?? '').trim();
      if (!q) {
        return;
      }
      this.maybeEmitSearchQuickRefine();
      this.currentQuery.set(q);
      if (q.length >= 3) {
        this.searchFacade.requestSuggestions(q);
      } else {
        this.searchFacade.requestSuggestions('');
      }
      this.searchFacade.search(q);
    });
  }

  onQueryChanged(query: string): void {
    this.currentQuery.set(query);

    const trimmed = query.trim();
    if (trimmed.length < 3) {
      this.searchFacade.requestSuggestions('');
      return;
    }

    this.searchFacade.requestSuggestions(query);
  }

  onSearchSubmitted(query: string): void {
    this.executeSearch(query, 'manual');
  }

  onSuggestionSelected(query: string): void {
    this.emitTelemetryEvent('suggestion_selected', {
      text: query,
    });
    this.executeSearch(query, 'suggestion');
  }

  onResultSelected(item: SearchResultItem): void {
    this.emitTelemetryEvent(
      'product_card_click',
      {
        productId: item.id,
        externalId: item.externalId,
        name: item.name,
      },
      item.externalId || item.id,
    );
    void this.router.navigate(['/ste', item.externalId || item.id]);
  }

  onQualifiedCardView(steId: string): void {
    this.lastImpression?.seen.add(steId);
  }

  onDeepCardInterest(ev: { readonly steId: string }): void {
    const qid = this.lastImpression?.queryId;
    this.emitTelemetryEvent('search_card_deep_interest', { steId: ev.steId }, ev.steId, qid);
  }

  private executeSearch(query: string, source: 'manual' | 'suggestion'): void {
    const trimmed = query.trim();
    if (trimmed) {
      this.maybeEmitSearchQuickRefine();
    }
    this.currentQuery.set(query);
    this.searchFacade.requestSuggestions('');
    this.searchFacade.search(query);

    if (!trimmed) {
      return;
    }

    this.emitTelemetryEvent('search_submit', {
      query,
      source,
    });
  }

  private maybeEmitSearchQuickRefine(): void {
    const imp = this.lastImpression;
    if (!imp || imp.loadedAt <= 0) {
      return;
    }
    const elapsed = Date.now() - imp.loadedAt;
    if (elapsed >= QUICK_REFINE_MAX_MS) {
      return;
    }
    if (imp.seen.size >= QUICK_REFINE_MAX_SEEN) {
      return;
    }
    this.emitTelemetryEvent(
      'search_quick_refine',
      {
        seenSteIds: [...imp.seen],
        dwellMs: elapsed,
        cardsSeenCount: imp.seen.size,
      },
      undefined,
      imp.queryId,
    );
  }

  private emitTelemetryEvent(
    eventType: string,
    payload: Record<string, unknown>,
    steId?: string,
    searchQueryId?: string,
  ): void {
    const event: TelemetryEvent = {
      eventId: this.generateId(),
      eventType,
      steId,
      searchQueryId,
      eventAt: new Date().toISOString(),
      payload,
    };

    this.searchFacade.flushTelemetry({
      sessionId: this.telemetrySession.ensureSearchSessionId(),
      events: [event],
    });
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

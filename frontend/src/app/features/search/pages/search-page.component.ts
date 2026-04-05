import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { TelemetrySessionService } from '../../../core/services/telemetry-session.service';
import { SearchResultItem } from '../../../shared/models/search.models';
import { TelemetryEvent } from '../../../shared/models/telemetry.models';
import { PaginationComponent } from '../../../shared/ui/pagination/pagination.component';
import { ResultsGroupListComponent } from '../components/results-group-list.component';
import { SearchSuggestionsComponent } from '../components/search-suggestions.component';
import { SearchToolbarComponent } from '../components/search-toolbar.component';
import { SearchFacade } from '../data-access/search.facade';

const QUICK_REFINE_MAX_MS = 4000;
const QUICK_REFINE_MAX_SEEN = 4;

@Component({
  standalone: true,
  selector: 'app-search-page',
  imports: [AsyncPipe, SearchToolbarComponent, SearchSuggestionsComponent, ResultsGroupListComponent, PaginationComponent],
  templateUrl: './search-page.component.html',
  styleUrl: './search-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchPageComponent {
  private readonly searchFacade = inject(SearchFacade);
  private readonly telemetrySession = inject(TelemetrySessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly resultsTop = viewChild<ElementRef<HTMLElement>>('resultsTop');

  readonly currentQuery = signal('');
  readonly currentPage = signal(1);
  readonly suggestionsDismissed = signal(true);
  readonly suggestions$ = this.searchFacade.suggestions$;
  readonly response$ = this.searchFacade.response$;
  readonly loading$ = this.searchFacade.loading$;
  readonly error$ = this.searchFacade.error$;

  private lastImpression: { loadedAt: number; queryId: string; seen: Set<string> } | null = null;
  private pendingResultsScroll = false;

  constructor() {
    this.telemetrySession.ensureSearchSessionId();

    this.searchFacade.response$.pipe(takeUntilDestroyed()).subscribe((r) => {
      if (!r || r.queryId === 'empty-query') {
        return;
      }

      const normalizedPage = this.normalizeResponsePage(r.page, r.total, r.limit);
      if (normalizedPage !== this.currentPage()) {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { page: normalizedPage },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
        return;
      }

      this.lastImpression = {
        loadedAt: Date.now(),
        queryId: r.queryId,
        seen: new Set(),
      };

      if (this.pendingResultsScroll) {
        this.pendingResultsScroll = false;
        afterNextRender(() => this.scrollResultsToTop('auto'), { injector: this.injector });
      }
    });

    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      const q = String(params['q'] ?? '').trim();
      const page = this.normalizePage(params['page']);
      if (!q) {
        return;
      }

      const queryChanged = q !== this.currentQuery();
      const pageChangedByUrl = page !== this.currentPage();

      this.currentQuery.set(q);
      this.currentPage.set(page);

      if (queryChanged || pageChangedByUrl) {
        this.suggestionsDismissed.set(true);
      }

      if (queryChanged) {
        if (q.length >= 3) {
          this.searchFacade.requestSuggestions(q);
        } else {
          this.searchFacade.requestSuggestions('');
        }
      }

      if (queryChanged || pageChangedByUrl) {
        this.maybeEmitSearchQuickRefine();
        this.scheduleResultsScroll();
        this.searchFacade.search(q, page);
      }
    });
  }

  onQueryChanged(query: string): void {
    if (query !== this.currentQuery()) {
      this.suggestionsDismissed.set(false);
    }

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
    this.suggestionsDismissed.set(true);
    this.emitTelemetryEvent('suggestion_selected', {
      text: query,
    });
    this.executeSearch(query, 'suggestion');
  }

  onSuggestionsHideRequested(): void {
    this.suggestionsDismissed.set(true);
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

  onPageChanged(page: number): void {
    const normalizedPage = this.normalizePage(page);
    if (!this.currentQuery().trim() || normalizedPage === this.currentPage()) {
      return;
    }

    this.suggestionsDismissed.set(true);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: normalizedPage },
      queryParamsHandling: 'merge',
    });
  }

  private executeSearch(query: string, source: 'manual' | 'suggestion'): void {
    const trimmed = query.trim();
    if (trimmed) {
      this.maybeEmitSearchQuickRefine();
    }
    this.currentQuery.set(trimmed);
    this.suggestionsDismissed.set(true);
    this.searchFacade.requestSuggestions('');
    if (!trimmed) {
      return;
    }

    const routeQuery = String(this.route.snapshot.queryParamMap.get('q') ?? '').trim();
    const routePage = this.normalizePage(this.route.snapshot.queryParamMap.get('page'));

    if (trimmed === routeQuery && routePage === 1) {
      this.scheduleResultsScroll();
      this.searchFacade.search(trimmed, 1);
    } else {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { q: trimmed, page: 1 },
        queryParamsHandling: 'merge',
      });
    }

    this.emitTelemetryEvent('search_submit', {
      query: trimmed,
      source,
    });
  }

  private scheduleResultsScroll(): void {
    this.pendingResultsScroll = true;
    this.scrollResultsToTop('smooth');
  }

  private scrollResultsToTop(behavior: ScrollBehavior): void {
    if (typeof window === 'undefined') {
      return;
    }

    const anchor = this.resultsTop()?.nativeElement;
    if (!anchor) {
      return;
    }

    const stickyHeaderOffset = 76;
    const top = Math.max(0, anchor.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset);
    window.scrollTo({ top, behavior });
  }

  private normalizePage(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return 1;
    }

    return Math.max(1, Math.trunc(parsed));
  }

  private normalizeResponsePage(page: number, total: number, limit: number): number {
    const normalizedLimit = Math.max(1, this.normalizePage(limit));
    const lastPage = Math.max(1, Math.ceil(Math.max(0, total) / normalizedLimit));

    return Math.min(this.normalizePage(page), lastPage);
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

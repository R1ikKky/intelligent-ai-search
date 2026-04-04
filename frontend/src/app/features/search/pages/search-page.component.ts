import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { TelemetrySessionService } from '../../../core/services/telemetry-session.service';
import { SearchResultItem } from '../../../shared/models/search.models';
import { TelemetryEvent } from '../../../shared/models/telemetry.models';
import { ResultsGroupListComponent } from '../components/results-group-list.component';
import { SearchSuggestionsComponent } from '../components/search-suggestions.component';
import { SearchToolbarComponent } from '../components/search-toolbar.component';
import { SearchFacade } from '../data-access/search.facade';

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

  readonly currentQuery = signal('');
  readonly suggestions$ = this.searchFacade.suggestions$;
  readonly response$ = this.searchFacade.response$;
  readonly loading$ = this.searchFacade.loading$;
  readonly error$ = this.searchFacade.error$;

  constructor() {
    this.telemetrySession.ensureSearchSessionId();
  }

  onQueryChanged(query: string): void {
    this.currentQuery.set(query);

    if (query.trim().length < 2) {
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
  }

  private executeSearch(query: string, source: 'manual' | 'suggestion'): void {
    this.currentQuery.set(query);
    this.searchFacade.requestSuggestions('');
    this.searchFacade.search(query);

    if (!query.trim()) {
      return;
    }

    this.emitTelemetryEvent('search_submit', {
      query,
      source,
    });
  }

  private emitTelemetryEvent(eventType: string, payload: Record<string, unknown>, steId?: string): void {
    const event: TelemetryEvent = {
      eventId: this.generateId(),
      eventType,
      steId,
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

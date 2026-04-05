import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SearchSuggestion } from '../../../shared/models/search.models';

@Component({
  standalone: true,
  selector: 'app-search-suggestions',
  templateUrl: './search-suggestions.component.html',
  styleUrl: './search-suggestions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSuggestionsComponent {
  readonly suggestions = input<readonly SearchSuggestion[]>([]);
  readonly dismissed = input(false);
  readonly suggestionSelected = output<string>();
  readonly hideRequested = output<void>();

  selectSuggestion(text: string): void {
    this.suggestionSelected.emit(text);
  }

  hide(): void {
    this.hideRequested.emit();
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SearchResponse, SearchResultItem, SteCardItem } from '../../../shared/models/search.models';
import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';

@Component({
  standalone: true,
  selector: 'app-results-group-list',
  imports: [SectionCardComponent],
  templateUrl: './results-group-list.component.html',
  styleUrl: './results-group-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsGroupListComponent {
  readonly response = input<SearchResponse | null>(null);
  readonly itemSelected = output<SearchResultItem>();

  selectItem(item: SearchResultItem): void {
    this.itemSelected.emit(item);
  }

  steToResultItem(it: SteCardItem): SearchResultItem {
    return {
      id: it.steId,
      externalId: it.steId,
      name: it.name,
      description: it.attributes,
      category: it.category,
      unit: '',
      score: it.score,
      personalizedScore: it.score,
      isPersonalized: false,
    };
  }
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SearchResponse, SearchResultItem } from '../../../shared/models/search.models';
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
}

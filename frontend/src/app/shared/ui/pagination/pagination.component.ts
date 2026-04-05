import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type PageItem = number | '...';

@Component({
  standalone: true,
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly limit = input<number>(20);

  readonly pageChange = output<number>();

  readonly totalPages = computed(() => {
    const limit = this.normalizePositiveInt(this.limit());
    const total = Number.isFinite(this.total()) ? Math.max(0, this.total()) : 0;

    return Math.max(1, Math.ceil(total / limit));
  });

  readonly currentPage = computed(() => Math.min(this.normalizePositiveInt(this.page()), this.totalPages()));

  readonly pages = computed<PageItem[]>(() => this.buildPages(this.currentPage(), this.totalPages()));

  goTo(page: number): void {
    const clamped = Math.min(this.normalizePositiveInt(page), this.totalPages());
    if (clamped !== this.currentPage()) {
      this.pageChange.emit(clamped);
    }
  }

  isEllipsis(item: PageItem): item is '...' {
    return item === '...';
  }

  private normalizePositiveInt(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.max(1, Math.trunc(value));
  }

  private buildPages(current: number, total: number): PageItem[] {
    if (total <= 1) {
      return [1];
    }

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: PageItem[] = [1];

    if (current <= 3) {
      pages.push(2, 3);
      if (total > 4) {
        pages.push('...');
      }
    } else if (current >= total - 2) {
      pages.push('...');
      pages.push(total - 2, total - 1);
    } else {
      pages.push('...');
      pages.push(current - 1, current, current + 1);
      pages.push('...');
    }

    pages.push(total);

    return pages;
  }
}

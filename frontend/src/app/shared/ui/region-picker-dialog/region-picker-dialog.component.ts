import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { REGIONS } from '../../data/regions';

@Component({
  standalone: true,
  selector: 'app-region-picker-dialog',
  templateUrl: './region-picker-dialog.component.html',
  styleUrl: './region-picker-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegionPickerDialogComponent {
  private readonly injector = inject(Injector);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly open = input(false);
  readonly currentRegion = input<string | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);

  readonly closeRequested = output<void>();
  readonly confirmRequested = output<string>();

  readonly query = signal('');
  readonly selectedRegion = signal('');

  readonly filteredRegions = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (!query) {
      return [...REGIONS];
    }

    return REGIONS.filter((region) => region.toLowerCase().includes(query));
  });

  readonly canConfirm = computed(() => {
    const selected = this.selectedRegion().trim();
    return Boolean(selected) && selected !== (this.currentRegion()?.trim() ?? '') && !this.loading();
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }

      this.query.set('');
      this.selectedRegion.set(this.currentRegion()?.trim() ?? '');
      afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  onQueryInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.query.set(input?.value ?? '');
  }

  applyFilter(): void {
    const selected = this.selectedRegion();
    if (selected && !this.filteredRegions().includes(selected)) {
      this.selectedRegion.set('');
    }
  }

  selectRegion(region: string): void {
    this.selectedRegion.set(region);
  }

  confirm(): void {
    if (this.canConfirm()) {
      this.confirmRequested.emit(this.selectedRegion().trim());
    }
  }

  requestClose(): void {
    if (!this.loading()) {
      this.closeRequested.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.requestClose();
    }
  }
}

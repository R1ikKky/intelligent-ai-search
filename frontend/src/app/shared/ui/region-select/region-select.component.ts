import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  forwardRef,
  signal,
  computed,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

import { REGIONS } from '../../data/regions';

@Component({
  standalone: true,
  selector: 'app-region-select',
  imports: [FormsModule],
  templateUrl: './region-select.component.html',
  styleUrl: './region-select.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RegionSelectComponent),
      multi: true,
    },
  ],
})
export class RegionSelectComponent implements ControlValueAccessor {
  readonly query = signal('');
  readonly isOpen = signal(false);
  readonly activeIndex = signal(-1);

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return [...REGIONS];
    return REGIONS.filter((r) => r.toLowerCase().includes(q));
  });

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};
  private disabled = false;

  constructor(private readonly elRef: ElementRef<HTMLElement>) {}

  // ControlValueAccessor
  writeValue(value: string): void {
    this.query.set(value ?? '');
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Handlers
  onInput(value: string): void {
    this.query.set(value);
    this.isOpen.set(true);
    this.activeIndex.set(-1);
    this.onChange(value);
  }

  onFocus(): void {
    this.isOpen.set(true);
  }

  select(region: string): void {
    this.query.set(region);
    this.onChange(region);
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.onTouched();
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.filtered();
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.isOpen.set(true);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((i) => Math.min(i + 1, list.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const idx = this.activeIndex();
      if (idx >= 0 && list[idx]) {
        this.select(list[idx]);
      }
    } else if (event.key === 'Escape') {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elRef.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
      this.onTouched();
    }
  }
}

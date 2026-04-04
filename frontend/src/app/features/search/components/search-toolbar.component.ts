import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-search-toolbar',
  imports: [ReactiveFormsModule],
  templateUrl: './search-toolbar.component.html',
  styleUrl: './search-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchToolbarComponent {
  private readonly fb = inject(FormBuilder);

  readonly query = input('');
  readonly loading = input(false);
  readonly queryChanged = output<string>();
  readonly searchSubmitted = output<string>();

  readonly isFocused = signal(false);

  readonly form = this.fb.nonNullable.group({
    query: [''],
  });

  get hasValue(): boolean {
    return this.form.controls.query.value.trim().length > 0;
  }

  constructor() {
    effect(() => {
      const externalQuery = this.query();
      const control = this.form.controls.query;
      if (control.value !== externalQuery) {
        control.setValue(externalQuery, { emitEvent: false });
      }
    });

    this.form.controls.query.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.queryChanged.emit(value);
    });
  }

  submit(): void {
    this.searchSubmitted.emit(this.form.controls.query.getRawValue());
  }

  clear(): void {
    this.form.controls.query.setValue('');
    this.queryChanged.emit('');
  }
}

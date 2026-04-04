import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RegionSelectComponent } from '../../../shared/ui/region-select/region-select.component';
import { AuthFacade } from '../data-access/auth.facade';

@Component({
  standalone: true,
  selector: 'app-register-page',
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, RegionSelectComponent],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authFacade = inject(AuthFacade);

  readonly loading$ = this.authFacade.loading$;
  readonly error$ = this.authFacade.error$;
  readonly showPassword = signal(false);

  readonly form = this.fb.nonNullable.group({
    customerInn: ['', [Validators.required]],
    customerName: ['', [Validators.required]],
    customerRegion: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.authFacade.register(this.form.getRawValue());
  }
}

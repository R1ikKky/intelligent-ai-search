import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SectionCardComponent } from '../../../shared/ui/section-card/section-card.component';
import { AuthFacade } from '../data-access/auth.facade';

@Component({
  standalone: true,
  selector: 'app-login-page',
  imports: [AsyncPipe, ReactiveFormsModule, RouterLink, SectionCardComponent],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authFacade = inject(AuthFacade);

  readonly loading$ = this.authFacade.loading$;
  readonly error$ = this.authFacade.error$;

  readonly form = this.fb.nonNullable.group({
    customerInn: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.authFacade.login(this.form.getRawValue());
  }
}

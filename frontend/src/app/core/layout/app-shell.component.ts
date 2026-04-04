import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';

import { AuthFacade } from '../../features/auth/data-access/auth.facade';
import { selectAuthIdentity } from '../../features/auth/store/auth.selectors';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AsyncPipe, ReactiveFormsModule],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly identity$ = this.store.select(selectAuthIdentity);
  readonly isSearchOpen = signal(false);

  readonly searchForm = this.fb.nonNullable.group({
    query: [''],
  });

  toggleSearch(): void {
    this.isSearchOpen.update((v) => !v);
    if (this.isSearchOpen()) {
      setTimeout(() => document.getElementById('header-search-input')?.focus(), 0);
    }
  }

  submitSearch(): void {
    const query = this.searchForm.controls.query.getRawValue().trim();
    if (query) {
      this.router.navigate(['/search'], { queryParams: { q: query } });
    }
    this.isSearchOpen.set(false);
  }

  logout(): void {
    this.authFacade.logout();
  }
}

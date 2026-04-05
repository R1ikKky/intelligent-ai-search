import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';

import { TokenStorageService } from '../services/token-storage.service';
import { AuthFacade } from '../../features/auth/data-access/auth.facade';
import { selectAuthIdentity } from '../../features/auth/store/auth.selectors';
import { RegionPickerDialogComponent } from '../../shared/ui/region-picker-dialog/region-picker-dialog.component';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, AsyncPipe, ReactiveFormsModule, RegionPickerDialogComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authFacade = inject(AuthFacade);
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly tokenStorage = inject(TokenStorageService);

  readonly identity$ = this.store.select(selectAuthIdentity);
  readonly customerRegion = toSignal(this.authFacade.customerRegion$, { initialValue: null });
  readonly authLoading = toSignal(this.authFacade.loading$, { initialValue: false });
  readonly authError = toSignal(this.authFacade.error$, { initialValue: null });
  readonly isSearchOpen = signal(false);
  readonly isRegionDialogOpen = signal(false);
  readonly regionLabel = computed(() => this.customerRegion()?.trim() || 'Выбрать регион');

  readonly searchForm = this.fb.nonNullable.group({
    query: [''],
  });

  private readonly pendingRegionUpdate = signal<string | null>(null);

  constructor() {
    if (this.tokenStorage.getAccessToken()) {
      this.authFacade.loadProfile();
    }

    effect(() => {
      const pendingRegion = this.pendingRegionUpdate();
      if (!pendingRegion || this.authLoading()) {
        return;
      }

      if (this.customerRegion() === pendingRegion) {
        this.pendingRegionUpdate.set(null);
        this.isRegionDialogOpen.set(false);
      }
    });
  }

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

  openRegionDialog(): void {
    this.pendingRegionUpdate.set(null);
    this.isRegionDialogOpen.set(true);

    if (!this.customerRegion()) {
      this.authFacade.loadProfile();
    }
  }

  closeRegionDialog(): void {
    if (this.authLoading()) {
      return;
    }

    this.pendingRegionUpdate.set(null);
    this.isRegionDialogOpen.set(false);
  }

  saveRegion(region: string): void {
    const normalizedRegion = region.trim();
    if (!normalizedRegion) {
      return;
    }

    if (normalizedRegion === (this.customerRegion()?.trim() ?? '')) {
      this.closeRegionDialog();
      return;
    }

    this.pendingRegionUpdate.set(normalizedRegion);
    this.authFacade.updateCustomerRegion(normalizedRegion);
  }

  logout(): void {
    this.authFacade.logout();
  }
}

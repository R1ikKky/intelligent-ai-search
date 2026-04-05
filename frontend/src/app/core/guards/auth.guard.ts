import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TokenStorageService } from '../services/token-storage.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const tokenStorage = inject(TokenStorageService);

  if (tokenStorage.getAccessToken()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
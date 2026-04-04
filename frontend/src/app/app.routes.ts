import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';
import { guestOnlyGuard } from './core/guards/guest-only.guard';
import { AppShellComponent } from './core/layout/app-shell.component';

export const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'auth/login',
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/pages/login-page.component').then((m) => m.LoginPageComponent),
    canActivate: [guestOnlyGuard],
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/pages/register-page.component').then((m) => m.RegisterPageComponent),
    canActivate: [guestOnlyGuard],
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'search',
        loadComponent: () => import('./features/search/pages/search-page.component').then((m) => m.SearchPageComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
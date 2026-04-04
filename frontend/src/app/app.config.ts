import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { appRoutes } from './app.routes';
import { authReducer } from './features/auth/store/auth.reducer';
import { searchReducer } from './features/search/store/search.reducer';
import { AuthEffects } from './features/auth/store/auth.effects';
import { SearchEffects } from './features/search/store/search.effects';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { apiBaseUrlInterceptor } from './core/interceptors/api-base-url.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor, authInterceptor, errorInterceptor])),
    provideStore({
      auth: authReducer,
      search: searchReducer,
    }),
    provideEffects([AuthEffects, SearchEffects]),
  ],
};
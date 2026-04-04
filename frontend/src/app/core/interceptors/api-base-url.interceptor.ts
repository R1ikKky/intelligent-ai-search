import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

import { API_CONFIG } from '../tokens/api-config.token';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const config = inject(API_CONFIG);

  if (/^https?:\/\//.test(req.url)) {
    return next(req);
  }

  const normalized = req.url.startsWith('/') ? req.url : `/${req.url}`;
  return next(req.clone({ url: `${config.baseUrl}${normalized}` }));
};
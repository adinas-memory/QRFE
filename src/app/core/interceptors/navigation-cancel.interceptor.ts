import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { takeUntil } from 'rxjs';
import { HttpNavigationCancelService } from '../services/http-navigation-cancel.service';

export const navigationCancelInterceptor: HttpInterceptorFn = (req, next) => {
  const nav = inject(HttpNavigationCancelService);
  return next(req).pipe(takeUntil(nav.cancelForRequest()));
};

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { ClientInstanceService } from '../services/device/client-instance.service';

export const CLIENT_INSTANCE_HEADER = 'X-Client-Instance-Id';

/** Attaches device id to staff order APIs so the backend can target pickup haptics. */
export const clientInstanceInterceptor: HttpInterceptorFn = (req, next) => {
  const isStaffApi =
    req.url.includes('/api/restaurants/') && req.url.includes('/staff/');

  if (!isStaffApi) {
    return next(req);
  }

  const clientInstance = inject(ClientInstanceService);
  const id = clientInstance.getId();
  if (!id) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { [CLIENT_INSTANCE_HEADER]: id },
    }),
  );
};

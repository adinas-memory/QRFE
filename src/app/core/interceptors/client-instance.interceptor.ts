import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { ClientInstanceService } from '../services/device/client-instance.service';

export const CLIENT_INSTANCE_HEADER = 'X-Client-Instance-Id';

function requestPath(url: string): string {
  try {
    if (url.includes('://')) {
      return new URL(url).pathname;
    }
  } catch {
    // ignore malformed URL
  }
  return url.split('?')[0] ?? url;
}

/** Staff order mutations — backend stores ClientInstanceId on Order for pickup targeting. */
function isStaffOrderApi(path: string): boolean {
  return path.includes('/api/restaurants/') && path.includes('/staff/');
}

/** Attaches device id to staff order APIs so the backend can target pickup haptics. */
export const clientInstanceInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isStaffOrderApi(requestPath(req.url))) {
    return next(req);
  }

  const clientInstance = inject(ClientInstanceService);
  return from(clientInstance.whenReady()).pipe(
    switchMap((id) => {
      const trimmed = id?.trim();
      if (!trimmed) {
        return next(req);
      }
      return next(
        req.clone({
          setHeaders: { [CLIENT_INSTANCE_HEADER]: trimmed },
        }),
      );
    }),
  );
};

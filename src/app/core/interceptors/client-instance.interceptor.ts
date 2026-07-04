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

/** Auth endpoints that resolve offline-primary device binding from the device id header. */
function isOfflinePrimaryAuthApi(path: string): boolean {
  return path.includes('/api/user/login') || path.includes('/api/user/refresh-token');
}

/** Restaurant-wide offline replay lock (begin/complete must identify the primary device holder). */
function isOfflineSyncLockApi(path: string): boolean {
  return path.includes('/api/offline-sync/');
}

/** Attaches device id to staff order APIs, offline-sync lock, and auth refresh/login. */
export const clientInstanceInterceptor: HttpInterceptorFn = (req, next) => {
  const path = requestPath(req.url);
  if (!isStaffOrderApi(path) && !isOfflinePrimaryAuthApi(path) && !isOfflineSyncLockApi(path)) {
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

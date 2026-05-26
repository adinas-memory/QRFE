import { Injectable } from '@angular/core';
import {
  CLIENT_INSTANCE_STORAGE_KEY,
  PlatformStorageService,
} from '../../platform/platform-storage.service';

const MAX_LEN = 64;

/** Stable per-device id (browser localStorage or Capacitor Preferences). */
@Injectable({ providedIn: 'root' })
export class ClientInstanceService {
  private cachedId: string | null = null;

  constructor(private readonly platformStorage: PlatformStorageService) {
    void this.hydrateFromPersistentStorage();
  }

  getId(): string {
    if (this.cachedId) return this.cachedId;
    try {
      const stored = localStorage.getItem(CLIENT_INSTANCE_STORAGE_KEY);
      if (stored && this.isValid(stored)) {
        this.cachedId = stored;
        return stored;
      }
      const created = crypto.randomUUID();
      localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, created);
      this.cachedId = created;
      void this.platformStorage.setString(CLIENT_INSTANCE_STORAGE_KEY, created);
      return created;
    } catch {
      const fallback = crypto.randomUUID();
      this.cachedId = fallback;
      return fallback;
    }
  }

  isAvailable(): boolean {
    return !!this.getId();
  }

  private async hydrateFromPersistentStorage(): Promise<void> {
    const stored = await this.platformStorage.getString(CLIENT_INSTANCE_STORAGE_KEY);
    if (stored && this.isValid(stored)) {
      this.cachedId = stored;
      try {
        localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, stored);
      } catch {
        // ignore
      }
    }
  }

  private isValid(value: string): boolean {
    return value.length > 0 && value.length <= MAX_LEN && /^[a-zA-Z0-9-]+$/.test(value);
  }
}

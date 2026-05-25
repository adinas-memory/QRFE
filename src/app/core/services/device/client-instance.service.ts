import { Injectable } from '@angular/core';

const STORAGE_KEY = 'qrfe-client-instance-id';
const MAX_LEN = 64;

/** Stable per-browser profile id; Capacitor will use Preferences with the same key later. */
@Injectable({ providedIn: 'root' })
export class ClientInstanceService {
  private cachedId: string | null = null;

  getId(): string {
    if (this.cachedId) return this.cachedId;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && this.isValid(stored)) {
        this.cachedId = stored;
        return stored;
      }
      const created = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, created);
      this.cachedId = created;
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

  private isValid(value: string): boolean {
    return value.length > 0 && value.length <= MAX_LEN && /^[a-zA-Z0-9-]+$/.test(value);
  }
}

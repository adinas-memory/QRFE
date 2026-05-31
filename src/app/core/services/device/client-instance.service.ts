import { Injectable } from '@angular/core';
import {
  CLIENT_INSTANCE_STORAGE_KEY,
  PlatformStorageService,
} from '../../platform/platform-storage.service';
import { RuntimePlatformService } from '../../platform/runtime-platform.service';

const MAX_LEN = 64;

/**
 * `crypto.randomUUID()` requires a secure context (HTTPS or localhost/127.0.0.1).
 * On LAN HTTP origins it's `undefined` — fall back to a manual UUIDv4 derived
 * from `crypto.getRandomValues` (Math.random as last resort).
 */
function generateUuid(): string {
  const cryptoObj: Crypto | undefined =
    typeof crypto !== 'undefined' ? crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      h.push(bytes[i].toString(16).padStart(2, '0'));
    }
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  // Last resort: not cryptographically strong but valid format.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Case-insensitive UUID compare for pickup targeting. */
export function clientInstanceIdsMatch(
  targetId: string | null | undefined,
  localId: string | null | undefined,
): boolean {
  const target = (targetId ?? '').trim();
  if (!target) return true;
  const local = (localId ?? '').trim();
  if (!local) return false;
  return target.toLowerCase() === local.toLowerCase();
}

/** Stable per-device id (browser localStorage or Capacitor Preferences). */
@Injectable({ providedIn: 'root' })
export class ClientInstanceService {
  private cachedId: string | null = null;
  private readonly ready: Promise<void>;
  private initialized = false;

  constructor(
    private readonly platformStorage: PlatformStorageService,
    private readonly platform: RuntimePlatformService,
  ) {
    this.ready = this.initialize();
  }

  /** Prefer this on native before attaching headers or comparing pickup targets. */
  whenReady(): Promise<string> {
    return this.ready.then(() => this.getId());
  }

  getId(): string {
    if (this.cachedId) return this.cachedId;

    // On Capacitor, Preferences load is async — never mint a new id before initialize() finishes.
    if (this.platform.capabilities.clientInstanceStorage === 'preferences' && !this.initialized) {
      return '';
    }

    return this.ensureIdFromLocalStorage();
  }

  isAvailable(): boolean {
    return !!this.getId();
  }

  isPickupTarget(clientInstanceId: string | null | undefined): boolean {
    return clientInstanceIdsMatch(clientInstanceId, this.getId());
  }

  private async initialize(): Promise<void> {
    try {
      const fromPrefs = await this.platformStorage.getString(CLIENT_INSTANCE_STORAGE_KEY);
      if (fromPrefs && this.isValid(fromPrefs)) {
        this.cachedId = fromPrefs;
        try {
          localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, fromPrefs);
        } catch {
          // ignore
        }
        return;
      }

      const fromLs = this.readLocalStorage();
      if (fromLs) {
        this.cachedId = fromLs;
        await this.platformStorage.setString(CLIENT_INSTANCE_STORAGE_KEY, fromLs);
        return;
      }

      const created = generateUuid();
      this.cachedId = created;
      await this.platformStorage.setString(CLIENT_INSTANCE_STORAGE_KEY, created);
      try {
        localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, created);
      } catch {
        // ignore
      }
    } finally {
      this.initialized = true;
    }
  }

  private ensureIdFromLocalStorage(): string {
    try {
      const stored = localStorage.getItem(CLIENT_INSTANCE_STORAGE_KEY);
      if (stored && this.isValid(stored)) {
        this.cachedId = stored;
        void this.platformStorage.setString(CLIENT_INSTANCE_STORAGE_KEY, stored);
        return stored;
      }
      const created = generateUuid();
      localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, created);
      this.cachedId = created;
      void this.platformStorage.setString(CLIENT_INSTANCE_STORAGE_KEY, created);
      return created;
    } catch {
      const fallback = generateUuid();
      this.cachedId = fallback;
      return fallback;
    }
  }

  private readLocalStorage(): string | null {
    try {
      const stored = localStorage.getItem(CLIENT_INSTANCE_STORAGE_KEY);
      return stored && this.isValid(stored) ? stored : null;
    } catch {
      return null;
    }
  }

  private isValid(value: string): boolean {
    return value.length > 0 && value.length <= MAX_LEN && /^[a-zA-Z0-9-]+$/.test(value);
  }
}

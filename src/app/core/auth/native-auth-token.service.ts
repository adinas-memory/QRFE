import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PlatformStorageService } from '../platform/platform-storage.service';
import { debugLog } from '../offline/debug-log.util';

/** Request native token fields in login/refresh responses (Capacitor only). */
export const NATIVE_AUTH_HEADER = 'X-URS-Native-Auth';

const ACCESS_TOKEN_KEY = 'NativeAuthAccessToken';
const REFRESH_TOKEN_KEY = 'NativeAuthRefreshToken';

@Injectable({ providedIn: 'root' })
export class NativeAuthTokenService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private readonly storage: PlatformStorageService) {}

  isEnabled(): boolean {
    return Capacitor.isNativePlatform();
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    if (!this.initPromise) {
      this.initPromise = this.loadFromStorage();
    }
    await this.initPromise;
  }

  getAccessToken(): string | null {
    return this.accessToken?.trim() || null;
  }

  getRefreshToken(): string | null {
    return this.normalizeRefreshToken(this.refreshToken);
  }

  authHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    if (!token) {
      return {};
    }
    return { Authorization: `Bearer ${token}` };
  }

  captureFromAuthPayload(raw: unknown): void {
    if (!this.isEnabled() || !raw || typeof raw !== 'object') {
      return;
    }
    const r = raw as Record<string, unknown>;
    const access =
      (r['accessToken'] as string | undefined) ??
      (r['AccessToken'] as string | undefined) ??
      (r['bearerToken'] as string | undefined) ??
      (r['BearerToken'] as string | undefined);
    const refresh =
      (r['refreshToken'] as string | undefined) ??
      (r['RefreshToken'] as string | undefined) ??
      (r['newRefreshToken'] as string | undefined) ??
      (r['NewRefreshToken'] as string | undefined);

    if (access?.trim()) {
      this.accessToken = access.trim();
    }
    const normalizedRefresh = this.normalizeRefreshToken(refresh);
    if (normalizedRefresh) {
      this.refreshToken = normalizedRefresh;
    }
    if (access?.trim() || normalizedRefresh) {
      debugLog('auth', 'native-auth-token.service.ts', 'native tokens captured', {
        hasAccess: !!access?.trim(),
        hasRefresh: !!normalizedRefresh,
        refreshHadPercent: !!refresh?.includes('%'),
        hypothesisId: 'H9-native-bearer',
      });
      void this.persist();
    }
  }

  async clear(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    if (!this.isEnabled()) {
      return;
    }
    await this.storage.setString(ACCESS_TOKEN_KEY, '');
    await this.storage.setString(REFRESH_TOKEN_KEY, '');
  }

  private async loadFromStorage(): Promise<void> {
    const [access, refresh] = await Promise.all([
      this.storage.getString(ACCESS_TOKEN_KEY),
      this.storage.getString(REFRESH_TOKEN_KEY),
    ]);
    this.accessToken = access?.trim() || null;
    this.refreshToken = this.normalizeRefreshToken(refresh);
    // #region agent log
    debugLog('auth', 'native-auth-token.service.ts:loadFromStorage', 'tokens loaded from storage', {
      hasAccess: !!this.accessToken,
      hasRefresh: !!this.refreshToken,
      hypothesisId: 'H19-startup-hydrate',
    });
    // #endregion agent log
  }

  /** Cookie / persisted values may be URL-encoded (%24 → $); DB stores decoded bcrypt hash. */
  private normalizeRefreshToken(token: string | null | undefined): string | null {
    const trimmed = token?.trim();
    if (!trimmed) {
      return null;
    }
    if (!trimmed.includes('%')) {
      return trimmed;
    }
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }

  private async persist(): Promise<void> {
    if (this.accessToken) {
      await this.storage.setString(ACCESS_TOKEN_KEY, this.accessToken);
    } else {
      await this.storage.setString(ACCESS_TOKEN_KEY, '');
    }
    if (this.refreshToken) {
      await this.storage.setString(REFRESH_TOKEN_KEY, this.refreshToken);
    } else {
      await this.storage.setString(REFRESH_TOKEN_KEY, '');
    }
  }
}

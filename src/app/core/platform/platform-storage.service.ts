import { Injectable } from '@angular/core';
import { RuntimePlatformService } from './runtime-platform.service';

const HAPTICS_ENABLED_KEY = 'hapticsEnabled';

@Injectable({ providedIn: 'root' })
export class PlatformStorageService {
  constructor(private readonly platform: RuntimePlatformService) {}

  async getString(key: string): Promise<string | null> {
    if (this.platform.capabilities.clientInstanceStorage === 'preferences') {
      const prefs = await this.loadPreferencesModule();
      if (prefs) {
        const { value } = await prefs.Preferences.get({ key });
        return value;
      }
    }
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setString(key: string, value: string): Promise<void> {
    if (this.platform.capabilities.clientInstanceStorage === 'preferences') {
      const prefs = await this.loadPreferencesModule();
      if (prefs) {
        await prefs.Preferences.set({ key, value });
        return;
      }
    }
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }

  async getHapticsEnabled(): Promise<boolean> {
    const stored = await this.getString(HAPTICS_ENABLED_KEY);
    if (stored === '0' || stored === 'false') return false;
    return true;
  }

  async setHapticsEnabled(enabled: boolean): Promise<void> {
    await this.setString(HAPTICS_ENABLED_KEY, enabled ? '1' : '0');
  }

  private async loadPreferencesModule(): Promise<typeof import('@capacitor/preferences') | null> {
    if (!this.platform.isNative) return null;
    try {
      return await import('@capacitor/preferences');
    } catch {
      return null;
    }
  }
}

export const CLIENT_INSTANCE_STORAGE_KEY = 'qrfe-client-instance-id';

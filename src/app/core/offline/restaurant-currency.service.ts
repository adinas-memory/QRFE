import { Injectable, inject, signal } from '@angular/core';
import { PlatformStorageService } from '../platform/platform-storage.service';
import { normalizeCurrencyCode } from '../models/orderingModel';

function storageKey(restaurantId: string): string {
  return `qrfe-restaurant-currency:${restaurantId}`;
}

/** Cached operating currency from /api/sync — source of truth for POS display. */
@Injectable({ providedIn: 'root' })
export class RestaurantCurrencyService {
  private readonly storage = inject(PlatformStorageService);
  private readonly currencySignal = signal<string>('');
  private restaurantId: string | null = null;

  readonly currency = this.currencySignal.asReadonly();

  async init(restaurantId: string): Promise<void> {
    this.restaurantId = restaurantId;
    try {
      const cached = await this.storage.getString(storageKey(restaurantId));
      const normalized = normalizeCurrencyCode(cached);
      if (normalized) {
        this.currencySignal.set(normalized);
      }
    } catch {
      /* ignore */
    }
  }

  /** Apply currency from /api/sync (or menu fallback). */
  async setFromSync(restaurantId: string, raw: unknown): Promise<void> {
    const normalized = normalizeCurrencyCode(raw);
    if (!normalized) {
      return;
    }
    this.restaurantId = restaurantId;
    this.currencySignal.set(normalized);
    try {
      await this.storage.setString(storageKey(restaurantId), normalized);
    } catch {
      /* ignore */
    }
  }

  /** Prefer restaurant currency; optional fallbacks when sync has not arrived yet. */
  resolve(...fallbacks: Array<string | null | undefined>): string {
    const primary = normalizeCurrencyCode(this.currencySignal());
    if (primary) {
      return primary;
    }
    for (const fb of fallbacks) {
      const n = normalizeCurrencyCode(fb);
      if (n) return n;
    }
    return '';
  }
}

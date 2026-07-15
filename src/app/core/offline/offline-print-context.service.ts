import { Injectable, inject, signal } from '@angular/core';
import { PlatformStorageService } from '../platform/platform-storage.service';
import {
  OfflinePrintConfigDto,
  OfflinePrintConfigStored,
  offlinePrintStorageKey,
} from './offline-print-config.model';
import type { FiscalVatGroupMapping } from '../fiscal/fiscal-vat-group.mapper';

@Injectable({ providedIn: 'root' })
export class OfflinePrintContextService {
  private readonly storage = inject(PlatformStorageService);

  private readonly defaultBillPrinterId = signal<string | null>(null);
  private readonly agentLocalBaseUrl = signal<string | null>(null);
  private readonly localPrintAuthToken = signal<string | null>(null);
  private readonly fiscalPrintingEnabled = signal(false);
  private readonly defaultFiscalPrinterId = signal<string | null>(null);
  private readonly fiscalVatGroupMapping = signal<FiscalVatGroupMapping>({});

  readonly defaultBillPrinterIdSnapshot = this.defaultBillPrinterId.asReadonly();
  readonly agentLocalBaseUrlSnapshot = this.agentLocalBaseUrl.asReadonly();

  isReadyForOfflinePrint(): boolean {
    return !!this.defaultBillPrinterId()?.trim() && !!this.agentLocalBaseUrl()?.trim();
  }

  isReadyForOfflineFiscalPrint(): boolean {
    return this.isReadyForOfflinePrint()
      && this.fiscalPrintingEnabled()
      && !!this.defaultFiscalPrinterId()?.trim();
  }

  getDefaultBillPrinterId(): string | null {
    return this.defaultBillPrinterId();
  }

  getDefaultFiscalPrinterId(): string | null {
    return this.defaultFiscalPrinterId();
  }

  getFiscalVatGroupMapping(): FiscalVatGroupMapping {
    return this.fiscalVatGroupMapping();
  }

  isFiscalPrintingEnabledOffline(): boolean {
    return this.fiscalPrintingEnabled();
  }

  getAgentLocalBaseUrl(): string | null {
    return this.agentLocalBaseUrl();
  }

  getLocalPrintAuthToken(): string | null {
    return this.localPrintAuthToken();
  }

  async init(restaurantId: string): Promise<void> {
    const raw = await this.storage.getString(offlinePrintStorageKey(restaurantId));
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as OfflinePrintConfigStored;
      this.apply(parsed);
    } catch {
      // ignore corrupt storage
    }
  }

  async applyFromSyncSnapshot(
    config: OfflinePrintConfigDto | Record<string, unknown> | null | undefined,
    restaurantId: string,
  ): Promise<void> {
    const normalized = this.normalizeConfig(config);
    if (!normalized?.agentLocalBaseUrl?.trim()) {
      return;
    }

    const stored: OfflinePrintConfigStored = {
      restaurantId,
      defaultBillPrinterId: normalized.defaultBillPrinterId ?? null,
      agentLocalBaseUrl: normalized.agentLocalBaseUrl.trim(),
      localPrintAuthToken: normalized.localPrintAuthToken ?? null,
      agentId: normalized.agentId ?? null,
      fromHeartbeatUtc: normalized.fromHeartbeatUtc ?? null,
      fiscalPrintingEnabled: normalized.fiscalPrintingEnabled ?? false,
      defaultFiscalPrinterId: normalized.defaultFiscalPrinterId ?? null,
      fiscalVatGroupMapping: normalized.fiscalVatGroupMapping ?? null,
      cachedAtUtc: new Date().toISOString(),
    };

    this.apply(stored);
    await this.storage.setString(offlinePrintStorageKey(restaurantId), JSON.stringify(stored));
  }

  async clearForRestaurant(restaurantId: string): Promise<void> {
    await this.storage.setString(offlinePrintStorageKey(restaurantId), '');
    this.defaultBillPrinterId.set(null);
    this.agentLocalBaseUrl.set(null);
    this.localPrintAuthToken.set(null);
    this.fiscalPrintingEnabled.set(false);
    this.defaultFiscalPrinterId.set(null);
    this.fiscalVatGroupMapping.set({});
  }

  private apply(config: OfflinePrintConfigDto): void {
    this.defaultBillPrinterId.set((config.defaultBillPrinterId ?? '').trim() || null);
    this.agentLocalBaseUrl.set((config.agentLocalBaseUrl ?? '').trim() || null);
    this.localPrintAuthToken.set((config.localPrintAuthToken ?? '').trim() || null);
    this.fiscalPrintingEnabled.set(!!config.fiscalPrintingEnabled);
    this.defaultFiscalPrinterId.set((config.defaultFiscalPrinterId ?? '').trim() || null);
    this.fiscalVatGroupMapping.set(config.fiscalVatGroupMapping ?? {});
  }

  private normalizeConfig(
    config: OfflinePrintConfigDto | Record<string, unknown> | null | undefined,
  ): OfflinePrintConfigDto | null {
    if (!config || typeof config !== 'object') {
      return null;
    }
    const c = config as Record<string, unknown>;
    return {
      defaultBillPrinterId: (c['defaultBillPrinterId'] ?? c['DefaultBillPrinterId']) as string | null | undefined,
      agentLocalBaseUrl: (c['agentLocalBaseUrl'] ?? c['AgentLocalBaseUrl']) as string | null | undefined,
      localPrintAuthToken: (c['localPrintAuthToken'] ?? c['LocalPrintAuthToken']) as string | null | undefined,
      agentId: (c['agentId'] ?? c['AgentId']) as string | null | undefined,
      fromHeartbeatUtc: (c['fromHeartbeatUtc'] ?? c['FromHeartbeatUtc']) as string | null | undefined,
      fiscalPrintingEnabled: (c['fiscalPrintingEnabled'] ?? c['FiscalPrintingEnabled']) as boolean | undefined,
      defaultFiscalPrinterId: (c['defaultFiscalPrinterId'] ?? c['DefaultFiscalPrinterId']) as string | null | undefined,
      fiscalVatGroupMapping: (c['fiscalVatGroupMapping'] ?? c['FiscalVatGroupMapping']) as Record<string, number> | null | undefined,
    };
  }
}

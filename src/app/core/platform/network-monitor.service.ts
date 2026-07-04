import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../auth/auth.service';
import { NetworkMonitor } from '../plugins/network-monitor.plugin';
import { SseConnectivityService } from '../offline/sse-connectivity.service';
import { OrderSyncService } from '../services/order-service/order-sync.service';

@Injectable({ providedIn: 'root' })
export class NetworkMonitorService {
  private readonly auth = inject(AuthService);
  private readonly sseConnectivity = inject(SseConnectivityService);
  private readonly orderSync = inject(OrderSyncService);

  private started = false;
  private listenerHandle: { remove: () => void } | null = null;

  async syncWithAuthState(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    if (this.auth.isAuthenticated()) {
      await this.start();
    } else {
      await this.stop();
    }
  }

  async start(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.started) {
      return;
    }
    this.started = true;
    this.listenerHandle = await NetworkMonitor.addListener('networkStatusChange', ({ online }) => {
      if (online) {
        this.sseConnectivity.reportNativeNetworkAvailable();
        this.orderSync.flushPendingSseConnection();
      } else {
        this.sseConnectivity.reportNativeNetworkLost();
      }
    });
    await NetworkMonitor.start();
  }

  async stop(): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.started) {
      return;
    }
    this.started = false;
    this.listenerHandle?.remove();
    this.listenerHandle = null;
    await NetworkMonitor.stop();
  }
}

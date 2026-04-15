import { Injectable } from '@angular/core';

export type NotificationSoundKind =
  | 'newOrder'
  | 'itemAdded'
  | 'qtyUpdated'
  | 'itemDeleted'
  | 'uiToggle';

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private ctx: AudioContext | null = null;
  private armed = false;
  private lastPlayedAt: Record<NotificationSoundKind, number> = {
    newOrder: 0,
    itemAdded: 0,
    qtyUpdated: 0,
    itemDeleted: 0,
    uiToggle: 0
  };
  private readonly minIntervalMs: Record<NotificationSoundKind, number> = {
    newOrder: 500,
    itemAdded: 400,
    qtyUpdated: 350,
    itemDeleted: 350,
    uiToggle: 250
  };
  private resumeInFlight: Promise<void> | null = null;
  private pendingAfterUnlock: NotificationSoundKind | null = null;

  private get debugEnabled(): boolean {
    try { return localStorage.getItem('debugSounds') === '1'; } catch { return false; }
  }

  private debug(...args: unknown[]): void {
    if (!this.debugEnabled) return;
    // eslint-disable-next-line no-console
    console.debug('[Sound]', ...args);
  }

  get isUnlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /**
   * Browsers often block audio until a user gesture.
   * Call once from any page that needs sounds.
   */
  armOnce(): void {
    if (this.armed) return;
    this.armed = true;

    const tryResume = () => {
      try {
        this.ctx ??= new AudioContext();
        if (this.ctx.state !== 'running') void this.ctx.resume();
        this.debug('tryResume', { state: this.ctx.state });
      } catch {
        // ignore
      }
    };

    // IMPORTANT: Don't create/resume AudioContext here; browsers require a user gesture.

    // Best-effort: resume on first user gesture.
    const onUnlock = () => {
      this.debug('unlock gesture');
      tryResume();
      // If we queued a sound while locked, try once after unlock.
      const k = this.pendingAfterUnlock;
      this.pendingAfterUnlock = null;
      if (k) this.play(k);
    };
    window.addEventListener('pointerdown', onUnlock, { once: true, capture: true });
    window.addEventListener('keydown', onUnlock, { once: true, capture: true });
  }

  /**
   * Call ONLY from a direct user gesture handler (click/tap/keydown).
   * This ensures the AudioContext can start on browsers with autoplay restrictions.
   */
  async unlockFromGesture(): Promise<boolean> {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state !== 'running') {
        await this.ctx.resume();
      }
      this.debug('unlockFromGesture done', { state: this.ctx.state });
      return this.ctx.state === 'running';
    } catch {
      this.debug('unlockFromGesture failed');
      return false;
    }
  }

  play(kind: NotificationSoundKind): void {
    const now = Date.now();
    if (now - this.lastPlayedAt[kind] < this.minIntervalMs[kind]) return;

    try {
      // IMPORTANT: Don't create AudioContext here — that triggers autoplay warnings.
      // AudioContext should be created/resumed only by `unlockFromGesture()` or gesture handlers in `armOnce()`.
      if (!this.ctx || this.ctx.state !== 'running') {
        this.pendingAfterUnlock = kind;
        this.debug('play skipped (locked)', { kind, state: this.ctx?.state ?? 'none' });
        return;
      }

      const ctx = this.ctx;
      this.lastPlayedAt[kind] = now;
      this.debug('play start', { kind, state: ctx.state });
      const t0 = ctx.currentTime + 0.01;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.75);
      master.connect(ctx.destination);

      const playTone = (
        freq: number,
        start: number,
        dur: number,
        opts?: { type?: OscillatorType; gain?: number; freqTo?: number }
      ) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = opts?.type ?? 'sine';
        osc.frequency.setValueAtTime(freq, start);
        if (typeof opts?.freqTo === 'number') {
          osc.frequency.exponentialRampToValueAtTime(opts.freqTo, start + dur);
        }
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(opts?.gain ?? 0.6, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      };

      switch (kind) {
        case 'newOrder': {
          // "helpdesk"-ish chime: brighter and a bit more insistent.
          playTone(1480, t0, 0.32, { gain: 0.7 });
          playTone(2220, t0, 0.22, { gain: 0.55 });
          playTone(1760, t0 + 0.18, 0.30, { gain: 0.65 });
          playTone(2640, t0 + 0.18, 0.20, { gain: 0.5 });
          break;
        }
        case 'itemAdded': {
          // short double "ding"
          playTone(1046, t0, 0.18, { gain: 0.55 });
          playTone(1568, t0, 0.14, { gain: 0.45 });
          playTone(1175, t0 + 0.16, 0.18, { gain: 0.5 });
          playTone(1760, t0 + 0.16, 0.14, { gain: 0.4 });
          break;
        }
        case 'qtyUpdated': {
          // subtle single "ding"
          playTone(1175, t0, 0.22, { gain: 0.45 });
          playTone(1760, t0, 0.16, { gain: 0.35 });
          break;
        }
        case 'itemDeleted': {
          // descending "delete" tone (suggestive)
          playTone(880, t0, 0.28, { gain: 0.55, freqTo: 440 });
          playTone(660, t0 + 0.06, 0.22, { gain: 0.35, freqTo: 330 });
          break;
        }
        case 'uiToggle': {
          // tiny confirmation tick
          playTone(988, t0, 0.12, { gain: 0.25, type: 'triangle' });
          break;
        }
      }
    } catch {
      // ignore
    }
  }
}


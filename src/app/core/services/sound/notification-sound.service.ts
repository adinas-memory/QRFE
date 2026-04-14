import { Injectable } from '@angular/core';

type NotificationSoundKind = 'new' | 'updated';

@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private ctx: AudioContext | null = null;
  private armed = false;
  private lastPlayedAt: Record<NotificationSoundKind, number> = { new: 0, updated: 0 };
  private readonly minIntervalMs = 900;

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
      } catch {
        // ignore
      }
    };

    // Best-effort: resume on first user gesture.
    window.addEventListener('pointerdown', tryResume, { once: true, capture: true });
    window.addEventListener('keydown', tryResume, { once: true, capture: true });
  }

  play(kind: NotificationSoundKind): void {
    const now = Date.now();
    if (now - this.lastPlayedAt[kind] < this.minIntervalMs) return;
    this.lastPlayedAt[kind] = now;

    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state !== 'running') {
        // If still blocked, the next user gesture will resume it.
        void this.ctx.resume();
      }

      const ctx = this.ctx;
      const t0 = ctx.currentTime + 0.01;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
      master.connect(ctx.destination);

      // Bell-ish: a couple of partials with quick decay.
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      };

      if (kind === 'new') {
        // two-chime "ding-ding"
        playTone(880, t0, 0.35);
        playTone(1320, t0, 0.25);
        playTone(988, t0 + 0.22, 0.30);
        playTone(1480, t0 + 0.22, 0.22);
      } else {
        // single higher "ding"
        playTone(1175, t0, 0.28);
        playTone(1760, t0, 0.20);
      }
    } catch {
      // ignore
    }
  }
}


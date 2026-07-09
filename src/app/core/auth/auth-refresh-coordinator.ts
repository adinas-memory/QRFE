import { debugLog } from '../offline/debug-log.util';

const LOCK_KEY = 'qrfe-auth-refresh-lock';
const LOCK_TTL_MS = 20_000;
const ORPHAN_PROBE_MS = 400;
const TAB_ID = crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);

const refreshChannel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qrfe-auth-refresh') : null;

let lifecycleBound = false;

type LockPayload = { owner: string; startedAt: number };

function readLock(): LockPayload | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(LOCK_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as LockPayload;
    if (!parsed?.owner || !parsed?.startedAt) {
      return null;
    }
    if (Date.now() - parsed.startedAt > LOCK_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLock(owner: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    const payload: LockPayload = { owner, startedAt: Date.now() };
    sessionStorage.setItem(LOCK_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

function clearLock(owner: string): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    const current = readLock();
    if (!current || current.owner === owner) {
      sessionStorage.removeItem(LOCK_KEY);
    }
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function notifyRefreshDone(ok: boolean): void {
  refreshChannel?.postMessage({ type: 'refresh-done', ok, owner: TAB_ID });
}

function waitForRefreshDone(maxMs: number): Promise<boolean> {
  if (!refreshChannel) {
    return sleep(maxMs).then(() => false);
  }
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => finish(false), maxMs);
    const onMessage = (ev: MessageEvent<{ type?: string; ok?: boolean }>) => {
      if (ev.data?.type !== 'refresh-done') {
        return;
      }
      finish(!!ev.data.ok);
    };
    const finish = (ok: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      refreshChannel.removeEventListener('message', onMessage);
      resolve(ok);
    };
    refreshChannel.addEventListener('message', onMessage);
  });
}

/** True when another tab still holds the refresh lock and responds to probe. */
async function isForeignLockHolderAlive(owner: string): Promise<boolean> {
  if (!refreshChannel || owner === TAB_ID) {
    return false;
  }
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => finish(false), ORPHAN_PROBE_MS);
    const onMessage = (ev: MessageEvent<{ type?: string; owner?: string }>) => {
      if (ev.data?.type === 'refresh-probe-ack' && ev.data.owner === owner) {
        finish(true);
      }
    };
    const finish = (alive: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      refreshChannel.removeEventListener('message', onMessage);
      resolve(alive);
    };
    refreshChannel.addEventListener('message', onMessage);
    refreshChannel.postMessage({ type: 'refresh-probe', requester: TAB_ID, targetOwner: owner });
  });
}

async function clearOrphanForeignLock(): Promise<boolean> {
  const existing = readLock();
  if (!existing || existing.owner === TAB_ID) {
    return false;
  }
  const alive = await isForeignLockHolderAlive(existing.owner);
  if (alive) {
    return false;
  }
  debugLog('auth', 'auth-refresh-coordinator.ts', 'orphan refresh lock cleared', {
    hypothesisId: 'H27-orphan-lock',
    lockAgeMs: Date.now() - existing.startedAt,
  });
  clearLock(existing.owner);
  return true;
}

function bindRefreshCoordinatorLifecycle(): void {
  if (lifecycleBound || typeof window === 'undefined') {
    return;
  }
  lifecycleBound = true;
  window.addEventListener('pagehide', () => clearLock(TAB_ID));
  refreshChannel?.addEventListener('message', (ev: MessageEvent<{ type?: string; targetOwner?: string }>) => {
    if (ev.data?.type !== 'refresh-probe') {
      return;
    }
    const lock = readLock();
    if (lock?.owner === TAB_ID && ev.data.targetOwner === TAB_ID) {
      refreshChannel?.postMessage({ type: 'refresh-probe-ack', owner: TAB_ID });
    }
  });
}

/** Call once on app bootstrap (before auth refresh). */
export function initRefreshCoordinator(): void {
  bindRefreshCoordinatorLifecycle();
}

export function tryAcquireRefreshLeaderSync(): 'leader' | 'follower' | 'contended' {
  bindRefreshCoordinatorLifecycle();
  const existing = readLock();
  if (existing) {
    if (existing.owner !== TAB_ID) {
      return 'contended';
    }
    debugLog('auth', 'auth-refresh-coordinator.ts', 'refresh same-tab contended', {
      hypothesisId: 'H26-same-tab-singleflight',
      lockAgeMs: Date.now() - existing.startedAt,
    });
    return 'contended';
  }
  writeLock(TAB_ID);
  const after = readLock();
  if (after?.owner !== TAB_ID) {
    return 'contended';
  }
  return 'leader';
}

/** Cross-tab / cross-bootstrap singleflight for cookie refresh (rotation revokes reused tokens). */
export async function acquireRefreshLeader(): Promise<'leader' | 'follower'> {
  bindRefreshCoordinatorLifecycle();

  const existing = readLock();
  if (existing?.owner !== TAB_ID) {
    await clearOrphanForeignLock();
  }

  const role = tryAcquireRefreshLeaderSync();
  if (role === 'leader') {
    debugLog('auth', 'auth-refresh-coordinator.ts', 'refresh leader acquired', {
      hypothesisId: 'H23-refresh-singleflight',
    });
    return 'leader';
  }

  debugLog('auth', 'auth-refresh-coordinator.ts', 'refresh follower wait', {
    hypothesisId: 'H23-refresh-singleflight',
    foreignOwner: existing?.owner !== TAB_ID,
    lockAgeMs: existing ? Date.now() - existing.startedAt : null,
  });
  await waitForRefreshDone(LOCK_TTL_MS);
  return 'follower';
}

export function releaseRefreshLeader(ok: boolean): void {
  clearLock(TAB_ID);
  notifyRefreshDone(ok);
}

/** Test helper: clear cross-tab refresh lock between specs. */
export function resetRefreshCoordinatorForTests(): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }
  try {
    sessionStorage.removeItem(LOCK_KEY);
  } catch {
    // ignore
  }
}

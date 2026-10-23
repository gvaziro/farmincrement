/**
 * Only one browser tab may save the farm. The tab that holds the lock (a
 * heartbeat in localStorage) saves; a tab opened while another one is playing
 * stays passive until the player chooses to play there — then it takes the
 * lock over and every other tab stops saving.
 */
import type { KeyValueStore } from "./backups";

export const LOCK_KEY = "tiny-farm-empire/lock";
/** How often the owner refreshes the lock, ms. */
export const LOCK_BEAT = 2000;
/** A lock older than this belongs to a closed or frozen tab, ms. */
export const LOCK_STALE = 6500;

interface LockValue {
  id: string;
  t: number;
}

export class TabLock {
  constructor(
    readonly id: string,
    private readonly storage: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {}

  private read(): LockValue | null {
    try {
      const v = JSON.parse(this.storage.getItem(LOCK_KEY) ?? "null");
      return v && typeof v.id === "string" && typeof v.t === "number" ? v : null;
    } catch {
      return null;
    }
  }

  private write() {
    try {
      this.storage.setItem(LOCK_KEY, JSON.stringify({ id: this.id, t: this.now() }));
    } catch {
      /* storage unavailable: nothing to protect anyway */
    }
  }

  /** Is another tab playing right now? */
  heldElsewhere() {
    const l = this.read();
    return !!l && l.id !== this.id && this.now() - l.t < LOCK_STALE;
  }

  /** Take the lock if it is free, stale or already ours; `force` takes it over anyway. */
  acquire(force = false) {
    if (!force && this.heldElsewhere()) return false;
    this.write();
    return true;
  }

  /** Refresh the heartbeat. False once another tab has taken the lock. */
  beat() {
    if (!this.owns()) return false;
    this.write();
    return true;
  }

  owns() {
    return this.read()?.id === this.id;
  }

  /** Let the next tab (or this one after a reload) in without waiting. */
  release() {
    if (!this.owns()) return;
    try {
      this.storage.removeItem(LOCK_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** A stable id for this tab: survives reloads (sessionStorage), not other tabs. */
export function tabId() {
  const fresh = () => Math.random().toString(36).slice(2, 10);
  try {
    let id = sessionStorage.getItem("tiny-farm-empire/tab");
    if (!id) {
      id = fresh();
      sessionStorage.setItem("tiny-farm-empire/tab", id);
    }
    return id;
  } catch {
    return fresh();
  }
}

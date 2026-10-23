/**
 * Backups of the save, kept in localStorage next to it: when the game starts,
 * every ten minutes of play and right before anything that replaces the save
 * (import, reset, a new generation, restoring another backup). A save that
 * failed to load is kept here as well, so nothing is ever silently thrown away.
 */
import { SAVE_KEY } from "@/game/engine/save";

export const BACKUPS_KEY = "tiny-farm-empire/backups";
export const MAX_BACKUPS = 8;

export type BackupReason = "auto" | "start" | "import" | "reset" | "prestige" | "restore" | "broken";

export const BACKUP_REASONS: Record<BackupReason, string> = {
  auto: "автокопия",
  start: "при запуске",
  import: "перед импортом",
  reset: "перед сбросом",
  prestige: "перед новым поколением",
  restore: "перед восстановлением",
  broken: "не загрузилось",
};

export interface Backup {
  id: number;
  at: number;
  reason: BackupReason;
  /** The save exactly as it was stored (JSON text). */
  raw: string;
}

/** The bits of `Storage` the backups need (a Map-backed fake works in tests). */
export type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const isReason = (r: unknown): r is BackupReason => typeof r === "string" && r in BACKUP_REASONS;

/** Newest first. */
export function listBackups(storage: KeyValueStore): Backup[] {
  try {
    const list = JSON.parse(storage.getItem(BACKUPS_KEY) ?? "[]");
    if (!Array.isArray(list)) return [];
    return list.filter(
      (b): b is Backup => !!b && typeof b === "object" && typeof b.id === "number" && typeof b.at === "number" && isReason(b.reason) && typeof b.raw === "string",
    );
  } catch {
    return [];
  }
}

/** An automatic copy younger than this is replaced by the next one of its kind. */
const REFRESH_MS = 10 * 60 * 1000;

/** Keep a copy of `raw`. Unchanged saves are not duplicated; the oldest automatic copies go first. */
export function addBackup(storage: KeyValueStore, reason: BackupReason, raw: string, now = Date.now()) {
  const list = listBackups(storage);
  if (list[0]?.raw === raw) return;
  // Reloading the page a few times should not fill the list with the same farm.
  const top = list[0];
  if (top && (reason === "auto" || reason === "start") && top.reason === reason && now - top.at < REFRESH_MS) list.shift();
  list.unshift({ id: Math.max(now, (list[0]?.id ?? 0) + 1), at: now, reason, raw });
  while (list.length > MAX_BACKUPS) dropOne(list);
  write(storage, list);
}

/** Drop the oldest automatic copy (or the oldest of all if there are none). */
function dropOne(list: Backup[]) {
  for (let i = list.length - 1; i > 0; i--) {
    if (list[i].reason === "auto" || list[i].reason === "start") {
      list.splice(i, 1);
      return;
    }
  }
  list.pop();
}

/** Write the list; if storage is full, give up the oldest copies until it fits. */
function write(storage: KeyValueStore, list: Backup[]) {
  while (list.length > 0) {
    try {
      storage.setItem(BACKUPS_KEY, JSON.stringify(list));
      return;
    } catch {
      dropOne(list);
    }
  }
  try {
    storage.removeItem(BACKUPS_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Older builds kept unreadable saves under separate keys: fold them into the list. */
export function migrateLegacyBackups(storage: KeyValueStore) {
  const prefix = `${SAVE_KEY}/backup-`;
  const found: { key: string; at: number; raw: string }[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const raw = storage.getItem(key);
    if (raw) found.push({ key, at: Number(key.slice(prefix.length)) || 0, raw });
  }
  for (const f of found.sort((a, b) => a.at - b.at)) {
    addBackup(storage, "broken", f.raw, f.at);
    storage.removeItem(f.key);
  }
}

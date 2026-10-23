import { describe, expect, it } from "vitest";
import { Game } from "@/game/engine/Game";
import { SAVE_KEY, SAVE_VERSION, deserialize, saveSummary, serialize } from "@/game/engine/save";
import { decodeSave, encodeSave } from "@/game/engine/saveCode";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { BACKUPS_KEY, MAX_BACKUPS, addBackup, listBackups, migrateLegacyBackups, type KeyValueStore } from "@/runtime/backups";
import { LOCK_STALE, TabLock } from "@/runtime/tabLock";

/** A Map-backed stand-in for localStorage. */
function memoryStorage(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

function farm() {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.state.money = 4321;
  g.rebuild();
  for (const id of ["field_wheat_2", "build_bakery", "hire_h_wheat_1", "zone_coop"]) g.completePad(g.pad(id)!);
  return g;
}

describe("save codes", () => {
  it("round-trip the whole farm through one line of text", async () => {
    const g = farm();
    const data = serialize(g.state);
    const code = await encodeSave(data);
    expect(code.startsWith(`TFE${SAVE_VERSION}.z.`)).toBe(true);
    expect(code).not.toMatch(/\s/);
    // Compressed: much shorter than the JSON.
    expect(code.length).toBeLessThan(JSON.stringify(data).length);
    const back = await decodeSave(code);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    const g2 = new Game(deserialize(back.data));
    expect(g2.state.money).toBeCloseTo(4321);
    expect(g2.state.zones.has("coop")).toBe(true);
    expect(g2.state.workers.length).toBe(1);
  });

  it("survive line breaks added by chats", async () => {
    const code = await encodeSave(serialize(farm().state));
    const wrapped = code.replace(/(.{40})/g, "$1\n  ");
    expect((await decodeSave(`  ${wrapped}  `)).ok).toBe(true);
  });

  it("reject codes that were cut off or mistyped", async () => {
    const code = await encodeSave(serialize(farm().state));
    const cut = await decodeSave(code.slice(0, code.length - 30));
    expect(cut).toEqual({ ok: false, error: expect.stringContaining("повреждён") });
    const i = code.length - 20;
    const typo = code.slice(0, i) + (code[i] === "A" ? "B" : "A") + code.slice(i + 1);
    expect((await decodeSave(typo)).ok).toBe(false);
    expect((await decodeSave("hello world")).ok).toBe(false);
  });

  it("accept a downloaded JSON file, refuse saves from a newer version", async () => {
    const json = JSON.stringify(serialize(farm().state));
    expect((await decodeSave(json)).ok).toBe(true);
    const future = await decodeSave(JSON.stringify({ v: SAVE_VERSION + 1 }));
    expect(future).toEqual({ ok: false, error: expect.stringContaining("новой версии") });
    expect((await decodeSave("{ not json")).ok).toBe(false);
  });

  it("summarise a save for previews", () => {
    const s = saveSummary(serialize(farm().state, 1_700_000_000_000))!;
    expect(s.savedAt).toBe(1_700_000_000_000);
    expect(s.money).toBeCloseTo(4321);
    expect(s.zones).toBe(2);
    expect(saveSummary("nope")).toBeNull();
    // Old v1 saves still summarise (generations used to be "seasons").
    expect(saveSummary({ v: 1, prestige: { stars: 2, seasons: 3 } })!.generations).toBe(3);
  });
});

describe("backups", () => {
  it("keep the newest copies, skip duplicates and drop automatic ones first", () => {
    const st = memoryStorage();
    const MIN = 60_000;
    addBackup(st, "reset", "R", 1);
    for (let i = 0; i < 20; i++) addBackup(st, "auto", `A${i}`, (i + 1) * 11 * MIN);
    addBackup(st, "auto", "A19", 999 * MIN);
    const list = listBackups(st);
    expect(list.length).toBe(MAX_BACKUPS);
    expect(list[0].raw).toBe("A19");
    // The copy made before a reset outlives the automatic ones.
    expect(list.some((b) => b.reason === "reset")).toBe(true);
    expect(new Set(list.map((b) => b.id)).size).toBe(list.length);
  });

  it("a fresh automatic copy replaces the previous one of its kind (reloads do not pile up)", () => {
    const st = memoryStorage();
    addBackup(st, "start", "first load", 1000);
    addBackup(st, "start", "second load", 2000);
    addBackup(st, "reset", "before reset", 3000);
    addBackup(st, "start", "third load", 4000);
    expect(listBackups(st).map((b) => b.raw)).toEqual(["third load", "before reset", "second load"]);
  });

  it("make room when storage is full instead of failing", () => {
    const st = memoryStorage();
    for (let i = 0; i < 5; i++) addBackup(st, "auto", `copy ${i}`, i);
    const set = st.setItem;
    st.setItem = (k, v) => {
      if (k === BACKUPS_KEY && String(v).length > 120) throw new Error("QuotaExceededError");
      set(k, v);
    };
    addBackup(st, "import", "the important one", 99);
    const list = listBackups(st);
    expect(list[0].raw).toBe("the important one");
    expect(list.length).toBeLessThan(6);
  });

  it("fold saves that failed to load (old separate keys) into the list", () => {
    const st = memoryStorage();
    st.setItem(`${SAVE_KEY}/backup-1700000000000`, "{broken");
    st.setItem(SAVE_KEY, "{}");
    migrateLegacyBackups(st);
    const list = listBackups(st);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ reason: "broken", raw: "{broken", at: 1700000000000 });
    expect(st.getItem(`${SAVE_KEY}/backup-1700000000000`)).toBeNull();
    expect(st.getItem(SAVE_KEY)).toBe("{}");
  });

  it("garbage in storage reads as no backups", () => {
    const st = memoryStorage();
    st.setItem(BACKUPS_KEY, "not json");
    expect(listBackups(st)).toEqual([]);
    st.setItem(BACKUPS_KEY, JSON.stringify([{ id: 1 }, null, { id: 2, at: 2, reason: "auto", raw: "x" }]));
    expect(listBackups(st)).toHaveLength(1);
  });
});

describe("tab lock", () => {
  it("lets only one tab save; a second one waits until the first is gone", () => {
    const st = memoryStorage();
    let now = 1000;
    const clock = () => now;
    const a = new TabLock("a", st, clock);
    const b = new TabLock("b", st, clock);
    expect(a.acquire()).toBe(true);
    expect(b.acquire()).toBe(false);
    expect(b.heldElsewhere()).toBe(true);
    now += 1500;
    expect(a.beat()).toBe(true);
    // Tab A is closed (no more heartbeats): B may take over after a while.
    now += LOCK_STALE + 100;
    expect(b.acquire()).toBe(true);
    expect(a.beat()).toBe(false);
    expect(a.owns()).toBe(false);
  });

  it("'play here' takes the lock over; the old tab notices and stops", () => {
    const st = memoryStorage();
    const a = new TabLock("a", st, () => 0);
    const b = new TabLock("b", st, () => 0);
    a.acquire();
    expect(b.acquire(true)).toBe(true);
    expect(b.owns()).toBe(true);
    expect(a.beat()).toBe(false);
  });

  it("a reload of the same tab (same id) gets straight back in", () => {
    const st = memoryStorage();
    new TabLock("a", st, () => 0).acquire();
    expect(new TabLock("a", st, () => 10).acquire()).toBe(true);
    const a = new TabLock("a", st, () => 20);
    a.release();
    expect(new TabLock("c", st, () => 30).acquire()).toBe(true);
  });
});

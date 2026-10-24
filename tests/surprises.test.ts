/** Phase 20: golden plants, the travelling merchant, runaways, the album and the whistle. */
import { describe, expect, it } from "vitest";
import { ALL_FINDS, FIND_SETS, SET_BONUS, findSetOf } from "@/game/data/finds";
import { MERCHANT_SPOTS } from "@/game/data/layout";
import {
  GOLDEN_EVERY,
  GOLDEN_LIFE,
  MERCHANT_DRIVE,
  MERCHANT_MULT,
  MERCHANT_WAIT,
  RUNAWAY_LIFE,
  RUSH_MULT,
  RUSH_TIME,
  WHISTLE_COOLDOWN,
  WHISTLE_TIME,
} from "@/game/data/surprises";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { rollFind } from "@/game/engine/systems/album";
import { makeOrder } from "@/game/engine/systems/orders";
import { workerBoost } from "@/game/engine/systems/surprises";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import type { GameEvent } from "@/game/engine/types";
import { isLand } from "@/game/engine/world";
import { DT, run, wait } from "./helpers";

function unlocked(...pads: string[]) {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.rebuild();
  for (const id of pads) g.completePad(g.pad(id)!);
  // No surprises unless a test asks for one.
  const s = g.state.surprises;
  s.goldenIn = s.merchantIn = s.runawayIn = 1e9;
  return g;
}

const roundTrip = (g: Game) => new Game(deserialize(JSON.parse(JSON.stringify(serialize(g.state)))));
const eventsOf = <T extends GameEvent["type"]>(g: Game, type: T) =>
  g.drainEvents().filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Far from every field, next to the market. */
const awayFromFields = (g: Game) => {
  g.state.player.x = 7;
  g.state.player.z = 9.5;
};

/** Run after the runaway the way a player would: along a path towards it. */
function chase(g: Game, seconds: number) {
  const p = g.state.player;
  for (let t = 0; t < seconds; t += DT) {
    const r = g.state.surprises.runaway;
    if (!r) return true;
    const next = g.nav.findPath(p.x, p.z, r.x, r.z)?.[0] ?? r;
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    g.input.x = dx / d;
    g.input.z = dz / d;
    g.tick(DT);
  }
  g.input.x = g.input.z = 0;
  return !g.state.surprises.runaway;
}

describe("surprises in general", () => {
  it("wait for the tutorial to be over", () => {
    const g = new Game();
    run(g, 500);
    expect(g.state.surprises.golden).toBeNull();
    expect(g.state.surprises.merchant).toBeNull();
    expect(g.state.surprises.runaway).toBeNull();
  });

  it("all come by themselves once the farm is running", () => {
    const g = unlocked("zone_coop", "build_coop", "build_bakery");
    const s = g.state.surprises;
    s.goldenIn = 1;
    s.merchantIn = 2;
    s.runawayIn = 3;
    awayFromFields(g);
    wait(g, 4);
    expect(s.golden).not.toBeNull();
    expect(s.merchant).not.toBeNull();
    expect(s.runaway).not.toBeNull();
    expect(g.surpriseTargets().map((t) => t.kind).sort()).toEqual(["golden", "merchant", "runaway"]);
  });
});

describe("golden plants", () => {
  /** A golden plant on wheat_2, every other plant unripe. */
  function withGolden(...pads: string[]) {
    const g = unlocked("field_wheat_2", ...pads);
    for (const f of g.state.fields) for (const p of f.plants) p.growth = 0;
    const plant = g.state.fields.find((f) => f.id === "wheat_2")!.plants[12];
    plant.growth = 1;
    g.state.surprises.golden = { field: "wheat_2", plant: 12, t: GOLDEN_LIFE };
    awayFromFields(g);
    return { g, plant };
  }

  it("appear ripe, away from the farmer", () => {
    const g = unlocked("field_wheat_2", "field_wheat_3");
    for (const f of g.state.fields) for (const p of f.plants) p.growth = 0;
    g.state.surprises.goldenIn = 0.01;
    g.tick(DT);
    const s = g.state.surprises;
    expect(s.golden).not.toBeNull();
    const plant = g.state.fields.find((f) => f.id === s.golden!.field)!.plants[s.golden!.plant];
    expect(plant.growth).toBe(1);
    expect(Math.hypot(plant.x - g.state.player.x, plant.z - g.state.player.z)).toBeGreaterThan(6);
    expect(eventsOf(g, "golden")[0]).toMatchObject({ state: "spawn" });
  });

  it("are left alone by workers", () => {
    const { g, plant } = withGolden("hire_h_wheat_1");
    run(g, 20);
    expect(plant.growth).toBe(1);
    expect(g.state.surprises.golden).not.toBeNull();
    // …who do harvest the rest as it ripens.
    for (const p of g.state.fields[0].plants) p.growth = 1;
    run(g, 15);
    expect(g.state.stats.harvested).toBeGreaterThan(0);
    expect(plant.growth).toBe(1);
  });

  it("are picked by walking up to them, even with full hands", () => {
    const { g, plant } = withGolden();
    const p = g.state.player;
    p.stack = Array(p.capacity).fill("wheat");
    p.x = plant.x;
    p.z = plant.z + 0.3;
    g.tick(DT);
    expect(g.state.surprises.golden).toBeNull();
    expect(g.state.stats.golden).toBe(1);
    const next = g.state.surprises.goldenIn;
    expect(next).toBeGreaterThanOrEqual(GOLDEN_EVERY.min);
    expect(next).toBeLessThanOrEqual(GOLDEN_EVERY.min + GOLDEN_EVERY.spread);
  });

  it("give a rush, a bag of money or a harvest boom", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 100 && seen.size < 3; seed++) {
      const { g, plant } = withGolden("build_bakery");
      g.state.surprises.seed = seed;
      g.state.player.x = plant.x;
      g.state.player.z = plant.z;
      g.tick(DT);
      const e = eventsOf(g, "golden").find((x) => x.state === "collect");
      if (!e || e.state !== "collect") throw new Error("not collected");
      seen.add(e.reward);
      if (e.reward === "rush") {
        expect(g.state.surprises.rush).toBeCloseTo(RUSH_TIME, 0);
        expect(g.salePrice("bread")).toBeCloseTo(g.sellValue("bread") * RUSH_MULT);
      } else if (e.reward === "money") {
        expect(e.value).toBeGreaterThan(0);
        expect(g.state.money).toBe(e.value);
      } else {
        expect(e.value).toBeGreaterThan(40);
        for (const f of g.state.fields) for (const p of f.plants) expect(p.growth).toBe(1);
      }
    }
    expect([...seen].sort()).toEqual(["bloom", "money", "rush"]);
  });

  it("a bag of money is worth about a minute of the farm's income", () => {
    const { g, plant } = withGolden("build_bakery");
    g.state.autoIncome.rate = 1000;
    for (let seed = 1; seed < 100; seed++) {
      g.state.surprises.seed = seed;
      g.state.surprises.golden = { field: "wheat_2", plant: 12, t: GOLDEN_LIFE };
      plant.growth = 1;
      g.state.player.x = plant.x;
      g.state.player.z = plant.z;
      g.tick(DT);
      const e = eventsOf(g, "golden").find((x) => x.state === "collect");
      if (e?.state === "collect" && e.reward === "money") {
        expect(e.value).toBe(60_000);
        return;
      }
      awayFromFields(g);
      g.state.surprises.rush = 0;
    }
    throw new Error("no money reward in 100 seeds");
  });

  it("on a tree or a fishing spot are picked from where you would harvest them", () => {
    const g = unlocked("zone_orchard", "zone_garden", "zone_pond");
    awayFromFields(g);
    for (const id of ["apple_1", "fish_1"]) {
      const f = g.state.fields.find((x) => x.id === id)!;
      g.state.surprises.golden = { field: id, plant: 0, t: GOLDEN_LIFE };
      const p = f.plants[0];
      // Where a worker would stand: next to the tree, on the shore.
      g.state.player.x = p.sx + (id === "apple_1" ? 1.2 : 0);
      g.state.player.z = p.sz;
      g.tick(DT);
      expect(g.state.surprises.golden, id).toBeNull();
      awayFromFields(g);
    }
    expect(g.state.stats.golden).toBe(2);
  });

  it("fade if nobody comes", () => {
    const { g } = withGolden();
    wait(g, GOLDEN_LIFE + 1);
    expect(g.state.surprises.golden).toBeNull();
    expect(eventsOf(g, "golden").some((e) => e.state === "fade")).toBe(true);
    expect(g.state.stats.golden).toBe(0);
  });
});

describe("the gold rush", () => {
  it("doubles every sale for a minute — but not the order bonuses", () => {
    const g = unlocked("build_bakery");
    const reward = makeOrder(g)!.reward;
    g.state.surprises.rush = RUSH_TIME;
    expect(g.salePrice("bread")).toBeCloseTo(2 * g.sellValue("bread"));
    expect(makeOrder(g)!.reward).toBe(reward);
    wait(g, RUSH_TIME + 0.5);
    expect(g.state.surprises.rush).toBe(0);
    expect(g.salePrice("bread")).toBe(g.sellValue("bread"));
    expect(eventsOf(g, "rushEnd").length).toBe(1);
  });

  it("a rush or the whistle does not inflate the income estimate offline earnings are paid from", () => {
    for (const boost of ["rush", "whistle"] as const) {
      const g = unlocked();
      g.state.autoIncome.rate = 100;
      g.state.surprises[boost] = 5;
      g.earn(30_000, true);
      run(g, 16);
      expect(g.state.autoIncome.rate, boost).toBe(100);
      // The next, ordinary window counts again.
      g.earn(3000, true);
      run(g, 15);
      expect(g.state.autoIncome.rate, boost).toBeCloseTo(140, 0);
    }
  });
});

describe("the travelling merchant", () => {
  function withMerchant() {
    const g = unlocked("zone_coop", "build_bakery");
    g.state.surprises.merchantIn = 0.01;
    awayFromFields(g);
    g.tick(DT);
    const m = g.state.surprises.merchant!;
    expect(m).not.toBeNull();
    return { g, m };
  }

  it("parks at an owned plot and wants one of the farm's goods", () => {
    const { g, m } = withMerchant();
    // The farm itself has no spot: the coop is the only place.
    expect(m.zone).toBe("coop");
    expect(MERCHANT_SPOTS.coop).toMatchObject({ x: m.x, z: m.z });
    expect(["bread", "flour"]).toContain(m.item);
    expect(m.need).toBeGreaterThanOrEqual(4);
    expect(g.state.obstacles.some((o) => o.x === m.x && o.z === m.z)).toBe(true);
    expect(g.interactById("merchant")).toBeTruthy();
    expect(eventsOf(g, "merchant")[0]).toMatchObject({ state: "arrive", item: m.item, need: m.need });
  });

  it("buys his goods at a premium, only those, and drives off when he has enough", () => {
    const { g, m } = withMerchant();
    wait(g, MERCHANT_DRIVE + 0.1);
    expect(m.phase).toBe("wait");
    const p = g.state.player;
    p.stack = ["wheat", ...Array(m.need).fill(m.item)];
    const zone = g.interactById("merchant")!;
    p.x = zone.rect.x;
    p.z = zone.rect.z;
    const price = g.sellValue(m.item) * MERCHANT_MULT;
    wait(g, 6);
    expect(m.have).toBe(m.need);
    expect(p.stack).toEqual(["wheat"]);
    expect(g.state.money).toBeCloseTo(price * m.need, 4);
    expect(g.state.stats.merchants).toBe(1);
    expect(eventsOf(g, "merchant").find((e) => e.state === "done")).toMatchObject({ earned: expect.closeTo(price * m.need, 4) });
    wait(g, MERCHANT_DRIVE + 0.2);
    expect(g.state.surprises.merchant).toBeNull();
    expect(g.interactById("merchant")).toBeUndefined();
    expect(g.state.obstacles.some((o) => o.x === m.x && o.z === m.z)).toBe(false);
  });

  it("drives on if nobody brings anything", () => {
    const { g } = withMerchant();
    wait(g, MERCHANT_DRIVE * 2 + MERCHANT_WAIT + 1);
    expect(g.state.surprises.merchant).toBeNull();
    expect(eventsOf(g, "merchant").map((e) => e.state)).toEqual(["arrive", "leave"]);
    expect(g.state.stats.merchants).toBe(0);
  });

  it("only comes once the farm has goods and a second plot", () => {
    const g = unlocked();
    g.state.surprises.merchantIn = 0.01;
    wait(g, 1);
    expect(g.state.surprises.merchant).toBeNull();
    expect(g.state.surprises.merchantIn).toBeGreaterThan(0);
  });
});

describe("runaway animals", () => {
  function withRunaway() {
    const g = unlocked("zone_coop", "build_coop");
    g.state.surprises.runawayIn = 0.01;
    awayFromFields(g);
    g.tick(DT);
    const r = g.state.surprises.runaway!;
    expect(r).not.toBeNull();
    return { g, r };
  }

  it("get out of a pen that exists", () => {
    const { g, r } = withRunaway();
    expect(r.kind).toBe("chicken");
    expect(eventsOf(g, "runaway")[0]).toMatchObject({ state: "escape", kind: "chicken" });
    const none = unlocked();
    none.state.surprises.runawayIn = 0.01;
    wait(none, 1);
    expect(none.state.surprises.runaway).toBeNull();
  });

  it("do not get out right under the farmer's nose", () => {
    const g = unlocked("zone_coop", "build_coop");
    const gate = g.machine("coop")!.outRect;
    g.state.player.x = gate.x;
    g.state.player.z = gate.z;
    g.state.surprises.runawayIn = 0.01;
    wait(g, 1);
    expect(g.state.surprises.runaway).toBeNull();
    expect(g.state.stats.caught).toBe(0);
    // Once the farmer walks off, it tries again.
    awayFromFields(g);
    wait(g, 16);
    expect(g.state.surprises.runaway).not.toBeNull();
  });

  it("wander the same way at any frame rate", () => {
    const targets = (fps: number) => {
      const g = unlocked("zone_coop", "build_coop");
      g.state.surprises.runawayIn = 0.01;
      awayFromFields(g);
      g.tick(1 / fps);
      let n = 0;
      let last = "";
      for (let t = 0; t < 30; t += 1 / fps) {
        g.tick(1 / fps);
        const r = g.state.surprises.runaway;
        if (!r) break;
        const key = `${r.tx},${r.tz}`;
        if (key !== last) n++;
        last = key;
      }
      return n;
    };
    expect(targets(240)).toBeLessThanOrEqual(targets(30) * 2 + 2);
  });

  it("run from the farmer", () => {
    const { g, r } = withRunaway();
    wait(g, 3);
    const p = g.state.player;
    p.x = r.x + 2;
    p.z = r.z;
    const before = Math.hypot(r.x - p.x, r.z - p.z);
    wait(g, 0.4);
    expect(Math.hypot(r.x - p.x, r.z - p.z)).toBeGreaterThan(before);
  });

  it("can be caught by chasing, for money, and never leave the farm", () => {
    const { g } = withRunaway();
    let onLand = true;
    const origTick = g.tick.bind(g);
    g.tick = (dt: number) => {
      origTick(dt);
      const r = g.state.surprises.runaway;
      if (r && !isLand(g.state, r.x, r.z, 0.3)) onLand = false;
    };
    expect(chase(g, 40)).toBe(true);
    expect(onLand).toBe(true);
    expect(g.state.stats.caught).toBe(1);
    const e = eventsOf(g, "runaway").find((x) => x.state === "caught")!;
    expect(e.value).toBeGreaterThan(0);
    expect(g.state.money).toBe(e.value);
  });

  it("go home by themselves after a while", () => {
    const { g } = withRunaway();
    wait(g, RUNAWAY_LIFE + 30);
    expect(g.state.surprises.runaway).toBeNull();
    expect(eventsOf(g, "runaway").map((e) => e.state)).toEqual(["escape", "home"]);
    expect(g.state.stats.caught).toBe(0);
  });
});

describe("the album", () => {
  it("has a set of three for every plot with fields", () => {
    expect(ALL_FINDS.length).toBe(FIND_SETS.length * 3);
    expect(new Set(ALL_FINDS).size).toBe(ALL_FINDS.length);
    expect(findSetOf("depot")).toBeUndefined();
  });

  it("fills up from harvests; a full set reports itself once and stops", () => {
    const g = unlocked();
    for (let i = 0; i < 5000 && g.state.album.size < 3; i++) rollFind(g, "farm", 0, 0);
    expect(g.state.album.size).toBe(3);
    const finds = eventsOf(g, "find");
    expect(finds.length).toBe(3);
    expect(finds.map((e) => e.complete)).toEqual([false, false, true]);
    for (let i = 0; i < 3000; i++) rollFind(g, "farm", 0, 0);
    expect(g.state.album.size).toBe(3);
    rollFind(g, "depot", 0, 0);
    expect(g.state.album.size).toBe(3);
  });

  it("only the farmer finds things", () => {
    const g = unlocked("hire_h_wheat_1");
    awayFromFields(g);
    const seed = g.state.surprises.seed;
    run(g, 40);
    expect(g.state.stats.harvested).toBeGreaterThan(5);
    expect(g.state.surprises.seed).toBe(seed);
    // The farmer's harvests roll the dice.
    const f = g.state.fields[0];
    for (const p of f.plants) p.growth = 1;
    g.state.player.x = f.plants[0].x;
    g.state.player.z = f.plants[0].z;
    wait(g, 0.2);
    expect(g.state.surprises.seed).not.toBe(seed);
  });

  it("a full set makes the plot's goods dearer", () => {
    const g = unlocked("build_bakery");
    const bread = g.sellValue("bread");
    const cheese = g.sellValue("cheese");
    for (const f of findSetOf("farm")!.finds) g.state.album.add(f.id);
    expect(g.sellValue("bread")).toBeCloseTo(bread * (1 + SET_BONUS));
    expect(g.sellValue("cheese")).toBe(cheese);
  });

  it("a full album earns the pith helmet", () => {
    const g = unlocked();
    for (const id of ALL_FINDS) g.state.album.add(id);
    run(g, 1);
    expect(g.state.achievements.has("album")).toBe(true);
    expect(g.state.achievements.has("finds_10")).toBe(true);
    expect(g.hats()).toContain("explorer");
  });

  it("is the family's: kept by the next generation and in saves", () => {
    const g = unlocked();
    g.state.album.add("farm_key");
    g.state.album.add("pond_ring");
    const loaded = roundTrip(g);
    expect([...loaded.state.album].sort()).toEqual(["farm_key", "pond_ring"]);
    loaded.state.statue = true;
    expect(loaded.prestige()).toBe(true);
    expect(loaded.state.album.has("pond_ring")).toBe(true);
    const data = serialize(g.state);
    data.album = ["farm_key", "no_such_find"];
    expect([...deserialize(data).album]).toEqual(["farm_key"]);
  });
});

describe("the foreman's whistle", () => {
  it("needs workers, lasts half a minute and then needs a rest", () => {
    expect(unlocked().whistle()).toBe(false);
    const g = unlocked("hire_h_wheat_1");
    expect(g.canWhistle()).toBe(true);
    expect(g.whistle()).toBe(true);
    expect(workerBoost(g.state)).toBe(2);
    expect(g.whistle()).toBe(false);
    run(g, WHISTLE_TIME + 0.1);
    expect(workerBoost(g.state)).toBe(1);
    expect(g.canWhistle()).toBe(false);
    run(g, WHISTLE_COOLDOWN - WHISTLE_TIME);
    expect(g.canWhistle()).toBe(true);
    expect(eventsOf(g, "whistle").map((e) => e.state)).toEqual(["start", "end"]);
    expect(g.state.stats.whistles).toBe(1);
  });

  it("makes workers run twice as fast", () => {
    const topSpeed = (whistle: boolean) => {
      const g = unlocked("field_wheat_2", "hire_h_wheat_1");
      awayFromFields(g);
      if (whistle) g.whistle();
      let top = 0;
      for (let t = 0; t < 20; t += DT) {
        g.tick(DT);
        const w = g.state.workers[0];
        top = Math.max(top, Math.hypot(w.vx, w.vz));
      }
      return top;
    };
    const ratio = topSpeed(true) / topSpeed(false);
    expect(ratio).toBeGreaterThan(1.8);
    expect(ratio).toBeLessThan(2.2);
  });
});

describe("saving events", () => {
  it("timers, the golden plant, the merchant, the runaway and the whistle survive a reload", () => {
    const g = unlocked("zone_coop", "build_coop", "build_bakery", "hire_h_wheat_1");
    const s = g.state.surprises;
    s.goldenIn = s.merchantIn = s.runawayIn = 0.01;
    awayFromFields(g);
    wait(g, MERCHANT_DRIVE + 0.2);
    g.whistle();
    s.rush = 12;
    s.merchant!.have = 2;
    const loaded = roundTrip(g);
    const l = loaded.state.surprises;
    expect(l.seed).toBe(s.seed);
    expect(l.golden).toEqual({ ...s.golden, t: expect.closeTo(s.golden!.t, 1) });
    expect(l.merchant).toMatchObject({ zone: s.merchant!.zone, item: s.merchant!.item, need: s.merchant!.need, have: 2, phase: "wait" });
    expect(l.runaway).toMatchObject({ kind: s.runaway!.kind, x: expect.closeTo(s.runaway!.x, 1), z: expect.closeTo(s.runaway!.z, 1) });
    expect(l.whistle).toBeCloseTo(s.whistle, 1);
    expect(l.whistleCd).toBeCloseTo(s.whistleCd, 1);
    expect(l.rush).toBeCloseTo(12, 1);
    // The cart still blocks its spot after loading.
    expect(loaded.interactById("merchant")).toBeTruthy();
  });

  it("drop events that no longer fit the farm", () => {
    const g = unlocked("zone_coop", "build_coop", "build_bakery");
    const s = g.state.surprises;
    s.merchantIn = s.runawayIn = 0.01;
    awayFromFields(g);
    wait(g, 0.5);
    const data = serialize(g.state);
    data.surprises!.merchant!.zone = "pond";
    data.surprises!.runaway!.kind = "dragon";
    data.surprises!.golden = { field: "pumpkins_2", plant: 0, t: 10 };
    const st = deserialize(data);
    expect(st.surprises.merchant).toBeNull();
    expect(st.surprises.runaway).toBeNull();
    expect(st.surprises.golden).toBeNull();
  });
});

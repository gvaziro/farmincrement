import { describe, expect, it } from "vitest";
import { CROPS } from "@/game/data/crops";
import { ISLAND_FIELDS, ISLAND_LAYOUT, ISLAND_MACHINES, ISLAND_PADS, ISLAND_ZONES, ISLE_STARS, LIGHTHOUSE_STARS, SEAPLANE_STOP, STRAIT } from "@/game/data/island";
import { isSellable } from "@/game/data/items";
import { fieldById, machineById, zoneRect } from "@/game/data/layout";
import { MACHINE_TYPES } from "@/game/data/machines";
import { Game } from "@/game/engine/Game";
import { loadGame, serializeGame } from "@/game/engine/save";
import { seasonBlend } from "@/game/engine/seasons";
import { frozenSeason } from "@/game/engine/challenges";
import { TUTORIAL_DONE, tutorialText } from "@/game/engine/tutorial";
import { WEATHER_CHANCES, weatherOfDay } from "@/game/engine/weather";
import { createField, createInitialState } from "@/game/engine/world";
import { run, walkTo } from "./helpers";

type R = { id: string; x: number; z: number; hw: number; hd: number };
const overlap = (a: R, b: R) => Math.abs(a.x - b.x) < a.hw + b.hw - 0.05 && Math.abs(a.z - b.z) < a.hd + b.hd - 0.05;

/** A family that has finished the city: the seaplane flies. */
function readyForIsland() {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.state.statue = true;
  g.state.bus = true;
  g.rebuild();
  g.travel("city");
  g.state.city!.finished = true;
  g.state.city!.floors = 5;
  g.state.tutorial = TUTORIAL_DONE;
  return g;
}

function onIsland() {
  const g = readyForIsland();
  g.travel("island");
  g.state.tutorial = TUTORIAL_DONE;
  g.state.penny.rate = 0;
  g.rebuild();
  g.drainEvents();
  return g;
}

/** Every plot open, every hut built: for the geometry checks. */
function fullIsland() {
  const g = new Game(createInitialState("island"));
  g.state.tutorial = TUTORIAL_DONE;
  for (const z of ISLAND_ZONES) g.state.zones.add(z.id);
  g.rebuild();
  for (let k = 0; k < 400; k++) {
    let any = false;
    for (const p of g.state.pads) {
      if (!p.visible || p.def.repeatable) continue;
      g.completePad(p);
      any = true;
    }
    if (!any) break;
  }
  return g;
}

describe("island data", () => {
  it("pad requirements exist and everything can be reached", () => {
    const ids = new Set(ISLAND_PADS.map((p) => p.id));
    expect(ids.size).toBe(ISLAND_PADS.length);
    for (const p of ISLAND_PADS) for (const r of p.requires) expect(ids.has(r), `${p.id} requires ${r}`).toBe(true);
    const g = fullIsland();
    const left = g.state.pads.filter((p) => !p.done && !p.def.repeatable).map((p) => p.id);
    expect(left).toEqual([]);
    expect(g.state.statue).toBe(true);
  });

  it("every field and hut can be owned", () => {
    for (const f of ISLAND_FIELDS) {
      const viaZone = ISLAND_ZONES.some((z) => z.includes.includes(f.id));
      const viaPad = ISLAND_PADS.some((p) => p.effect.type === "field" && p.effect.id === f.id);
      expect(viaZone || viaPad || ISLAND_LAYOUT.startFields.includes(f.id), f.id).toBe(true);
    }
    for (const m of ISLAND_MACHINES) {
      const viaPad = ISLAND_PADS.some((p) => p.effect.type === "machine" && p.effect.id === m.id);
      expect(viaPad || ISLAND_LAYOUT.startMachines.includes(m.id), m.id).toBe(true);
    }
  });

  it("worker jobs fit the huts", () => {
    for (const p of ISLAND_PADS) {
      if (p.effect.type !== "worker") continue;
      const job = p.effect.worker.job;
      if (job.kind === "harvester") {
        const target = MACHINE_TYPES[machineById(job.target).type];
        for (const f of job.fields) expect(target.inputs.some((i) => i.item === CROPS[fieldById(f).crop].item), `${p.id}`).toBe(true);
      }
      if (job.kind === "carrier") {
        const out = MACHINE_TYPES[machineById(job.source).type].output.item;
        if (job.target.kind === "machine") expect(MACHINE_TYPES[machineById(job.target.id).type].inputs.some((i) => i.item === out), p.id).toBe(true);
        else expect(isSellable(out), p.id).toBe(true);
      }
    }
  });

  it("every hut's inputs are brought by someone", () => {
    for (const m of ISLAND_MACHINES) {
      for (const inp of MACHINE_TYPES[m.type].inputs) {
        const fed = ISLAND_PADS.some((p) => {
          if (p.effect.type !== "worker") return false;
          const j = p.effect.worker.job;
          if (j.kind === "harvester") return j.target === m.id && j.fields.some((f) => CROPS[fieldById(f).crop].item === inp.item);
          if (j.kind === "carrier") return j.target.kind === "machine" && j.target.id === m.id && MACHINE_TYPES[machineById(j.source).type].output.item === inp.item;
          return false;
        });
        expect(fed, `${m.id} needs ${inp.item}`).toBe(true);
      }
    }
  });

  it("pads, huts, fields and water do not overlap", () => {
    const g = fullIsland();
    const L = ISLAND_LAYOUT;
    const rects: R[] = [];
    for (const p of ISLAND_PADS) rects.push({ id: `pad ${p.id}`, x: p.x, z: p.z, hw: p.size / 2, hd: p.size / 2 });
    for (const m of g.state.machines) {
      rects.push({ id: `body ${m.id}`, ...m.body });
      rects.push({ id: `in ${m.id}`, ...m.inRect });
      rects.push({ id: `out ${m.id}`, ...m.outRect });
    }
    rects.push({ id: "market", x: L.market.x, z: L.market.z, hw: L.market.w / 2, hd: L.market.d / 2 });
    rects.push({ id: "sell", x: L.market.sell.x, z: L.market.sell.z, hw: L.market.sell.w / 2, hd: L.market.sell.d / 2 });
    rects.push({ id: "trash", x: L.trash.x, z: L.trash.z - 0.45, hw: L.trash.w / 2, hd: L.trash.d / 2 + 0.45 });
    rects.push({ id: "house", x: L.farmhouse.x, z: L.farmhouse.z, hw: L.farmhouse.w / 2, hd: L.farmhouse.d / 2 });
    rects.push({ id: "door", x: L.farmhouse.door.x, z: L.farmhouse.door.z, hw: L.farmhouse.door.w / 2, hd: L.farmhouse.door.d / 2 });
    rects.push({ id: "depot", x: L.depot.x, z: L.depot.z, hw: L.depot.w / 2, hd: L.depot.d / 2 });
    rects.push({ id: "depot input", x: L.depot.input.x, z: L.depot.input.z, hw: L.depot.input.w / 2, hd: L.depot.input.d / 2 });
    rects.push({ id: "seaplane", x: SEAPLANE_STOP.x, z: SEAPLANE_STOP.z, hw: SEAPLANE_STOP.w / 2, hd: SEAPLANE_STOP.d / 2 });
    for (const f of ISLAND_FIELDS) {
      const c = CROPS[f.crop];
      if (c.kind === "water") {
        for (const p of createField(f, false).plants) rects.push({ id: `field ${f.id}`, x: p.x, z: p.z, hw: 0.45, hd: 0.45 });
        continue;
      }
      const ff = createField(f, false);
      rects.push({ id: `field ${f.id}`, ...ff.rect });
    }
    for (const [zone, m] of Object.entries(L.merchantSpots)) rects.push({ id: `merchant ${zone}`, x: m!.x, z: m!.z + 0.75, hw: 1.8, hd: 1.75 });
    for (const [i, w] of L.water.entries()) rects.push({ id: `water ${i}`, ...w });
    const hits: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const pair = (p: string, q: string) => (a.id.startsWith(p) && b.id.startsWith(q)) || (b.id.startsWith(p) && a.id.startsWith(q));
        if (a.id.startsWith("pad field_") && b.id === `field ${a.id.slice(10)}`) continue;
        if (b.id.startsWith("pad field_") && a.id === `field ${b.id.slice(10)}`) continue;
        if (pair("pad hire_", "pad hire_")) continue;
        if (pair("pad build_", "in ") || pair("pad build_", "out ")) continue;
        if (pair("pad statue", "")) continue;
        const wet = (r: R) => r.id.startsWith("field lag") || r.id.startsWith("field oys") || r.id.startsWith("pad field_lag") || r.id.startsWith("pad field_oys");
        if ((a.id.startsWith("water") && wet(b)) || (b.id.startsWith("water") && wet(a))) continue;
        if (pair("water", "water")) continue;
        if (overlap(a, b)) hits.push(`${a.id} ↔ ${b.id}`);
      }
    }
    expect(hits.join(" | ")).toBe("");
  });

  it("everything stands on its own plot, clear of the straits", () => {
    const g = fullIsland();
    const inside = (id: string, x: number, z: number, hw: number, hd: number, zone: string) => {
      const r = zoneRect(ISLAND_ZONES.find((zz) => zz.id === zone)!);
      const m = STRAIT / 2 - 0.01;
      expect(Math.abs(x - r.x) + hw, id).toBeLessThanOrEqual(r.hw - m + 0.01);
      expect(Math.abs(z - r.z) + hd, id).toBeLessThanOrEqual(r.hd - m + 0.01);
    };
    for (const p of ISLAND_PADS) inside(p.id, p.x, p.z, p.size / 2, p.size / 2, p.zone);
    for (const m of g.state.machines) {
      inside(m.id, m.body.x, m.body.z, m.body.hw, m.body.hd, m.def.zone);
      inside(`${m.id} out`, m.outRect.x, m.outRect.z, m.outRect.hw, m.outRect.hd, m.def.zone);
    }
  });

  it("with every plot open, every hut and pad can be walked to", () => {
    const g = fullIsland();
    const from = ISLAND_LAYOUT.spawn;
    for (const m of g.state.machines) {
      expect(g.nav.findPath(from.x, from.z, m.inRect.x, m.inRect.z), `in ${m.id}`).not.toBeNull();
      expect(g.nav.findPath(from.x, from.z, m.outRect.x, m.outRect.z), `out ${m.id}`).not.toBeNull();
    }
    for (const p of ISLAND_PADS) expect(g.nav.findPath(from.x, from.z, p.x, p.z), p.id).not.toBeNull();
    // The straits are water: you cannot walk across them except on a bridge.
    expect(g.nav.isFree(13, 6)).toBe(false);
    expect(g.nav.isFree(13, 0)).toBe(true);
  });
});

describe("getting there", () => {
  it("the seaplane flies only once the tower stands", () => {
    const g = new Game();
    g.state.statue = true;
    g.state.bus = true;
    g.state.tutorial = TUTORIAL_DONE;
    g.rebuild();
    expect(g.destinations()).toEqual(["city"]);
    g.travel("city");
    expect(g.destinations()).toEqual(["farm"]);
    expect(g.travel("island")).toBeNull();
    g.state.city!.finished = true;
    expect(g.destinations()).toEqual(["farm", "island"]);
  });

  it("a new island: its own wallet, a beach and a juicer, and the way back", () => {
    const g = readyForIsland();
    g.state.money = 999;
    g.travel("island");
    const st = g.state;
    expect(st.world).toBe("island");
    expect(st.money).toBe(0);
    expect([...st.zones]).toEqual(["i_beach"]);
    expect(st.machines.map((m) => m.id)).toEqual(["i_juicer"]);
    expect(st.penny.rate).toBeGreaterThan(0);
    expect(g.destinations()).toEqual(["farm", "city"]);
    g.travel("city");
    expect(g.state.money).toBe(999);
    g.travel("island");
    expect(g.state).toBe(st);
  });

  it("the island's first steps: pineapples, juice, the market, a pad", () => {
    const g = readyForIsland();
    g.travel("island");
    const st = g.state;
    st.penny.rate = 0;
    expect(tutorialText(g)).toContain("ананас");
    const f = st.fields[0];
    expect(walkTo(g, f.def.x, f.def.z, 40)).toBe(true);
    for (let i = 0; i < 40 && st.tutorial === 0; i++) {
      walkTo(g, f.def.x + ((i % 5) - 2) * 1.05, f.def.z + (Math.floor(i / 5) % 4 - 1.5) * 1.05, 5);
    }
    expect(st.tutorial).toBe(1);
    const juicer = g.machine("i_juicer")!;
    expect(walkTo(g, juicer.inRect.x, juicer.inRect.z)).toBe(true);
    run(g, 2);
    expect(st.tutorial).toBe(2);
    expect(walkTo(g, juicer.outRect.x, juicer.outRect.z)).toBe(true);
    for (let i = 0; i < 20 && st.tutorial === 2; i++) run(g, 1);
    expect(st.tutorial).toBe(3);
    const sell = ISLAND_LAYOUT.market.sell;
    expect(walkTo(g, sell.x, sell.z)).toBe(true);
    run(g, 2);
    expect(st.tutorial).toBe(4);
    expect(st.money).toBeGreaterThan(0);
    expect(g.pad("field_pine_2")?.visible).toBe(true);
  });

  it("eternal summer: the calendar runs, but no snow and no autumn leaves", () => {
    const g = onIsland();
    const st = g.state;
    expect(frozenSeason(st)).toBe("tropical");
    st.dayClock = 6.5 * 600;
    run(g, 0.1);
    expect(st.season).toBe("winter");
    expect(seasonBlend(st.dayClock, frozenSeason(st))).toEqual({ a: "summer", b: "summer", k: 0 });
    for (let day = 2; day < 200; day++) expect(weatherOfDay(day, "tropical").kind).not.toBe("snow");
    expect(WEATHER_CHANCES.winter.some(([k]) => k === "snow")).toBe(true);
  });
});

describe("life on the island", () => {
  it("each new island pays stars, and the lighthouse ends the chapter", () => {
    const g = onIsland();
    const st = g.state;
    const stars = st.prestige.stars;
    g.completePad(g.pad("zone_i_bananas")!);
    expect(st.prestige.stars).toBe(stars + ISLE_STARS);
    st.zones.add("i_harbor");
    g.rebuild();
    const statue = g.pad("statue")!;
    g.completePad(statue);
    const done = g.drainEvents().find((e) => e.type === "chapterDone");
    expect(done).toMatchObject({ world: "island", stars: LIGHTHOUSE_STARS });
    expect(st.statue).toBe(true);
  });

  it("the islands make the farm and the city dearer", () => {
    const g = onIsland();
    g.travel("farm");
    const plain = g.priceMult();
    g.travel("island");
    g.completePad(g.pad("zone_i_bananas")!);
    g.travel("farm");
    expect(g.priceMult()).toBeGreaterThan(plain);
  });

  it("a monkey runs off from the banana dryer", () => {
    const g = onIsland();
    const st = g.state;
    st.zones.add("i_bananas");
    g.rebuild();
    g.completePad(g.pad("build_i_dryer")!);
    st.player.x = -9;
    st.player.z = -6;
    st.surprises.runawayIn = 0.05;
    run(g, 1);
    expect(st.surprises.runaway?.kind).toBe("monkey");
  });

  it("boats take goods from the harbour", () => {
    const g = onIsland();
    const st = g.state;
    g.completePad(g.pad("zone_i_bananas")!);
    st.zones.add("i_palms");
    g.completePad(g.pad("zone_i_harbor")!);
    expect(st.depot).not.toBeNull();
    st.depot!.storage = Array.from({ length: 20 }, () => "icepop" as const);
    const before = st.money;
    run(g, 40);
    expect(st.money).toBeGreaterThan(before);
  });
});

describe("saves with three worlds", () => {
  it("restores the island next to the farm and the city", () => {
    const g = onIsland();
    g.state.money = 1234;
    g.completePad(g.pad("field_pine_2")!);
    g.completePad(g.pad("build_i_icepop")!);
    run(g, 2);
    const raw = JSON.parse(JSON.stringify(serializeGame(g)));
    expect(raw.v).toBe(4);
    const h = loadGame(raw);
    expect(h.state.world).toBe("island");
    expect(h.state.money).toBeCloseTo(1234, 0);
    expect(h.state.machines.map((m) => m.id).sort()).toEqual(["i_icepop", "i_juicer"]);
    expect(h.state.fields.map((f) => f.id).sort()).toEqual(["pine_1", "pine_2"]);
    expect(h.city?.city?.finished).toBe(true);
    expect(h.farm.statue).toBe(true);
    expect(h.state.prestige).toBe(h.farm.prestige);
    run(h, 3);
  });

  it("each world gets offline income for its own time apart", () => {
    const g = onIsland();
    g.state.autoIncome.rate = 50;
    const t0 = 5_000_000;
    g.travel("farm", t0);
    g.travel("city", t0 + 1000);
    const pay = g.travel("island", t0 + 1000 + 3_600_000);
    expect(pay).not.toBeNull();
    // The island was left when the family flew to the farm, an hour and a second ago.
    expect(pay!.seconds).toBe(3601);
  });

  it("an old two-world save still knows when the city was left", () => {
    const g = readyForIsland();
    g.travel("farm", 1_000_000);
    const raw = JSON.parse(JSON.stringify(serializeGame(g)));
    delete raw.left;
    raw.sleepingSince = 1_000_000;
    raw.v = 3;
    const h = loadGame(raw);
    expect(h.left.city).toBe(1_000_000);
  });
});

void ISLAND_LAYOUT;

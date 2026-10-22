import { describe, expect, it } from "vitest";
import { isSellable } from "@/game/data/items";
import { FARMHOUSE, FIELDS, MARKET, PADS, TRASH, WATER_RECTS, fieldById, machineById } from "@/game/data/layout";
import { createField } from "@/game/engine/world";
import { CROPS } from "@/game/data/crops";
import { MACHINE_TYPES } from "@/game/data/machines";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run, wait, walkTo } from "./helpers";

function freshGame() {
  const g = new Game();
  return g;
}

describe("layout data", () => {
  it("pad requirements reference existing pads", () => {
    const ids = new Set(PADS.map((p) => p.id));
    for (const p of PADS) for (const r of p.requires) expect(ids.has(r), `${p.id} requires ${r}`).toBe(true);
  });

  it("worker jobs are consistent with machine inputs", () => {
    for (const p of PADS) {
      if (p.effect.type !== "worker") continue;
      const job = p.effect.worker.job;
      if (job.kind === "harvester") {
        const target = MACHINE_TYPES[machineById(job.target).type];
        for (const f of job.fields) {
          const item = CROPS[fieldById(f).crop].item;
          expect(target.inputs.some((i) => i.item === item), `${p.id}: ${item} → ${job.target}`).toBe(true);
        }
      }
      if (job.kind === "carrier") {
        const out = MACHINE_TYPES[machineById(job.source).type].output.item;
        if (job.target.kind === "machine") {
          const t = MACHINE_TYPES[machineById(job.target.id).type];
          expect(t.inputs.some((i) => i.item === out), `${p.id}: ${out} → ${job.target.id}`).toBe(true);
        } else {
          expect(isSellable(out), `${p.id}: ${out} must be sellable`).toBe(true);
        }
      }
    }
  });

  it("pads of the same zone do not overlap each other or buildings", () => {
    type R = { id: string; x: number; z: number; hw: number; hd: number };
    const rects: R[] = [];
    for (const p of PADS) rects.push({ id: `pad ${p.id}`, x: p.x, z: p.z, hw: p.size / 2, hd: p.size / 2 });
    const g = freshGame();
    // Build every machine to get their footprints and zones.
    for (const m of PADS.filter((p) => p.effect.type === "machine")) {
      const pad = g.pad(m.id)!;
      g.completePad(pad);
    }
    for (const m of g.state.machines) {
      rects.push({ id: `body ${m.id}`, ...m.body });
      rects.push({ id: `in ${m.id}`, ...m.inRect });
      rects.push({ id: `out ${m.id}`, ...m.outRect });
    }
    rects.push({ id: "market", x: MARKET.x, z: MARKET.z, hw: MARKET.w / 2, hd: MARKET.d / 2 });
    rects.push({ id: "trash", x: TRASH.x, z: TRASH.z - 0.45, hw: TRASH.w / 2, hd: TRASH.d / 2 + 0.45 });
    rects.push({ id: "farmhouse", x: FARMHOUSE.x, z: FARMHOUSE.z, hw: FARMHOUSE.w / 2, hd: FARMHOUSE.d / 2 });
    for (const f of FIELDS) {
      const c = CROPS[f.crop];
      if (c.kind === "water") {
        // Fishing spots: one small box per spot (they sit in the water).
        for (const p of createField(f, false).plants) rects.push({ id: `field ${f.id}`, x: p.x, z: p.z, hw: 0.45, hd: 0.45 });
        continue;
      }
      rects.push({ id: `field ${f.id}`, x: f.x, z: f.z, hw: (f.cols * c.spacing) / 2, hd: (f.rows * (f.rowSpacing ?? c.spacing)) / 2 });
    }
    // The pier and the water must stay clear of buildings and their zones.
    for (const [i, w] of WATER_RECTS.entries()) rects.push({ id: `water ${i}`, ...w });
    const overlaps: string[] = [];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        // A build pad sits on its own (future) field; a pad for a hire may reuse the same spot.
        if (a.id.startsWith("pad field_") && b.id === `field ${a.id.slice(10)}`) continue;
        if (b.id.startsWith("pad field_") && a.id === `field ${b.id.slice(10)}`) continue;
        if (a.id.startsWith("pad hire_") && b.id.startsWith("pad hire_")) continue;
        if (a.id.startsWith("pad build_") && (b.id.startsWith("in ") || b.id.startsWith("out "))) continue;
        if (b.id.startsWith("pad build_") && (a.id.startsWith("in ") || a.id.startsWith("out "))) continue;
        // Fishing spots live in the water; their pads hang over the shore/pier edge.
        const wet = (r: { id: string }) => r.id.startsWith("field fish") || r.id.startsWith("pad field_fish");
        if ((a.id.startsWith("water") && wet(b)) || (b.id.startsWith("water") && wet(a))) continue;
        if (a.id.startsWith("water") && b.id.startsWith("water")) continue;
        if (Math.abs(a.x - b.x) < a.hw + b.hw - 0.05 && Math.abs(a.z - b.z) < a.hd + b.hd - 0.05) {
          overlaps.push(`${a.id} ↔ ${b.id}`);
        }
      }
    }
    expect(overlaps.join(" | ")).toBe("");
  });
});

describe("core loop", () => {
  it("harvests wheat by running through the field", () => {
    const g = freshGame();
    const f = fieldById("wheat_1");
    walkTo(g, f.x - 2, f.z - 2);
    walkTo(g, f.x + 2, f.z + 2);
    run(g, 0.5);
    expect(g.state.player.stack.length).toBeGreaterThan(3);
    expect(g.state.player.stack.every((i) => i === "wheat")).toBe(true);
  });

  it("mill turns wheat into flour and the market buys it", () => {
    const g = freshGame();
    const f = fieldById("wheat_1");
    walkTo(g, f.x - 2, f.z - 2);
    walkTo(g, f.x + 2, f.z + 2);
    walkTo(g, f.x - 2, f.z + 2);
    const carried = g.state.player.stack.length;
    expect(carried).toBe(g.state.player.capacity);

    const mill = g.machine("mill")!;
    walkTo(g, mill.inRect.x, mill.inRect.z);
    wait(g, 2.5);
    expect(g.state.player.stack.length).toBe(0);
    expect(g.state.tutorial).toBeGreaterThanOrEqual(2);

    walkTo(g, mill.outRect.x, mill.outRect.z);
    wait(g, 15);
    expect(g.state.player.stack.filter((i) => i === "flour").length).toBe(carried);

    walkTo(g, MARKET.sell.x, MARKET.sell.z);
    wait(g, 3);
    expect(g.state.player.stack.length).toBe(0);
    expect(Math.round(g.state.money)).toBe(carried * 2);
    expect(g.state.tutorial).toBe(4);
  });

  it("buying a pad drains money and builds the field", () => {
    const g = freshGame();
    g.state.tutorial = 4;
    g.rebuild();
    g.state.money = 100;
    const pad = g.pad("field_wheat_2")!;
    expect(pad.visible).toBe(true);
    walkTo(g, pad.def.x, pad.def.z);
    wait(g, 2);
    expect(pad.done).toBe(true);
    expect(g.state.money).toBeCloseTo(85);
    expect(g.state.fields.some((f) => f.id === "wheat_2")).toBe(true);
    expect(g.pad("build_bakery")!.visible).toBe(true);
  });
});

describe("automation", () => {
  it("a hired harvester feeds the mill", () => {
    const g = freshGame();
    g.state.tutorial = TUTORIAL_DONE;
    g.rebuild();
    for (const id of ["field_wheat_2", "build_bakery", "hire_h_wheat_1"]) g.completePad(g.pad(id)!);
    run(g, 40);
    const mill = g.machine("mill")!;
    expect(mill.produced).toBeGreaterThan(5);
  });

  it("carriers move goods machine → machine → market", () => {
    const g = freshGame();
    g.state.tutorial = TUTORIAL_DONE;
    g.rebuild();
    for (const id of ["field_wheat_2", "build_bakery", "hire_h_wheat_1", "hire_c_mill_bakery", "hire_c_bakery_market"]) {
      g.completePad(g.pad(id)!);
    }
    run(g, 120);
    expect(g.machine("bakery")!.produced).toBeGreaterThan(5);
    expect(g.state.money).toBeGreaterThan(20);
    expect(g.state.autoIncome.acc + g.state.autoIncome.rate).toBeGreaterThan(0);
  });

  it("trucks sell depot goods with a bonus", () => {
    const g = freshGame();
    g.state.tutorial = TUTORIAL_DONE;
    g.completePad(g.pad("zone_coop")!);
    g.completePad(g.pad("zone_pasture")!);
    g.completePad(g.pad("zone_depot")!);
    const d = g.state.depot!;
    for (let i = 0; i < 10; i++) d.storage.push("bread");
    const before = g.state.money;
    run(g, 20);
    expect(g.state.money - before).toBeCloseTo(10 * 6 * 1.5);
  });
});

describe("navigation", () => {
  it("finds a path around the mill", () => {
    const g = freshGame();
    const mill = g.machine("mill")!;
    const path = g.nav.findPath(mill.def.x, mill.def.z + 4, mill.def.x, mill.def.z - 4);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(1);
  });
});

describe("save", () => {
  it("round-trips progress", () => {
    const g = freshGame();
    g.state.tutorial = TUTORIAL_DONE;
    g.state.money = 1234.5;
    for (const id of ["field_wheat_2", "build_bakery", "hire_h_wheat_1", "zone_coop"]) g.completePad(g.pad(id)!);
    g.completePad(g.pad("up_mill")!);
    g.state.player.stack.push("wheat", "wheat");
    const data = JSON.parse(JSON.stringify(serialize(g.state)));
    const st = deserialize(data);
    const g2 = new Game(st);
    expect(g2.state.money).toBeCloseTo(1234.5);
    expect(g2.machine("mill")!.level).toBe(2);
    expect(g2.machine("bakery")).toBeDefined();
    expect(g2.state.workers.length).toBe(1);
    expect(g2.state.zones.has("coop")).toBe(true);
    expect(g2.state.fields.map((f) => f.id).sort()).toEqual(["corn_1", "wheat_1", "wheat_2"]);
    expect(g2.state.player.stack).toEqual(["wheat", "wheat"]);
    expect(g2.pad("build_feedmill")!.visible).toBe(true);
  });

  it("survives garbage", () => {
    expect(() => deserialize({ v: 1, money: "lots", pads: 5, zones: "x" })).not.toThrow();
    expect(deserialize(null).money).toBe(0);
  });
});

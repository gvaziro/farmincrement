import { describe, expect, it } from "vitest";
import { OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY, machineCapacity } from "@/game/data/balance";
import { Game } from "@/game/engine/Game";
import { offlineEarnings } from "@/game/engine/save";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run, wait, walkTo } from "./helpers";

function unlocked(...pads: string[]) {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.rebuild();
  for (const id of pads) {
    const p = g.pad(id);
    if (!p) throw new Error(`no pad ${id}`);
    g.completePad(p);
  }
  return g;
}

describe("machines", () => {
  it("confectionery needs all three inputs", () => {
    const g = unlocked("zone_coop", "zone_pasture", "zone_depot", "zone_orchard", "zone_garden", "zone_sweets", "build_mill_2", "hire_h_wheat_4", "build_confectionery");
    const m = g.machine("confectionery")!;
    run(g, 1);
    m.inputs.flour = 3;
    m.inputs.milk = 3;
    run(g, 6);
    expect(m.produced).toBe(0);
    expect(m.idle).toBe("input");
    m.inputs.egg = 3;
    run(g, 12);
    expect(m.produced).toBe(3);
    expect(m.inputs.flour).toBe(0);
  });

  it("stops when the output pallet is full", () => {
    const g = unlocked();
    const mill = g.machine("mill")!;
    const cap = machineCapacity(1);
    mill.inputs.wheat = cap;
    mill.output = cap - 1;
    run(g, 10);
    expect(mill.output).toBe(cap);
    expect(mill.idle).toBe("output");
    expect(mill.inputs.wheat).toBe(cap - 1);
  });

  it("upgrade pads level up and get pricier", () => {
    const g = unlocked("field_wheat_2");
    const pad = g.pad("up_mill")!;
    const c1 = g.padCost(pad)!;
    g.completePad(pad);
    expect(g.machine("mill")!.level).toBe(2);
    expect(pad.paid).toBe(0);
    expect(pad.done).toBe(false);
    expect(g.padCost(pad)!).toBeGreaterThan(c1);
  });
});

describe("pads", () => {
  it("running across a pad does not spend money", () => {
    const g = unlocked();
    g.state.money = 1000;
    const pad = g.pad("field_wheat_2")!;
    // Sprint straight through the pad without stopping.
    g.state.player.x = pad.def.x - 3;
    g.state.player.z = pad.def.z;
    walkTo(g, pad.def.x + 3, pad.def.z, 10, 0.4);
    expect(pad.paid).toBe(0);
    expect(g.state.money).toBe(1000);
  });

  it("standing on a pad buys it", () => {
    const g = unlocked();
    g.state.money = 1000;
    const pad = g.pad("field_wheat_2")!;
    walkTo(g, pad.def.x, pad.def.z);
    wait(g, 2);
    expect(pad.done).toBe(true);
  });
});

describe("meta", () => {
  it("offline earnings use the automated rate and are capped", () => {
    expect(offlineEarnings(10, 100).money).toBe(Math.floor(10 * 100 * OFFLINE_EFFICIENCY));
    const capped = offlineEarnings(10, OFFLINE_CAP_SECONDS * 5);
    expect(capped.seconds).toBe(OFFLINE_CAP_SECONDS);
    expect(offlineEarnings(5, -50).money).toBe(0);
  });

  it("a new generation keeps stars and stats, resets the farm", () => {
    const g = unlocked("field_wheat_2", "build_bakery");
    g.state.statue = true;
    g.state.runEarned = 900_000; // → 3 stars
    g.state.stats.earned = 1_234_567;
    expect(g.prestigeStars()).toBe(3);
    expect(g.prestige()).toBe(true);
    const st = g.state;
    expect(st.prestige.stars).toBe(3);
    expect(st.prestige.generations).toBe(1);
    expect(st.stats.earned).toBe(1_234_567);
    expect(st.machines.map((m) => m.id)).toEqual(["mill"]);
    expect(st.money).toBe(0);
    expect(g.priceMult()).toBeCloseTo(1.3);
    expect(g.pad("field_wheat_2")!.visible).toBe(true);
  });

  it("prestige is refused before the statue", () => {
    const g = unlocked();
    expect(g.prestige()).toBe(false);
  });
});

describe("orders", () => {
  it("appear after the tutorial and pay a bonus when the player fills them", () => {
    const g = unlocked();
    run(g, 7);
    const o = g.state.order!;
    expect(o).not.toBeNull();
    expect(o.lines.length).toBe(1);
    expect(o.lines[0].item).toBe("flour");
    const need = o.lines[0].need;
    // Hand the player exactly the ordered goods and let them sell.
    g.state.player.capacity = 200;
    for (let i = 0; i < need; i++) g.state.player.stack.push("flour");
    const before = g.state.money;
    walkTo(g, 7, 7);
    wait(g, 4);
    expect(g.state.order).toBeNull();
    expect(g.state.stats.orders).toBe(1);
    const sales = need * g.sellValue("flour");
    expect(g.state.money - before).toBeCloseTo(sales + o.reward);
    run(g, 10);
    expect(g.state.order).not.toBeNull();
  });

  it("worker sales do not count towards orders", () => {
    const g = unlocked("field_wheat_2", "build_bakery", "hire_h_wheat_1", "hire_c_mill_bakery", "hire_c_bakery_market");
    run(g, 120);
    const o = g.state.order;
    expect(o).not.toBeNull();
    expect(o!.lines.every((l) => l.have === 0)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { POND, fieldById } from "@/game/data/layout";
import { Game } from "@/game/engine/Game";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { isLand } from "@/game/engine/world";
import { run, wait, walkTo } from "./helpers";

/** Unlock every pad needed to reach `target`, in requirement order. */
function unlockUpTo(g: Game, target: string) {
  const need = new Set<string>();
  const visit = (id: string) => {
    if (need.has(id)) return;
    need.add(id);
    for (const r of g.pad(id)!.def.requires) visit(r);
  };
  visit(target);
  let progress = true;
  while (progress) {
    progress = false;
    for (const p of g.state.pads) {
      if (!need.has(p.id) || p.done || p.def.repeatable) continue;
      if (p.def.requires.every((r) => g.pad(r)?.done) && g.state.zones.has(p.def.zone)) {
        g.completePad(p);
        progress = true;
      }
    }
  }
  return g;
}

function fresh() {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.rebuild();
  return g;
}

describe("pond", () => {
  it("water blocks walking, the pier does not", () => {
    const g = unlockUpTo(fresh(), "zone_pond");
    const st = g.state;
    const w = POND.water;
    const p = POND.pier;
    // Middle of the north water: not walkable (an obstacle).
    const wx = (w.x0 + w.x1) / 2;
    const wz = (w.z0 + p.z0) / 2;
    expect(g.nav.isFree(wx, wz)).toBe(false);
    // On the pier: walkable.
    expect(g.nav.isFree((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2)).toBe(true);
    expect(isLand(st, -24, 22, 0.35)).toBe(true);

    // Try to run straight into the water from the shore: the player stops at the edge.
    st.player.x = -24;
    st.player.z = 16;
    g.input.x = -1;
    g.input.z = 0;
    run(g, 3);
    expect(st.player.x).toBeGreaterThan(w.x1 - 0.01);
  });

  it("the player fishes from the shore and from the pier", () => {
    const g = unlockUpTo(fresh(), "field_fish_2");
    const st = g.state;
    run(g, 1);
    const f1 = fieldById("fish_1");
    walkTo(g, -26.2, f1.z - 3);
    walkTo(g, -26.2, f1.z + 3);
    const shore = st.player.stack.filter((i) => i === "fish").length;
    expect(shore).toBeGreaterThan(2);
    // Walk out onto the pier.
    st.player.stack.length = 0;
    st.player.incoming = 0;
    walkTo(g, POND.pier.x1 - 0.5, 22);
    walkTo(g, POND.pier.x0 + 0.6, 22);
    expect(st.player.stack.filter((i) => i === "fish").length).toBeGreaterThan(2);
  });

  it("a fisher keeps the smokehouse busy and the chain reaches the depot", () => {
    const g = unlockUpTo(fresh(), "hire_c_cannery_depot");
    run(g, 150);
    expect(g.machine("smokehouse")!.produced).toBeGreaterThan(8);
    expect(g.machine("cannery")!.produced).toBeGreaterThan(3);
    // Nobody ends up standing in the water.
    for (const w of g.state.workers) expect(g.nav.isFree(w.x, w.z) || isLand(g.state, w.x, w.z, 0.1)).toBe(true);
  });
});

describe("apiary", () => {
  it("flowers become honeycomb and honey", () => {
    const g = unlockUpTo(fresh(), "hire_c_honey_market");
    run(g, 150);
    expect(g.machine("hives")!.produced).toBeGreaterThan(8);
    expect(g.machine("honeyhouse")!.produced).toBeGreaterThan(3);
    expect(g.state.money).toBeGreaterThan(10_000);
  });

  it("the player can pick flowers", () => {
    const g = unlockUpTo(fresh(), "zone_apiary");
    run(g, 1);
    const f = fieldById("flowers_1");
    walkTo(g, f.x - 2.5, f.z - 1.5);
    walkTo(g, f.x + 2.5, f.z - 1.5);
    wait(g, 0.5);
    expect(g.state.player.stack.filter((i) => i === "flower").length).toBeGreaterThan(2);
  });

  it("the statue now waits for the apiary", () => {
    const g = unlockUpTo(fresh(), "hire_c_conf_depot");
    expect(g.pad("statue")!.visible).toBe(false);
    unlockUpTo(g, "hire_c_honey_market");
    expect(g.pad("statue")!.visible).toBe(true);
  });
});

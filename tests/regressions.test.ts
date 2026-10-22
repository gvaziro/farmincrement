/** Regression tests for bugs found in code review. */
import { describe, expect, it } from "vitest";
import { machineCapacity } from "@/game/data/balance";
import { TRASH } from "@/game/data/layout";
import { Game } from "@/game/engine/Game";
import { deserialize, isFutureSave, serialize, SAVE_VERSION } from "@/game/engine/save";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run, wait, walkTo } from "./helpers";

function unlocked(...pads: string[]) {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.rebuild();
  for (const id of pads) g.completePad(g.pad(id)!);
  return g;
}

const roundTrip = (g: Game) => new Game(deserialize(JSON.parse(JSON.stringify(serialize(g.state)))));

describe("save/load", () => {
  it("keeps goods already loaded into a truck that has not left", () => {
    const g = unlocked("zone_coop", "zone_pasture", "zone_depot");
    const d = g.state.depot!;
    const t = d.trucks[0];
    t.phase = "load";
    t.cargo.push(...Array(10).fill("cheese"));
    d.storage.push("bread");
    const g2 = roundTrip(g);
    expect(g2.state.depot!.storage.filter((i) => i === "cheese").length).toBe(10);
    expect(g2.state.depot!.storage).toContain("bread");
  });

  it("never rounds a pad payment up past its price", () => {
    const g = unlocked();
    const pad = g.pad("field_wheat_2")!;
    pad.paid = 14.996;
    const data = JSON.parse(JSON.stringify(serialize(g.state)));
    expect(data.pads.field_wheat_2.paid).toBeLessThan(15);
  });

  it("an overpaid pad completes instead of blocking progress", () => {
    const g = unlocked();
    const pad = g.pad("field_wheat_2")!;
    pad.paid = 15;
    walkTo(g, pad.def.x, pad.def.z);
    wait(g, 1);
    expect(pad.done).toBe(true);
    expect(g.pad("build_bakery")!.visible).toBe(true);
  });

  it("keeps a machine cycle that was in progress", () => {
    const g = unlocked();
    const mill = g.machine("mill")!;
    mill.inputs.wheat = 1;
    run(g, 0.5);
    expect(mill.working).toBe(true);
    const g2 = roundTrip(g);
    run(g2, 2);
    expect(g2.machine("mill")!.output).toBe(1);
  });

  it("floors a fractional tutorial step", () => {
    const st = deserialize({ v: SAVE_VERSION, tutorial: 2.5 });
    expect(st.tutorial).toBe(2);
  });

  it("recognises saves from a newer version", () => {
    expect(isFutureSave({ v: SAVE_VERSION + 1 })).toBe(true);
    expect(isFutureSave({ v: SAVE_VERSION })).toBe(false);
    expect(isFutureSave(null)).toBe(false);
  });
});

describe("soft-locks", () => {
  it("player can overfill a full machine so a full stack of raw goods is never stuck", () => {
    const g = unlocked();
    const mill = g.machine("mill")!;
    const cap = machineCapacity(1);
    mill.inputs.wheat = cap;
    mill.output = cap;
    g.state.money = 0;
    const p = g.state.player;
    for (let i = 0; i < p.capacity; i++) p.stack.push("wheat");
    walkTo(g, mill.inRect.x, mill.inRect.z);
    wait(g, 3);
    expect(p.stack.length).toBe(0);
    expect(mill.inputs.wheat).toBeGreaterThan(cap);
    walkTo(g, mill.outRect.x, mill.outRect.z);
    wait(g, 3);
    expect(p.stack.filter((i) => i === "flour").length).toBe(p.capacity);
  });

  it("workers still respect the normal capacity", () => {
    const g = unlocked("field_wheat_2", "build_bakery", "hire_h_wheat_1");
    const mill = g.machine("mill")!;
    mill.output = machineCapacity(1);
    run(g, 60);
    expect(mill.inputs.wheat ?? 0).toBeLessThanOrEqual(machineCapacity(1));
  });

  it("the compost bin takes anything", () => {
    const g = unlocked();
    const p = g.state.player;
    p.stack.push("wheat", "corn", "flour");
    walkTo(g, TRASH.x, TRASH.z);
    wait(g, 2);
    expect(p.stack.length).toBe(0);
  });
});

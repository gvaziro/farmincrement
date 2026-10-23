import { describe, expect, it } from "vitest";
import { MAP_BOUNDS, PADS, ZONES } from "@/game/data/layout";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run } from "./helpers";

const ZONE_ORDER = ["coop", "pasture", "depot", "orchard", "garden", "sweets", "pond", "apiary", "sheep", "berries", "pumpkins"];

/** A game with every plot up to `last` bought (pads completed directly). */
function withZones(last: string) {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.rebuild();
  for (const z of ZONE_ORDER) {
    g.completePad(g.pad(`zone_${z}`)!);
    if (z === last) break;
  }
  return g;
}

describe("the northern row", () => {
  it("makes the map three plots wide and four deep", () => {
    const gx = new Set(ZONES.map((z) => z.gx));
    const gz = new Set(ZONES.map((z) => z.gz));
    expect(gx.size).toBe(3);
    expect(gz.size).toBe(4);
    expect(MAP_BOUNDS.minZ).toBeLessThan(-50);
  });

  it("the sheep plot is sold from the apiary, after the honey chain", () => {
    const pad = PADS.find((p) => p.id === "zone_sheep")!;
    expect(pad.zone).toBe("apiary");
    expect(pad.requires).toContain("hire_c_honey_market");
  });

  it("workers turn meadow grass into sweaters and sell them", () => {
    const g = withZones("sheep");
    const ids = ["build_sheepfold", "build_spinnery", "hire_h_grass_3", "build_knitting", "hire_c_fold_spin", "hire_c_spin_knit", "hire_c_knit_market"];
    for (const id of ids) {
      const pad = g.pad(id)!;
      expect(pad.visible, id).toBe(true);
      g.completePad(pad);
    }
    const money = g.state.money;
    run(g, 240);
    expect(g.machine("sheepfold")!.produced).toBeGreaterThan(5);
    expect(g.machine("spinnery")!.produced).toBeGreaterThan(3);
    expect(g.machine("knitting")!.produced).toBeGreaterThan(1);
    // The carrier walks sweaters all the way to the market.
    expect(g.state.money - money).toBeGreaterThan(30000);
  }, 60_000);

  it("strawberries become jam — and, with milk from the barn, ice cream", () => {
    const g = withZones("berries");
    g.completePad(g.pad("build_barn")!);
    const ids = ["build_jamhouse", "hire_h_berry_1", "hire_c_jam_market", "field_berries_2", "build_icecream", "hire_h_berry_2", "hire_c_barn_ice", "hire_c_ice_market"];
    for (const id of ids) {
      const pad = g.pad(id)!;
      expect(pad.visible, id).toBe(true);
      g.completePad(pad);
    }
    // The barn far away in the pasture has milk ready.
    g.machine("barn")!.output = 40;
    const money = g.state.money;
    run(g, 240);
    expect(g.machine("jamhouse")!.produced).toBeGreaterThan(5);
    expect(g.machine("icecream")!.produced).toBeGreaterThan(2);
    expect(g.state.money - money).toBeGreaterThan(100_000);
  }, 60_000);

  it("pumpkins and flour from the second mill become pies; pumpkins also become lanterns", () => {
    const g = withZones("pumpkins");
    for (const id of ["build_mill_2"]) g.completePad(g.pad(id)!);
    const ids = ["build_piebakery", "hire_h_pumpkin_1", "hire_c_mill2_pie", "hire_c_pie_depot", "field_pumpkins_2", "build_lanternshop", "hire_h_pumpkin_2", "hire_c_lantern_market"];
    for (const id of ids) {
      const pad = g.pad(id)!;
      expect(pad.visible, id).toBe(true);
      g.completePad(pad);
    }
    // Flour is waiting at the second mill (south, in the sweets plot).
    g.machine("mill_2")!.output = 40;
    run(g, 240);
    expect(g.machine("piebakery")!.produced).toBeGreaterThan(3);
    expect(g.machine("lanternshop")!.produced).toBeGreaterThan(3);
    expect(g.pad("statue")!.visible).toBe(true);
  }, 60_000);

  it("the new plot and its buildings survive a save", () => {
    const g = withZones("sheep");
    g.completePad(g.pad("build_sheepfold")!);
    const g2 = new Game(deserialize(JSON.parse(JSON.stringify(serialize(g.state)))));
    expect(g2.state.zones.has("sheep")).toBe(true);
    expect(g2.machine("sheepfold")).toBeDefined();
    expect(g2.state.fields.some((f) => f.id === "grass_3")).toBe(true);
  });
});

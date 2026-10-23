import { describe, expect, it } from "vitest";
import { PLAYER_STATS, starsForEarnings, statValue } from "@/game/data/balance";
import { PERKS, PERK_IDS, TREASURY_MONEY } from "@/game/data/legacy";
import { Game } from "@/game/engine/Game";
import { deserialize, offlineEarnings, serialize } from "@/game/engine/save";
import { makeOrder } from "@/game/engine/systems/orders";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run } from "./helpers";

function withStars(stars: number) {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.state.prestige.stars = stars;
  g.rebuild();
  return g;
}

/** Hand the farm over (the statue is "built" for the test). */
function nextGeneration(g: Game, earned = 0) {
  g.state.statue = true;
  g.state.runEarned = earned;
  expect(g.prestige()).toBe(true);
  return g;
}

describe("stars", () => {
  it("a full first run gives a few dozen; playing on gives more", () => {
    expect(starsForEarnings(1.5e9)).toBe(38);
    expect(starsForEarnings(3e9)).toBeGreaterThan(50);
    expect(starsForEarnings(5e5)).toBe(0);
  });

  it("are added up over generations: to spend and in total", () => {
    const g = nextGeneration(withStars(5), 1.5e9);
    expect(g.state.prestige.stars).toBe(43);
    expect(g.state.prestige.totalStars).toBe(38);
    expect(g.state.prestige.generations).toBe(1);
  });
});

describe("legacy shop", () => {
  it("every perk has a price for every level, growing", () => {
    for (const id of PERK_IDS) {
      const p = PERKS[id];
      for (let n = 1; n <= p.max; n++) {
        expect(p.cost(n), `${id} ${n}`).toBeGreaterThan(0);
        if (n > 1) expect(p.cost(n)).toBeGreaterThanOrEqual(p.cost(n - 1));
        expect(p.effect(n).length).toBeGreaterThan(3);
      }
    }
  });

  it("buying spends stars, levels up and stops at the maximum", () => {
    const g = withStars(1000);
    expect(g.buyPerk("fame")).toBe(true);
    expect(g.perk("fame")).toBe(1);
    expect(g.state.prestige.stars).toBe(1000 - PERKS.fame.cost(1));
    while (g.buyPerk("fame"));
    expect(g.perk("fame")).toBe(PERKS.fame.max);
    expect(g.perkCost("fame")).toBeNull();
    const poor = withStars(0);
    expect(poor.buyPerk("soil")).toBe(false);
    expect(poor.perk("soil")).toBe(0);
  });

  it("good fame raises prices; stars alone do not", () => {
    const g = withStars(50);
    expect(g.priceMult()).toBeCloseTo(1);
    g.buyPerk("fame");
    g.buyPerk("fame");
    expect(g.priceMult()).toBeCloseTo(1.3);
  });

  it("a new generation inherits money, a stronger farmer and crew, and the family lands", () => {
    const g = withStars(500);
    for (const id of ["treasury", "treasury", "hands", "hands", "crew", "lands", "lands", "lands"] as const) expect(g.buyPerk(id)).toBe(true);
    nextGeneration(g);
    const st = g.state;
    expect(st.money).toBe(TREASURY_MONEY[2]);
    expect(st.playerLevels.capacity).toBe(3);
    expect(st.player.capacity).toBe(statValue(PLAYER_STATS.capacity, 3));
    expect(st.workerLevels.speed).toBe(2);
    expect([...st.zones].sort()).toEqual(["coop", "depot", "farm", "pasture"]);
    expect(st.depot).not.toBeNull();
    expect(st.fields.map((f) => f.id)).toEqual(expect.arrayContaining(["corn_1", "grass_1"]));
    // The plots' own buildings are on offer right away.
    expect(g.pad("build_feedmill")!.visible).toBe(true);
    expect(g.pad("build_barn")!.visible).toBe(true);
    expect(g.pad("zone_coop")!.done).toBe(true);
  });

  it("fertile soil speeds up plants, not fish", () => {
    const regrow = (soil: number) => {
      const g = withStars(0);
      g.state.legacy.soil = soil;
      const f = g.state.fields[0];
      for (const p of f.plants) p.growth = 0;
      run(g, 2);
      return f.plants.reduce((s, p) => s + p.growth, 0);
    };
    expect(regrow(3) / regrow(0)).toBeCloseTo(1.3, 1);
  });

  it("father's tools make machine upgrades cheaper", () => {
    const g = withStars(0);
    const pad = g.pad("up_mill")!;
    const full = g.padCost(pad)!;
    g.state.legacy.workshop = 2;
    expect(g.padCost(pad)).toBe(Math.round(full * 0.8));
  });

  it("a long holiday pays more offline income for longer", () => {
    const base = offlineEarnings(10, 10 * 3600, 0);
    const rested = offlineEarnings(10, 10 * 3600, 2);
    expect(base.seconds).toBe(2 * 3600);
    expect(rested.seconds).toBe(6 * 3600);
    expect(rested.money).toBe(Math.floor(10 * 6 * 3600 * 0.7));
  });

  it("fair savvy raises order rewards", () => {
    const g = withStars(0);
    const plain = makeOrder(g)!;
    g.state.legacy.fair = 2;
    const savvy = makeOrder(g)!;
    const value = (o: typeof plain) => o.lines.reduce((s, l) => s + l.need * g.sellValue(l.item), 0);
    expect(savvy.reward / value(savvy)).toBeCloseTo(1.5 * (plain.reward / value(plain)), 1);
  });

  it("levels and stars survive a save; old saves keep their stars as shop money", () => {
    const g = withStars(40);
    g.buyPerk("fame");
    g.buyPerk("holiday");
    const st = deserialize(JSON.parse(JSON.stringify(serialize(g.state))));
    expect(st.legacy).toEqual({ fame: 1, holiday: 1 });
    expect(st.prestige.stars).toBe(40 - PERKS.fame.cost(1) - PERKS.holiday.cost(1));
    const old = deserialize({ v: 2, prestige: { stars: 7, generations: 2 } });
    expect(old.prestige).toEqual({ stars: 7, totalStars: 7, generations: 2 });
    expect(old.legacy).toEqual({});
    // Nonsense levels are clamped.
    expect(deserialize({ v: 2, legacy: { fame: 999, nope: 3 } }).legacy).toEqual({ fame: PERKS.fame.max });
  });
});

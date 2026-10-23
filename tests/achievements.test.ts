import { describe, expect, it } from "vitest";
import { HAT_IDS } from "@/game/data/hats";
import { ACHIEVEMENTS } from "@/game/engine/achievements";
import { DAY_LENGTH, DAY_START } from "@/game/engine/daycycle";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run, wait, walkTo } from "./helpers";

const unlockedIds = (g: Game) => [...g.state.achievements];

describe("achievements", () => {
  it("have unique ids, and every hat but the straw one is a reward", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    for (const hat of HAT_IDS) {
      const by = ACHIEVEMENTS.filter((a) => a.hat === hat);
      expect(by.length, hat).toBe(hat === "straw" ? 0 : 1);
    }
  });

  it("a new farm has none; the first sale unlocks one, once", () => {
    const g = new Game();
    run(g, 1);
    expect(unlockedIds(g)).toEqual([]);
    g.state.player.stack.push("flour");
    walkTo(g, 7, 7);
    wait(g, 2);
    const events: string[] = [];
    for (let i = 0; i < 3; i++) {
      run(g, 0.6);
      for (const e of g.drainEvents()) if (e.type === "achievement") events.push(e.id);
    }
    expect(g.state.achievements.has("first_sale")).toBe(true);
    expect(events.filter((id) => id === "first_sale").length).toBeLessThanOrEqual(1);
  });

  it("hats can only be worn once earned, and are kept in saves", () => {
    const g = new Game();
    expect(g.hats()).toEqual(["straw"]);
    expect(g.wearHat("cowboy")).toBe(false);
    g.state.stats.earned = 2_000_000;
    run(g, 1);
    expect(g.state.achievements.has("earned_1m")).toBe(true);
    expect(g.hats()).toContain("cowboy");
    expect(g.wearHat("cowboy")).toBe(true);
    const st = deserialize(JSON.parse(JSON.stringify(serialize(g.state))));
    expect(st.hat).toBe("cowboy");
    expect(st.achievements.has("earned_1m")).toBe(true);
    // A hat that was never earned cannot be smuggled in through a save.
    const forged = deserialize({ ...JSON.parse(JSON.stringify(serialize(new Game().state))), hat: "crown" });
    expect(forged.hat).toBe("straw");
  });

  it("trophies and the hat stay with the family across generations", () => {
    const g = new Game();
    g.state.stats.earned = 2_000_000;
    run(g, 1);
    g.wearHat("cowboy");
    g.state.statue = true;
    g.state.runEarned = 500_000;
    g.prestige();
    expect(g.state.achievements.has("earned_1m")).toBe(true);
    expect(g.state.hat).toBe("cowboy");
  });
});

describe("new counters", () => {
  /** Clock on day N at time of day t. */
  const clockOn = (day: number, t: number) => (day - 1 + t - DAY_START) * DAY_LENGTH;

  it("counts lived-through seasons", () => {
    const g = new Game();
    for (let i = 0; i < 2 * 600 * 10 * 1.1; i++) g.tick(0.1);
    expect(g.state.stats.seasons).toBe(1);
  });

  it("counts fish caught at night", () => {
    const g = new Game();
    g.state.tutorial = TUTORIAL_DONE;
    g.rebuild();
    for (const z of ["coop", "pasture", "depot", "orchard", "garden", "sweets", "pond"]) g.completePad(g.pad(`zone_${z}`)!);
    g.state.dayClock = clockOn(1, 0.93);
    const f = g.state.fields.find((x) => x.id === "fish_1")!;
    for (const p of f.plants) p.fruits = 2;
    f.spawnT = 9;
    walkTo(g, -26.2, 16.6);
    wait(g, 1);
    expect(g.state.stats.nightFish).toBeGreaterThan(0);
  });
});

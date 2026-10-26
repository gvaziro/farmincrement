/** Phase 21: challenges, family records, the chronicle and the new legacy upgrades. */
import { describe, expect, it } from "vitest";
import { starsForEarnings } from "@/game/data/balance";
import { CHALLENGES, CHALLENGE_IDS, DIY_HIRE_MULT, PRICEY_LAND_MULT, STINGY_MARKET, WINTER_GROWTH, WINTER_MACHINES, challengeStars, type ChallengeId } from "@/game/data/challenges";
import { GOLDEN_PER_LEVEL, VOICE_REST_PER_LEVEL, VOICE_TIME_PER_LEVEL } from "@/game/data/legacy";
import { DAY_LENGTH } from "@/game/engine/daycycle";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { SEASONS, WINTER_MACHINE_SPEED } from "@/game/engine/seasons";
import { makeOrder } from "@/game/engine/systems/orders";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import type { GameEvent } from "@/game/engine/types";
import { weatherOfDay } from "@/game/engine/weather";
import { MERCHANT_MULT, WHISTLE_COOLDOWN, WHISTLE_TIME } from "@/game/data/surprises";
import { DT, run, wait } from "./helpers";

function farm() {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.rebuild();
  const s = g.state.surprises;
  s.goldenIn = s.merchantIn = s.runawayIn = 1e9;
  return g;
}

/** Build the statue (directly) and hand the farm over. */
function handOver(g: Game, challenges: ChallengeId[] = [], earned = 1.5e9) {
  g.state.statue = true;
  g.state.runEarned = earned;
  expect(g.prestige(challenges)).toBe(true);
  const s = g.state.surprises;
  s.goldenIn = s.merchantIn = s.runawayIn = 1e9;
  return g;
}

const roundTrip = (g: Game) => new Game(deserialize(JSON.parse(JSON.stringify(serialize(g.state)))));
const eventsOf = <T extends GameEvent["type"]>(g: Game, type: T) =>
  g.drainEvents().filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("challenges", () => {
  it("are described, and each one pays extra stars", () => {
    for (const id of CHALLENGE_IDS) {
      const c = CHALLENGES[id];
      expect(c.stars, id).toBeGreaterThan(1);
      expect(c.name.length).toBeGreaterThan(3);
      expect(c.desc.length).toBeGreaterThan(10);
    }
    expect(challengeStars([])).toBe(1);
    expect(challengeStars(["diy", "fresh"])).toBeCloseTo(CHALLENGES.diy.stars * CHALLENGES.fresh.stars);
  });

  it("are chosen when handing over; unknown or repeated ones are dropped", () => {
    const g = handOver(farm(), ["diy", "diy", "nope" as ChallengeId, "winter"]);
    expect(g.state.challenges).toEqual(["diy", "winter"]);
    // The next hand-over goes back to normal unless chosen again.
    handOver(g);
    expect(g.state.challenges).toEqual([]);
  });

  it("multiply the stars of the generation that took them on", () => {
    const g = handOver(farm(), ["stingy", "pricey"]);
    g.state.runEarned = 1.5e9;
    const mult = CHALLENGES.stingy.stars * CHALLENGES.pricey.stars;
    expect(g.prestigeStars()).toBe(starsForEarnings(1.5e9, mult));
    expect(g.prestigeStars()).toBeGreaterThan(starsForEarnings(1.5e9));
  });

  it("«Своими руками»: hiring costs more, nothing else does", () => {
    const g = handOver(farm(), ["diy"]);
    const plain = farm();
    expect(g.padCost(g.pad("hire_h_wheat_1")!)).toBe(plain.padCost(plain.pad("hire_h_wheat_1")!)! * DIY_HIRE_MULT);
    expect(g.padCost(g.pad("field_wheat_2")!)).toBe(plain.padCost(plain.pad("field_wheat_2")!));
    expect(g.padCost(g.pad("zone_coop")!)).toBe(plain.padCost(plain.pad("zone_coop")!));
  });

  it("«Дорогая земля»: plots cost more, fields do not", () => {
    const g = handOver(farm(), ["pricey"]);
    const plain = farm();
    expect(g.padCost(g.pad("zone_coop")!)).toBe(plain.padCost(plain.pad("zone_coop")!)! * PRICEY_LAND_MULT);
    expect(g.padCost(g.pad("field_wheat_2")!)).toBe(plain.padCost(plain.pad("field_wheat_2")!));
  });

  it("«Скупой рынок»: the market pays less; orders and the merchant do not", () => {
    const g = handOver(farm(), ["stingy"]);
    g.completePad(g.pad("build_bakery")!);
    const plain = farm();
    plain.completePad(plain.pad("build_bakery")!);
    expect(g.salePrice("bread")).toBeCloseTo(g.sellValue("bread") * STINGY_MARKET);
    expect(makeOrder(g)!.reward).toBe(makeOrder(plain)!.reward);
    // The merchant: hand over two loaves.
    g.completePad(g.pad("zone_coop")!);
    g.state.surprises.merchantIn = 0.01;
    g.state.player.x = 7;
    g.state.player.z = 9.5;
    wait(g, 2);
    const m = g.state.surprises.merchant!;
    const zone = g.interactById("merchant")!;
    g.state.player.stack = [m.item, m.item];
    g.state.player.x = zone.rect.x;
    g.state.player.z = zone.rect.z;
    wait(g, 2);
    expect(m.earned).toBeCloseTo(2 * g.sellValue(m.item) * MERCHANT_MULT);
  });

  it("«Вечная зима»: winter all year — snow, no rain, slow plants, fairs of winter goods", () => {
    const g = handOver(farm(), ["winter"]);
    g.drainEvents();
    expect(g.state.season).toBe("winter");
    for (let day = 0; day < 8; day++) {
      g.state.dayClock = day * DAY_LENGTH + 100;
      g.tick(DT);
      expect(g.state.season, `day ${day}`).toBe("winter");
    }
    expect(eventsOf(g, "season")).toEqual([]);
    for (let day = 2; day < 300; day++) expect(weatherOfDay(day, "winter").kind).not.toBe("rain");
    // The game itself never sees rain either (checked through the tick, through spring days).
    for (let t = 0; t < 8 * DAY_LENGTH; t += 20) {
      g.state.dayClock = t;
      g.tick(DT);
      expect(g.state.weather).not.toBe("rain");
    }
    // Plants grow at WINTER_GROWTH speed.
    const grown = (challenges: ChallengeId[]) => {
      const x = handOver(farm(), challenges);
      x.state.dayClock = 3 * DAY_LENGTH;
      const p = x.state.fields[0].plants[0];
      p.growth = 0;
      run(x, 1);
      return p.growth;
    };
    expect(grown(["winter"]) / grown([])).toBeCloseTo(WINTER_GROWTH / 1, 1);
    // The fair still comes on the last day of every two, with winter's goods.
    const f = handOver(farm(), ["winter"]);
    f.completePad(f.pad("build_bakery")!);
    f.state.dayClock = DAY_LENGTH * 1.2;
    f.state.orderCooldown = 1e9;
    f.tick(DT);
    expect(f.state.order?.fair).toBe(true);
    expect(f.state.order!.lines.every((l) => SEASONS.winter.demand.includes(l.item))).toBe(true);
  });

  it("«Вечная зима»: the machines freeze instead of getting winter's bonus", () => {
    const progress = (challenges: ChallengeId[]) => {
      const g = handOver(farm(), challenges);
      // A real winter day for the plain game, so both are "winter".
      g.state.dayClock = 6.5 * DAY_LENGTH;
      g.tick(DT);
      const mill = g.machine("mill")!;
      mill.spawnT = 9;
      mill.inputs.wheat = 1;
      g.tick(DT);
      const p0 = mill.progress;
      g.tick(DT);
      return mill.progress - p0;
    };
    expect(progress(["winter"]) / progress([])).toBeCloseTo(WINTER_MACHINES / WINTER_MACHINE_SPEED, 2);
  });

  it("«С чистого листа»: the shop's upgrades sleep for a generation, and are not lost", () => {
    const g = farm();
    g.state.prestige.stars = 1000;
    for (let i = 0; i < 3; i++) g.buyPerk("fame");
    g.buyPerk("treasury");
    g.buyPerk("lands");
    handOver(g, ["fresh"]);
    expect(g.perk("fame")).toBe(0);
    expect(g.ownedPerk("fame")).toBe(3);
    expect(g.state.money).toBe(0);
    expect(g.state.zones.has("coop")).toBe(false);
    expect(g.priceMult()).toBe(farm().priceMult());
    // Buying during a clean-slate generation raises the real level.
    expect(g.buyPerk("fame")).toBe(true);
    expect(g.ownedPerk("fame")).toBe(4);
    handOver(g);
    expect(g.perk("fame")).toBe(4);
    expect(g.state.zones.has("coop")).toBe(true);
  });

  it("survive a reload — and a frozen winter stays frozen", () => {
    const g = handOver(farm(), ["winter", "diy"]);
    g.state.dayClock = 0.5 * DAY_LENGTH;
    const loaded = roundTrip(g);
    expect(loaded.state.challenges).toEqual(["winter", "diy"]);
    expect(loaded.state.season).toBe("winter");
    const data = serialize(g.state);
    data.challenges = ["winter", "bogus", "winter"];
    expect(deserialize(data).challenges).toEqual(["winter"]);
  });
});

describe("family records", () => {
  it("the first generation sets them quietly; later ones try to beat them", () => {
    const g = farm();
    g.state.dayClock = 600;
    g.completePad(g.pad("zone_coop")!);
    expect(g.state.records.coop).toBe(600);
    expect(eventsOf(g, "record")).toEqual([]);
    handOver(g);
    // Slower: the record stands.
    g.state.dayClock = 900;
    g.completePad(g.pad("zone_coop")!);
    expect(g.state.records.coop).toBe(600);
    expect(eventsOf(g, "record")).toEqual([]);
    handOver(g);
    // Faster: a new record, an event and the achievement.
    g.state.dayClock = 420;
    g.completePad(g.pad("zone_coop")!);
    expect(g.state.records.coop).toBe(420);
    expect(eventsOf(g, "record")).toEqual([{ type: "record", key: "coop", time: 420, prev: 600 }]);
    run(g, 1);
    expect(g.state.achievements.has("record_1")).toBe(true);
  });

  it("plots a generation inherits do not count", () => {
    const g = farm();
    g.state.prestige.stars = 100;
    g.buyPerk("lands");
    handOver(g);
    expect(g.state.zones.has("coop")).toBe(true);
    expect(g.state.genTimes.coop).toBeUndefined();
    expect(g.state.records.coop).toBeUndefined();
  });

  it("the statue time is a record too, and everything is saved", () => {
    const g = farm();
    g.state.dayClock = 1234;
    g.state.statue = false;
    g.completePad(g.pad("statue")!);
    expect(g.state.genTimes.statue).toBe(1234);
    expect(g.state.records.statue).toBe(1234);
    const loaded = roundTrip(g);
    expect(loaded.state.genTimes.statue).toBe(1234);
    expect(loaded.state.records.statue).toBe(1234);
    const data = serialize(g.state);
    data.records = { statue: 99, nowhere: 5, coop: -3, pond: Number.NaN };
    expect(deserialize(data).records).toEqual({ statue: 99 });
  });
});

describe("the chronicle", () => {
  it("writes down every generation: time to the statue, stars and challenges", () => {
    const g = farm();
    g.state.genTimes.statue = 12000;
    g.state.dayClock = 12500;
    handOver(g, ["winter"]);
    g.state.genTimes.statue = 8000;
    g.state.dayClock = 8100;
    g.state.statue = true;
    g.state.runEarned = 1.5e9;
    const stars = g.prestigeStars();
    g.prestige();
    expect(g.state.chronicle).toEqual([
      { gen: 1, statue: 12000, played: 12500, stars: 38, challenges: [] },
      { gen: 2, statue: 8000, played: 8100, stars, challenges: ["winter"] },
    ]);
    run(g, 1);
    expect(g.state.achievements.has("challenge_1")).toBe(true);
    expect(g.state.achievements.has("winter_gen")).toBe(true);
    expect(g.hats()).toContain("ushanka");
    expect(roundTrip(g).state.chronicle).toEqual(g.state.chronicle);
  });

  it("three challenges at once make a tough school", () => {
    const g = handOver(farm(), ["diy", "stingy", "pricey"]);
    handOver(g);
    run(g, 1);
    expect(g.state.achievements.has("challenge_3")).toBe(true);
  });
});

describe("new legacy upgrades", () => {
  it("«Опыт предков»: new machines come upgraded, the first mill too", () => {
    const g = farm();
    g.state.prestige.stars = 100;
    g.buyPerk("ancestors");
    g.completePad(g.pad("build_bakery")!);
    expect(g.machine("bakery")!.level).toBe(2);
    handOver(g);
    expect(g.machine("mill")!.level).toBe(2);
  });

  it("«Зычный голос»: the whistle sounds longer and rests less", () => {
    const g = farm();
    g.completePad(g.pad("hire_h_wheat_1")!);
    g.state.prestige.stars = 100;
    g.buyPerk("voice");
    g.buyPerk("voice");
    expect(g.whistle()).toBe(true);
    expect(g.state.surprises.whistle).toBe(WHISTLE_TIME + 2 * VOICE_TIME_PER_LEVEL);
    expect(g.state.surprises.whistleCd).toBe(WHISTLE_COOLDOWN - 2 * VOICE_REST_PER_LEVEL);
    // …and a reload does not cut the longer whistle short.
    expect(roundTrip(g).state.surprises.whistle).toBeCloseTo(WHISTLE_TIME + 2 * VOICE_TIME_PER_LEVEL, 1);
  });

  it("«Золотые руки»: golden plants come sooner", () => {
    const pauses = (level: number) => {
      const g = farm();
      g.completePad(g.pad("field_wheat_2")!);
      g.state.prestige.stars = 1000;
      for (let i = 0; i < level; i++) g.buyPerk("golden");
      g.state.player.x = 7;
      g.state.player.z = 9.5;
      g.state.surprises.goldenIn = 0.01;
      g.tick(DT);
      // Let it fade, and look at the pause to the next one.
      g.state.surprises.golden!.t = 0.01;
      g.tick(DT);
      return g.state.surprises.goldenIn;
    };
    expect(pauses(5)).toBeCloseTo(pauses(0) / (1 + 5 * GOLDEN_PER_LEVEL), 3);
  });
});

import { describe, expect, it } from "vitest";
import { fieldById } from "@/game/data/layout";
import { DAY_LENGTH, DAY_START, isNight } from "@/game/engine/daycycle";
import { Game } from "@/game/engine/Game";
import { SAVE_VERSION, deserialize, isFutureSave, serialize } from "@/game/engine/save";
import {
  DAYS_PER_SEASON,
  DEMAND_MULT,
  SEASONS,
  SEASON_LENGTH,
  SEASON_ORDER,
  seasonBlend,
  seasonDay,
  seasonOf,
  seasonTimeLeft,
  yearNumber,
  type SeasonId,
} from "@/game/engine/seasons";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run, wait, walkTo } from "./helpers";

/** Clock in `season` (of year 1 by default), `day` days in, at time of day `t`. */
const clockIn = (season: SeasonId, day = 0, t = 0.4, year = 0) =>
  ((year * 4 + SEASON_ORDER.indexOf(season)) * DAYS_PER_SEASON + day + t - DAY_START) * DAY_LENGTH;

function gameIn(season: SeasonId) {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.state.dayClock = clockIn(season);
  g.tick(0.01);
  g.rebuild();
  g.drainEvents();
  return g;
}

describe("calendar", () => {
  it("a new farm starts on the first day of spring", () => {
    expect(seasonOf(0)).toBe("spring");
    expect(seasonDay(0)).toBe(1);
    expect(yearNumber(0)).toBe(1);
    expect(new Game().state.season).toBe("spring");
  });

  it("each season lasts DAYS_PER_SEASON days, then the year starts over", () => {
    expect(seasonOf(clockIn("summer"))).toBe("summer");
    expect(seasonDay(clockIn("summer", 1))).toBe(2);
    expect(seasonOf(clockIn("winter", 1, 0.95))).toBe("winter");
    expect(seasonOf(clockIn("spring", 0, 0.01, 1))).toBe("spring");
    expect(yearNumber(clockIn("spring", 0, 0.5, 1))).toBe(2);
    expect(SEASON_LENGTH).toBe(DAYS_PER_SEASON * DAY_LENGTH);
  });

  it("counts down to the next season", () => {
    const c = clockIn("autumn", 0, 0.5);
    expect(seasonTimeLeft(c)).toBeCloseTo((DAYS_PER_SEASON - 0.5) * DAY_LENGTH);
    expect(seasonOf(c + seasonTimeLeft(c) + 1)).toBe("winter");
  });

  it("the visual change-over is smooth and happens at night", () => {
    let prevK = 0;
    let blending = 0;
    for (let c = clockIn("spring", 1, 0.8); c < clockIn("summer", 0, 0.2); c += 1) {
      const b = seasonBlend(c);
      if (b.k > 0 && b.k < 1) {
        blending++;
        expect(isNight(c)).toBe(true);
      }
      const k = b.a === "spring" && b.b === "summer" ? b.k : b.a === "summer" ? 1 : 0;
      expect(k).toBeGreaterThanOrEqual(prevK - 1e-9);
      expect(k - prevK).toBeLessThan(0.05);
      prevK = k;
    }
    expect(blending).toBeGreaterThan(30);
    expect(prevK).toBe(1);
    expect(seasonBlend(clockIn("autumn", 1, 0.4))).toEqual({ a: "autumn", b: "autumn", k: 0 });
  });

  it("announces every season once, in order", () => {
    const g = new Game();
    const seen: string[] = [];
    for (let i = 0; i < SEASON_LENGTH * 4 * 10; i++) {
      g.tick(0.1);
      for (const e of g.drainEvents()) if (e.type === "season") seen.push(e.season);
    }
    expect(seen).toEqual(["summer", "autumn", "winter", "spring"]);
  });
});

describe("season perks", () => {
  it("spring: plants regrow faster", () => {
    const regrown = (season: SeasonId) => {
      const g = gameIn(season);
      const f = g.state.fields.find((x) => x.id === "wheat_1")!;
      for (const p of f.plants) p.growth = 0;
      run(g, 3);
      return f.plants.reduce((s, p) => s + p.growth, 0);
    };
    expect(regrown("spring") / regrown("summer")).toBeCloseTo(1.25, 1);
  });

  it("summer: workers run faster", () => {
    const speed = (season: SeasonId) => {
      const g = gameIn(season);
      g.completePad(g.pad("field_wheat_2")!);
      g.completePad(g.pad("build_bakery")!);
      g.completePad(g.pad("hire_h_wheat_1")!);
      return g.state.workers[0].speed;
    };
    expect(speed("summer") / speed("winter")).toBeCloseTo(1.15);
  });

  it("autumn: every 4th harvest brings one more", () => {
    const harvested = (season: SeasonId) => {
      const g = gameIn(season);
      g.state.player.capacity = 100;
      const f = fieldById("wheat_1");
      walkTo(g, f.x - 2.2, f.z - 2.2);
      walkTo(g, f.x + 2.2, f.z + 2.2);
      run(g, 1);
      return { items: g.state.player.stack.length, plants: g.state.stats.harvested };
    };
    const summer = harvested("summer");
    const autumn = harvested("autumn");
    expect(summer.items).toBe(summer.plants);
    expect(autumn.items).toBe(autumn.plants + Math.floor(autumn.plants / 4));
  });

  it("winter: machines work faster", () => {
    const produced = (season: SeasonId) => {
      const g = gameIn(season);
      const mill = g.machine("mill")!;
      mill.inputs.wheat = 20;
      run(g, 8);
      return mill.produced;
    };
    expect(produced("winter")).toBeGreaterThan(produced("autumn"));
  });

  it("seasonal demand: goods in season sell for more, everywhere", () => {
    const g = gameIn("spring");
    const springEgg = g.sellValue("egg");
    g.state.dayClock = clockIn("summer");
    g.tick(0.01);
    expect(g.state.season).toBe("summer");
    expect(springEgg / g.sellValue("egg")).toBeCloseTo(DEMAND_MULT);
    for (const s of SEASON_ORDER) expect(SEASONS[s].demand.length).toBeGreaterThan(0);

    // Market sales use the same price.
    const before = g.state.money;
    g.state.player.stack.push("juice", "juice");
    walkTo(g, 7, 7);
    wait(g, 2);
    expect(g.state.money - before).toBeCloseTo(2 * 120 * DEMAND_MULT);
  });
});

describe("save v2", () => {
  it("migrates a v1 save: a prestige 'season' is now a 'generation'", () => {
    const v1 = { v: 1, money: 50, seasonEarned: 4321, prestige: { stars: 3, seasons: 2 }, dayClock: clockIn("winter") };
    const st = deserialize(v1);
    expect(st.runEarned).toBe(4321);
    expect(st.prestige).toEqual({ stars: 3, totalStars: 3, generations: 2 });
    expect(st.season).toBe("winter");
    const out = serialize(st);
    expect(out.v).toBe(SAVE_VERSION);
    expect(out.runEarned).toBe(4321);
    expect(out.prestige.generations).toBe(2);
  });

  it("the season is restored from the clock", () => {
    const g = gameIn("autumn");
    const g2 = new Game(deserialize(JSON.parse(JSON.stringify(serialize(g.state)))));
    expect(g2.state.season).toBe("autumn");
  });

  it("saves from a newer version are recognised", () => {
    expect(isFutureSave({ v: SAVE_VERSION + 1 })).toBe(true);
    expect(isFutureSave({ v: 1 })).toBe(false);
  });
});

describe("seasonal fair", () => {
  /** Winter, second (last) day, with a bakery: bread is in demand. */
  function fairGame(day = 1) {
    const g = new Game();
    g.state.tutorial = TUTORIAL_DONE;
    g.rebuild();
    g.completePad(g.pad("field_wheat_2")!);
    g.completePad(g.pad("build_bakery")!);
    g.state.dayClock = clockIn("winter", day, 0.3);
    g.tick(0.01);
    return g;
  }

  it("on the last day of a season the market holds a fair of seasonal goods", () => {
    const g = fairGame();
    const o = g.state.order!;
    expect(o.fair).toBe(true);
    expect(o.lines.map((l) => l.item)).toEqual(["bread"]);
    const value = o.lines.reduce((s, l) => s + l.need * g.sellValue(l.item), 0);
    expect(o.reward).toBeCloseTo(value * 2, 0);
  });

  it("there is no fair on other days", () => {
    const g = fairGame(0);
    expect(g.state.order?.fair).toBeFalsy();
  });

  it("happens once per season and does not interrupt an order in progress", () => {
    const g = new Game();
    g.state.tutorial = TUTORIAL_DONE;
    g.rebuild();
    g.completePad(g.pad("field_wheat_2")!);
    g.completePad(g.pad("build_bakery")!);
    g.state.order = { id: 1, lines: [{ item: "flour", need: 5, have: 2 }], reward: 10 };
    g.state.dayClock = clockIn("winter", 1, 0.3);
    run(g, 1);
    expect(g.state.order!.fair).toBeFalsy();
    // The player finishes their order — then the fair comes.
    g.state.player.stack.push("flour", "flour", "flour");
    walkTo(g, 7, 7);
    wait(g, 2);
    expect(g.state.order?.fair).toBe(true);
    // Finish the fair: the next order is an ordinary one again.
    const need = g.state.order!.lines[0].need;
    g.state.player.capacity = 200;
    for (let i = 0; i < need; i++) g.state.player.stack.push("bread");
    wait(g, 6);
    expect(g.state.order).toBeNull();
    run(g, 10);
    expect(g.state.order).not.toBeNull();
    expect(g.state.order!.fair).toBeFalsy();
  });

  it("the fair survives a save", () => {
    const g = fairGame();
    const st = deserialize(JSON.parse(JSON.stringify(serialize(g.state))));
    expect(st.order!.fair).toBe(true);
    expect(st.lastFair).toBe(g.state.lastFair);
  });
});

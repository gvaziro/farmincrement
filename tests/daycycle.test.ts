import { describe, expect, it } from "vitest";
import { DAY_LENGTH, DAY_START, dayNumber, dayPhase, isNight, nightFactor, timeOfDay } from "@/game/engine/daycycle";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { run } from "./helpers";

/** Clock value that puts the time of day at `t`. */
const clockAt = (t: number, day = 0) => ((t - DAY_START + 1) % 1) * DAY_LENGTH + day * DAY_LENGTH;

describe("day cycle math", () => {
  it("starts in the morning of day 1", () => {
    expect(timeOfDay(0)).toBeCloseTo(DAY_START);
    expect(dayPhase(timeOfDay(0))).toBe("day");
    expect(dayNumber(0)).toBe(1);
    expect(isNight(0)).toBe(false);
  });

  it("goes through every phase within one day", () => {
    const seen = new Set<string>();
    for (let s = 0; s < DAY_LENGTH; s += 2) seen.add(dayPhase(timeOfDay(s)));
    expect([...seen].sort()).toEqual(["dawn", "day", "night", "sunset"]);
  });

  it("night factor is smooth and bounded", () => {
    expect(nightFactor(0.3)).toBe(0);
    expect(nightFactor(0.95)).toBe(1);
    expect(nightFactor(0.0)).toBe(1);
    let prev = nightFactor(0);
    for (let t = 0.001; t < 1; t += 0.001) {
      const v = nightFactor(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.abs(v - prev)).toBeLessThan(0.05);
      prev = v;
    }
  });

  it("night is a short part of the day", () => {
    let night = 0;
    for (let s = 0; s < DAY_LENGTH; s++) if (isNight(s)) night++;
    expect(night / DAY_LENGTH).toBeGreaterThan(0.1);
    expect(night / DAY_LENGTH).toBeLessThan(0.25);
  });

  it("counts days", () => {
    expect(dayNumber(clockAt(0.5, 0))).toBe(1);
    expect(dayNumber(clockAt(0.5, 3))).toBe(4);
  });
});

describe("day cycle in the game", () => {
  it("announces nightfall and dawn once per day", () => {
    const g = new Game();
    const phases: string[] = [];
    for (let i = 0; i < DAY_LENGTH * 10; i++) {
      g.tick(0.1);
      for (const e of g.drainEvents()) if (e.type === "dayPhase") phases.push(e.phase);
    }
    expect(phases).toEqual(["night", "dawn"]);
  });

  it("fish bite faster at night", () => {
    const fishedAt = (t: number) => {
      const g = new Game();
      g.state.tutorial = TUTORIAL_DONE;
      g.rebuild();
      for (const id of ["zone_coop", "zone_pasture", "zone_depot", "zone_orchard", "zone_garden", "zone_sweets", "zone_pond"]) g.completePad(g.pad(id)!);
      g.state.dayClock = clockAt(t);
      const f = g.state.fields.find((x) => x.id === "fish_1")!;
      run(g, 1);
      for (const p of f.plants) {
        p.fruits = 0;
        p.timer = 0;
      }
      run(g, 3);
      return f.plants.reduce((s, p) => s + p.fruits, 0);
    };
    const day = fishedAt(0.4);
    const night = fishedAt(0.93);
    expect(night).toBeGreaterThan(day);
  });

  it("keeps the clock in saves and resets it for a new generation", () => {
    const g = new Game();
    g.state.dayClock = 1234.5;
    const g2 = new Game(deserialize(JSON.parse(JSON.stringify(serialize(g.state)))));
    expect(g2.state.dayClock).toBeCloseTo(1234.5);
    g2.state.statue = true;
    g2.state.runEarned = 1_000_000;
    g2.prestige();
    expect(g2.state.dayClock).toBe(0);
  });
});

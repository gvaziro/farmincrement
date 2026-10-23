import { describe, expect, it } from "vitest";
import { DAY_LENGTH, DAY_START } from "@/game/engine/daycycle";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { SEASON_ORDER, type SeasonId } from "@/game/engine/seasons";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { RAIN_GROWTH, WEATHER_CHANCES, rainbowAt, seasonOfDay, weatherAt, weatherOfDay, type WeatherKind } from "@/game/engine/weather";
import { run } from "./helpers";

/** Clock on day N (1-based) at time of day t. */
const clockOn = (day: number, t: number) => (day - 1 + t - DAY_START) * DAY_LENGTH;

/** First day ≥ from with this weather. */
function findDay(kind: WeatherKind, from = 2, season?: SeasonId) {
  for (let d = from; d < from + 2000; d++) {
    if (weatherOfDay(d).kind === kind && (!season || seasonOfDay(d) === season)) return d;
  }
  throw new Error(`no ${kind} day`);
}

describe("weather of the day", () => {
  it("is deterministic and the first day is always sunny", () => {
    expect(weatherOfDay(1).kind).toBe("clear");
    for (let d = 2; d < 50; d++) expect(weatherOfDay(d)).toEqual(weatherOfDay(d));
  });

  it("follows the season: no rain in winter, snow only in winter", () => {
    for (let d = 2; d < 800; d++) {
      const w = weatherOfDay(d).kind;
      const s = seasonOfDay(d);
      if (s === "winter") expect(w).not.toBe("rain");
      else expect(w).not.toBe("snow");
    }
  });

  it("happens about as often as the chances say", () => {
    const days: Record<SeasonId, number> = { spring: 0, summer: 0, autumn: 0, winter: 0 };
    const seen: Record<string, number> = {};
    for (let d = 2; d < 4002; d++) {
      const s = seasonOfDay(d);
      days[s]++;
      const k = `${s}:${weatherOfDay(d).kind}`;
      seen[k] = (seen[k] ?? 0) + 1;
    }
    for (const s of SEASON_ORDER) {
      for (const [kind, p] of WEATHER_CHANCES[s]) {
        expect((seen[`${s}:${kind}`] ?? 0) / days[s]).toBeCloseTo(p, 1);
      }
    }
  });

  it("stays within the day and ramps in and out", () => {
    for (let d = 2; d < 400; d++) {
      const w = weatherOfDay(d);
      if (w.kind === "clear") continue;
      expect(w.start).toBeGreaterThan(0.05);
      expect(w.end).toBeLessThan(0.86);
      expect(w.end).toBeGreaterThan(w.start + 0.05);
    }
    const d = findDay("rain");
    const w = weatherOfDay(d);
    expect(weatherAt(clockOn(d, w.start - 0.01)).k).toBe(0);
    expect(weatherAt(clockOn(d, (w.start + w.end) / 2))).toEqual({ kind: "rain", k: 1 });
    expect(weatherAt(clockOn(d, w.end + 0.01)).k).toBe(0);
  });

  it("a rainbow follows spring and summer showers only", () => {
    const summer = findDay("rain", 2, "summer");
    const ws = weatherOfDay(summer);
    expect(rainbowAt(clockOn(summer, ws.end + 0.02))).toBeGreaterThan(0.5);
    expect(rainbowAt(clockOn(summer, ws.end + 0.2))).toBe(0);
    const autumn = findDay("rain", 2, "autumn");
    expect(rainbowAt(clockOn(autumn, weatherOfDay(autumn).end + 0.02))).toBe(0);
  });
});

describe("weather in the game", () => {
  it("rain makes plants grow faster", () => {
    const rainy = findDay("rain", 2, "summer");
    const w = weatherOfDay(rainy);
    const regrown = (clock: number) => {
      const g = new Game();
      g.state.tutorial = TUTORIAL_DONE;
      g.state.dayClock = clock;
      g.tick(0.01);
      const f = g.state.fields.find((x) => x.id === "wheat_1")!;
      for (const p of f.plants) p.growth = 0;
      run(g, 2);
      return f.plants.reduce((s, p) => s + p.growth, 0);
    };
    const inRain = regrown(clockOn(rainy, (w.start + w.end) / 2));
    const dry = regrown(clockOn(rainy, w.start - 0.05));
    expect(inRain / dry).toBeCloseTo(RAIN_GROWTH, 1);
  });

  it("announces the start and the end of the weather", () => {
    const d = findDay("rain", 3);
    const w = weatherOfDay(d);
    const g = new Game();
    g.state.dayClock = clockOn(d, w.start - 0.01);
    g.tick(0.01);
    g.drainEvents();
    const events: string[] = [];
    for (let i = 0; i < (w.end - w.start + 0.03) * DAY_LENGTH * 10; i++) {
      g.tick(0.1);
      for (const e of g.drainEvents()) if (e.type === "weather") events.push(`${e.from}→${e.kind}`);
    }
    expect(events).toEqual(["clear→rain", "rain→clear"]);
  });

  it("weather is restored from the clock after a reload", () => {
    const d = findDay("snow");
    const w = weatherOfDay(d);
    const g = new Game();
    g.state.dayClock = clockOn(d, (w.start + w.end) / 2);
    g.tick(0.01);
    expect(g.state.weather).toBe("snow");
    const st = deserialize(JSON.parse(JSON.stringify(serialize(g.state))));
    expect(st.weather).toBe("snow");
  });
});

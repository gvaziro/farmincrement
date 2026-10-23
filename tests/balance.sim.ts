/**
 * Balance simulation: `npm run balance`.
 * A greedy bot plays the real engine from scratch, builds the statue, hands
 * the farm over and plays the next generations with the legacy upgrades it
 * bought. Prints when it bought what. Use it after touching prices, speeds,
 * the layout or the legacy shop.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/game/core/format";
import { PERKS, type PerkId } from "@/game/data/legacy";
import { Bot } from "./bot";

const GENERATIONS = 3;

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(3, " ")}:${String(s).padStart(2, "0")}`;
};

interface Generation {
  time: number;
  earned: number;
  stars: number;
  zones: Record<string, number>;
  rows: string[];
  log: string[];
  perks: PerkId[];
}

/** Play one generation until the statue stands. */
function playGeneration(bot: Bot, perks: PerkId[]): Generation {
  const zones: Record<string, number> = {};
  const rows: string[] = [];
  let nextReport = 0;
  bot.run(4 * 3600, 1 / 15, () => {
    const st = bot.st;
    for (const z of st.zones) if (!(z in zones)) zones[z] = st.time;
    if (st.time >= nextReport) {
      nextReport += 600;
      rows.push(`${fmt(st.time)}  💰 ${formatMoney(st.money).padStart(7)}  авто ${st.autoIncome.rate.toFixed(1)}/с  работников ${st.workers.length}`);
    }
    return st.statue;
  });
  const st = bot.st;
  return {
    time: st.time,
    earned: st.runEarned,
    stars: bot.g.prestigeStars(),
    zones,
    rows,
    log: bot.log.map((l) => `${fmt(l.t)}  ${l.what}`),
    perks,
  };
}

/** "Добрая слава ×2, Семейная казна ×1" */
function perkList(perks: PerkId[]) {
  const n = new Map<PerkId, number>();
  for (const p of perks) n.set(p, (n.get(p) ?? 0) + 1);
  return [...n].map(([id, k]) => `${PERKS[id].name} ×${k}`).join(", ") || "—";
}

describe("balance", () => {
  it("greedy bot builds the whole empire, three generations in a row", () => {
    const bot = new Bot();
    const gens: Generation[] = [];
    for (let i = 0; i < GENERATIONS; i++) {
      const perks = i === 0 ? [] : bot.nextGeneration();
      gens.push(playGeneration(bot, perks));
      expect(bot.st.statue, `generation ${i + 1} reaches the statue`).toBe(true);
    }

    const [first] = gens;
    const report = [
      "# Отчёт бот-симуляции баланса",
      "",
      "Сгенерировано `npm run balance`: жадный бот играет в настоящий движок с нуля, строит статую,",
      "передаёт ферму следующему поколению, тратит звёзды на самые дешёвые улучшения наследия",
      "и проходит игру снова.",
      "",
      "```",
      "── Поколения ──",
      ...gens.map(
        (g, i) =>
          `${i + 1}.  ${fmt(g.time)}  заработано $${formatMoney(g.earned).padEnd(6)}  → ${String(g.stars).padStart(3)} ⭐` +
          (i > 0 ? `   улучшения: ${perkList(g.perks)}` : ""),
      ),
      "",
      "── Участки по поколениям ──",
      ...Object.keys(first.zones).map((z) => `${z.padEnd(9)} ${gens.map((g) => (z in g.zones ? fmt(g.zones[z]) : "   —   ")).join("   ")}`),
      "",
      "── Первое поколение: каждые 10 минут ──",
      ...first.rows,
      "",
      "── Первое поколение: покупки ──",
      ...first.log,
      "```",
      "",
    ].join("\n");
    writeFileSync(fileURLToPath(new URL("../docs/balance-report.md", import.meta.url)), report);
    console.log(report);

    expect(first.log.length).toBeGreaterThan(0);
    expect(first.zones.coop).toBeLessThan(20 * 60);
    // Every generation is faster than the one before, but not trivially so.
    for (let i = 1; i < gens.length; i++) {
      expect(gens[i].time).toBeLessThan(gens[i - 1].time);
      expect(gens[i].time).toBeGreaterThan(gens[0].time * 0.3);
    }
  }, 3_600_000);
});

/**
 * Balance simulation: `npm run balance`.
 * A greedy bot plays the real engine from scratch and prints when it bought
 * what. Use it after touching prices, speeds or the layout.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/game/core/format";
import { Bot } from "./bot";

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(3, " ")}:${String(s).padStart(2, "0")}`;
};

describe("balance", () => {
  it("greedy bot builds the whole empire", () => {
    const bot = new Bot();
    const limit = 4 * 3600;
    const milestones: Record<string, number> = {};
    let nextReport = 0;
    const rows: string[] = [];
    bot.run(limit, 1 / 15, () => {
      const st = bot.st;
      for (const z of st.zones) if (!(z in milestones)) milestones[z] = st.time;
      if (st.time >= nextReport) {
        nextReport += 600;
        rows.push(`${fmt(st.time)}  💰 ${formatMoney(st.money).padStart(7)}  авто ${st.autoIncome.rate.toFixed(1)}/с  работников ${st.workers.length}`);
      }
      return st.statue;
    });
    const st = bot.st;
    const lines = bot.log.map((l) => `${fmt(l.t)}  ${l.what}`);
    const report = [
      "# Отчёт бот-симуляции баланса",
      "",
      "Сгенерировано `npm run balance`: жадный бот играет в настоящий движок с нуля.",
      "",
      "```",
      `Итого: ${fmt(st.time)}, заработано $${formatMoney(st.stats.earned)}, статуя: ${st.statue ? "да" : "нет"}`,
      "",
      "── Зоны ──",
      ...Object.entries(milestones).map(([z, t]) => `${fmt(t)}  ${z}`),
      "",
      "── Каждые 10 минут ──",
      ...rows,
      "",
      "── Покупки ──",
      ...lines,
      "```",
      "",
    ].join("\n");
    writeFileSync(fileURLToPath(new URL("../docs/balance-report.md", import.meta.url)), report);
    console.log(report);

    expect(bot.log[0].t).toBeLessThan(120);
    expect(milestones.coop).toBeLessThan(20 * 60);
    expect(st.statue).toBe(true);
  }, 1_200_000);
});

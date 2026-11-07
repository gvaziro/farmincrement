/**
 * Balance of chapter III: `npm run balance:island`. The farm's own bot steps
 * off the seaplane with empty pockets and plays the island to the lighthouse
 * through the real engine — the island is a farm, so it plays it the same way.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/game/core/format";
import { ISLAND_ZONES } from "@/game/data/island";
import { Game } from "@/game/engine/Game";
import { createInitialState } from "@/game/engine/world";
import { Bot } from "./bot";

const fmt = (t: number) => `${String(Math.floor(t / 60)).padStart(3, " ")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

describe("island balance", () => {
  it("a bot lights the lighthouse", () => {
    const bot = new Bot(new Game(createInitialState("island")));
    const st = bot.st;
    const zones: Record<string, number> = {};
    const rows: string[] = [];
    let next = 0;
    const started = Date.now();
    const done = bot.run(8 * 3600, 1 / 12, () => {
      for (const z of st.zones) if (!(z in zones)) zones[z] = st.dayClock;
      if (st.dayClock >= next) {
        next += 600;
        rows.push(`${fmt(st.dayClock)}  💰 ${formatMoney(st.money).padStart(7)}  заработано ${formatMoney(st.stats.earned).padStart(7)}  авто ${formatMoney(st.autoIncome.rate).padStart(6)}/с  работников ${String(st.workers.length).padStart(3)}`);
      }
      return st.statue;
    });
    const zoneRows = ISLAND_ZONES.filter((z) => zones[z.id] !== undefined).map((z) => `${z.icon} ${z.name}: ${fmt(zones[z.id])}`);
    const report = [
      "# Баланс главы III «Остров»",
      "",
      "Бот фермы выходит из гидроплана с пустыми карманами и проходит остров до Маяка через настоящий ввод. `npm run balance:island`.",
      "",
      `**Итог:** ${done ? `Маяк зажжён за ${fmt(st.dayClock)} (${(st.dayClock / 3600).toFixed(1)} ч)` : "Маяк не зажжён за 8 часов"}, заработано $${formatMoney(st.stats.earned)}, работников ${st.workers.length}.`,
      "",
      "## Острова",
      "",
      ...zoneRows.map((r) => `- ${r}`),
      "",
      "## Ход игры",
      "",
      "```",
      ...rows,
      "```",
      "",
      "## Покупки",
      "",
      "```",
      ...bot.log.filter((l) => !l.what.includes("ур.")).map((l) => `${fmt(l.t)}  ${l.what}`),
      "```",
      "",
    ].join("\n");
    writeFileSync(fileURLToPath(new URL("../docs/island-balance-report.md", import.meta.url)), report);
    console.log(zoneRows.join("\n"));
    console.log(`done=${done} t=${fmt(st.dayClock)} sim took ${Math.round((Date.now() - started) / 1000)} s`);
    expect(done).toBe(true);
  }, 3_000_000);
});

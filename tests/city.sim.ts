/**
 * Balance of chapter II: `npm run balance:city`. A bot steps off the bus with
 * a finished farm and plays the city to the top of the Tower through the real
 * engine. Use it after touching prices, speeds, customers or the layout.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatMoney } from "@/game/core/format";
import { CITY_ZONES } from "@/game/data/layout";
import { Game } from "@/game/engine/Game";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import { CityBot } from "./cityBot";

const fmt = (t: number) => `${String(Math.floor(t / 60)).padStart(3, " ")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

describe("city balance", () => {
  it("a bot reaches the top of the Tower", () => {
    const g = new Game();
    g.state.tutorial = TUTORIAL_DONE;
    g.state.statue = true;
    g.state.bus = true;
    g.rebuild();
    g.travel();
    const bot = new CityBot(g);
    const st = g.state;
    const zones: Record<string, number> = {};
    const rows: string[] = [];
    let next = 0;
    const started = Date.now();
    const done = bot.run(8 * 3600, 1 / 10, () => {
      for (const z of st.zones) if (!(z in zones)) zones[z] = st.dayClock;
      if (st.dayClock >= next) {
        next += 600;
        const cust = st.city!.customers.filter((c) => c.cphase !== "none").length;
        rows.push(`${fmt(st.dayClock)}  💰 ${formatMoney(st.money).padStart(7)}  заработано ${formatMoney(st.stats.earned).padStart(7)}  авто ${formatMoney(st.autoIncome.rate).padStart(6)}/с  сотрудников ${String(st.workers.length).padStart(3)}  покупателей ${String(cust).padStart(2)}  обслужено ${st.stats.served}`);
      }
      return st.city!.finished;
    });
    const zoneRows = CITY_ZONES.filter((z) => zones[z.id] !== undefined).map((z) => `${z.icon} ${z.name}: ${fmt(zones[z.id])}`);
    const report = [
      "# Баланс главы II «Город»",
      "",
      "Бот выходит из автобуса с пустыми руками и проходит город до верха Башни через настоящий ввод. `npm run balance:city`.",
      "",
      `**Итог:** ${done ? `Башня достроена за ${fmt(st.dayClock)} (${(st.dayClock / 3600).toFixed(1)} ч)` : "Башня не достроена за 8 часов"}, заработано $${formatMoney(st.stats.earned)}, обслужено ${st.stats.served} покупателей, доставок ${st.stats.delivered}, сотрудников ${st.workers.length}.`,
      "",
      "## Заведения",
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
      ...bot.log.filter((l) => !/Ремонт|Реклама|Фургон|ур\./.test(l.what)).map((l) => `${fmt(l.t)}  ${l.what}`),
      "```",
      "",
    ].join("\n");
    writeFileSync(fileURLToPath(new URL("../docs/city-balance-report.md", import.meta.url)), report);
    console.log(zoneRows.join("\n"));
    console.log(rows.slice(-6).join("\n"));
    console.log(`done=${done} stuck=${bot.stuck} money=${formatMoney(st.money)} task=${bot.task?.kind} t=${fmt(st.dayClock)} sim took ${Math.round((Date.now() - started) / 1000)} s`);
    expect(done).toBe(true);
  }, 3_000_000);
});

/**
 * Calibration of the challenges: `npm run balance:challenges`.
 * The bot plays a first generation and hands the farm over; from that very
 * same hand-over it then plays the second generation without challenges and
 * once with each challenge. How much longer each one takes is what its stars
 * multiplier should roughly be.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHALLENGES, CHALLENGE_IDS, type ChallengeId } from "@/game/data/challenges";
import { Game } from "@/game/engine/Game";
import { deserialize, serialize } from "@/game/engine/save";
import { Bot } from "./bot";

const fmt = (t: number) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};

describe("challenges", () => {
  it("each one makes the second generation longer, about as much as it pays", () => {
    const first = new Bot();
    first.run(5 * 3600, 1 / 15, () => first.st.statue);
    expect(first.st.statue).toBe(true);
    const handOver = JSON.stringify(serialize(first.st));

    const runs: { id: ChallengeId | null; time: number }[] = [];
    for (const id of [null, ...CHALLENGE_IDS]) {
      const bot = new Bot(new Game(deserialize(JSON.parse(handOver))));
      bot.nextGeneration(id ? [id] : []);
      bot.run(6 * 3600, 1 / 15, () => bot.st.statue);
      expect(bot.st.statue, `${id ?? "none"} reaches the statue`).toBe(true);
      runs.push({ id, time: bot.st.dayClock });
    }

    const base = runs[0].time;
    const report = [
      "# Калибровка испытаний",
      "",
      "Сгенерировано `npm run balance:challenges`: бот проходит первое поколение, передаёт ферму",
      "и от той же самой передачи проходит второе поколение без испытаний и с каждым из них.",
      "Во сколько раз дольше выходит поколение — примерно таким и должен быть множитель звёзд.",
      "",
      "```",
      `без испытаний            ${fmt(base)}`,
      ...runs.slice(1).map((r) => {
        const c = CHALLENGES[r.id!];
        return `${c.icon} ${c.name.padEnd(18)}  ${fmt(r.time)}   время ×${(r.time / base).toFixed(2)}   звёзды ×${c.stars}`;
      }),
      "```",
      "",
    ].join("\n");
    writeFileSync(fileURLToPath(new URL("../docs/challenges-report.md", import.meta.url)), report);
    console.log(report);

    for (const r of runs.slice(1)) expect(r.time, r.id!).toBeGreaterThan(base);
  }, 3_600_000);
});

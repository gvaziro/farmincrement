/**
 * "Копеечка": while you play one world, the others send a little money. The
 * rate is set when you arrive (see Game.travel); it is paid every half minute.
 */
import { FARM_PENNY_EVERY } from "../../data/city";
import type { Game } from "../Game";

export function updatePenny(game: Game, dt: number) {
  const p = game.state.penny;
  if (p.rate <= 0) return;
  p.acc += p.rate * dt;
  p.t -= dt;
  if (p.t > 0) return;
  p.t = FARM_PENNY_EVERY;
  const value = p.acc;
  p.acc = 0;
  if (value < 0.01) return;
  // Not "automated": offline income adds the penny on its own (see offlineFor).
  game.earn(value, false);
  game.emit({ type: "penny", value });
}

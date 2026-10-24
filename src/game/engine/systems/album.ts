/**
 * The album of finds: now and then a harvest by the farmer turns up a little
 * rarity from that plot's set. Workers never find anything — the album is a
 * reason to walk the fields yourself.
 */
import { nextRandom } from "../../core/math";
import { FIND_CHANCE, findSetOf } from "../../data/finds";
import type { ZoneId } from "../../data/layout";
import type { Game } from "../Game";
import { TUTORIAL_DONE } from "../tutorial";

/** Called for every harvest the farmer makes on a plot. */
export function rollFind(game: Game, zone: ZoneId, x: number, z: number) {
  const st = game.state;
  if (st.tutorial < TUTORIAL_DONE) return;
  const set = findSetOf(zone);
  const missing = set ? set.finds.filter((f) => !st.album.has(f.id)) : [];
  if (missing.length === 0 || nextRandom(st.surprises) >= FIND_CHANCE) return;
  const find = missing[Math.floor(nextRandom(st.surprises) * missing.length)];
  st.album.add(find.id);
  game.emit({ type: "find", id: find.id, complete: missing.length === 1, x, z });
}

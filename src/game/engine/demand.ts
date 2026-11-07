/** Goods in demand this season: each world has its own list. */
import { CITY_DEMAND } from "../data/city";
import { ISLAND_DEMAND } from "../data/island";
import type { ItemId } from "../data/items";
import { DEMAND_MULT, SEASONS } from "./seasons";
import type { GameState } from "./types";

export function demandOf(st: Pick<GameState, "world" | "season">): readonly ItemId[] {
  if (st.world === "city") return CITY_DEMAND[st.season];
  if (st.world === "island") return ISLAND_DEMAND[st.season];
  return SEASONS[st.season].demand;
}

/** Price multiplier for `item` right now. */
export const demandMult = (st: Pick<GameState, "world" | "season">, item: ItemId) => (demandOf(st).includes(item) ? DEMAND_MULT : 1);

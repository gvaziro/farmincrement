/**
 * Market orders: a short-term goal on the board above the market, e.g.
 * "20 bread + 10 cheese". Goods the player sells at the market count towards
 * it; finishing pays a bonus on top of the normal price.
 *
 * On the last day of every season there is a fair: one order made of the
 * season's goods in demand, with a double bonus. It lasts until the season
 * ends; an unfinished fair then leaves the board.
 */
import { FAIR_BONUS, ORDER_BONUS, ORDER_COOLDOWN } from "../../data/balance";
import { ITEMS, isSellable, type ItemId } from "../../data/items";
import type { Game } from "../Game";
import { DAYS_PER_SEASON, SEASONS, seasonDay, seasonSerial } from "../seasons";
import { TUTORIAL_DONE } from "../tutorial";
import type { Order } from "../types";

export function updateOrders(game: Game, dt: number) {
  const st = game.state;
  if (st.tutorial < TUTORIAL_DONE) return;
  // The fair's season is over: its goods are out of season now.
  if (st.order?.fair && st.lastFair !== seasonSerial(st.dayClock)) {
    st.order = null;
    st.orderCooldown = 3;
    game.emit({ type: "order", state: "expired" });
  }
  if (startFair(game)) return;
  if (st.order) return;
  st.orderCooldown -= dt;
  if (st.orderCooldown > 0) return;
  const order = makeOrder(game);
  if (!order) {
    st.orderCooldown = 3;
    return;
  }
  st.order = order;
  game.emit({ type: "order", state: "new" });
}

/** Products the farm can make right now, most valuable first. */
function availableProducts(game: Game): ItemId[] {
  const set = new Set<ItemId>();
  for (const m of game.state.machines) {
    const out = m.type.output.item;
    if (isSellable(out)) set.add(out);
  }
  return [...set].sort((a, b) => ITEMS[b].price - ITEMS[a].price);
}

/**
 * On the last day of a season, the fair takes over the board — unless the
 * player is already working on an order: then it waits for that order to be
 * finished (as long as the last day lasts).
 */
function startFair(game: Game) {
  const st = game.state;
  const serial = seasonSerial(st.dayClock);
  if (st.lastFair === serial || seasonDay(st.dayClock) !== DAYS_PER_SEASON) return false;
  if (st.order && (st.order.fair || st.order.lines.some((l) => l.have > 0))) return false;
  const fair = makeFairOrder(game);
  if (!fair) return false;
  st.order = fair;
  st.lastFair = serial;
  game.emit({ type: "order", state: "fair" });
  return true;
}

/** The fair: seasonal goods the farm can make, bigger amounts, double bonus. */
export function makeFairOrder(game: Game): Order | null {
  const st = game.state;
  const demand = SEASONS[st.season].demand;
  const products = availableProducts(game).filter((i) => demand.includes(i));
  if (products.length === 0) return null;
  const lines = Math.min(2, products.length);
  const cap = st.player.capacity;
  const order: Order = {
    id: st.stats.orders + 1,
    lines: products.slice(0, lines).map((item) => ({ item, need: Math.max(6, Math.round((cap * 1.3) / lines)), have: 0 })),
    reward: 0,
    fair: true,
  };
  order.reward = Math.round(order.lines.reduce((s, l) => s + l.need * game.sellValue(l.item), 0) * FAIR_BONUS);
  return order;
}

export function makeOrder(game: Game): Order | null {
  const st = game.state;
  const products = availableProducts(game);
  if (products.length === 0) return null;
  const n = st.stats.orders;
  // 1 line at first, then mostly 2, sometimes 3.
  const lines = Math.min(products.length, n < 2 ? 1 : n % 4 === 3 ? 3 : 2);
  // Lean towards the newest (most valuable) goods, but mix older ones in.
  const pool = products.slice(0, Math.max(lines, 3));
  const picked: ItemId[] = [];
  let seed = (n * 7919 + Math.floor(st.time)) >>> 0;
  while (picked.length < lines) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const item = pool[seed % pool.length];
    if (!picked.includes(item)) picked.push(item);
  }
  const cap = st.player.capacity;
  const order: Order = {
    id: n + 1,
    lines: picked.map((item, i) => ({
      item,
      need: Math.max(4, Math.round((cap * (0.9 + ((seed >> (i * 3)) % 5) * 0.12)) / lines)),
      have: 0,
    })),
    reward: 0,
  };
  order.reward = Math.round(order.lines.reduce((s, l) => s + l.need * game.sellValue(l.item), 0) * ORDER_BONUS);
  return order;
}

/** Called for every item the player sells at the market. */
export function countOrderSale(game: Game, item: ItemId) {
  const st = game.state;
  const o = st.order;
  if (!o) return;
  const line = o.lines.find((l) => l.item === item && l.have < l.need);
  if (!line) return;
  line.have++;
  if (o.lines.every((l) => l.have >= l.need)) {
    game.earn(o.reward, false);
    st.stats.orders++;
    if (o.fair) st.stats.fairs++;
    st.order = null;
    st.orderCooldown = ORDER_COOLDOWN;
    game.emit({ type: "order", state: "done", reward: o.reward, fair: o.fair });
  }
}

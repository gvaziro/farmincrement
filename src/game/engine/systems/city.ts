/**
 * The city's economy. Instead of a harvest there are customers:
 *
 *   van → pallet → counter → customer picks goods → queue → till → money table → wallet
 *
 * Nothing here ever takes money away: an empty counter only means a customer
 * walks off and the sale does not happen.
 */
import { dampAngle, dampFactor, easeInOutSine } from "../../core/math";
import {
  AUTUMN_TIP_MULT,
  BLOGGER_EVERY,
  BLOGGER_MULT,
  BLOGGER_TIME,
  CITY_DEMAND,
  CUSTOMER_INTERVAL,
  CUSTOMER_PATIENCE,
  DELIVERY_MULT,
  FARM_PENNY_EVERY,
  FARM_PENNY_PER_MACHINE,
  FLOOR_PRICE_BONUS,
  PARK_CUSTOMERS,
  PLAYER_SERVE,
  SPRING_CUSTOMERS,
  TABLE_EAT_TIME,
  TABLE_TIP,
  VAN_DRIVE,
  VAN_FAR,
  VAN_TRIP,
  VAN_UNLOAD_EVERY,
  adsSpeed,
  cashierServe,
  customerWants,
  dayRush,
  isRushHour,
  palletCapacity,
  shelfCapacity,
  shopMaxCustomers,
  shopPriceMult,
  vanLoad,
  type ShelfDef,
} from "../../data/city";
import { ITEMS, isSellable, type ItemId } from "../../data/items";
import { FAME_PER_LEVEL } from "../../data/legacy";
import { DEMAND_MULT } from "../seasons";
import { timeOfDay } from "../daycycle";
import { pileSlot, stackSlotLocal } from "../anchors";
import { TUTORIAL_DONE } from "../tutorial";
import type { Game } from "../Game";
import type { Actor, CityState, Customer, GameState, ShelfState, ShopState, TableState } from "../types";
import { updateLean } from "./movement";

const CASH_BUNDLES_MAX = 90;
/** Where a counter shows its goods: a low pile on the counter top. */
const COUNTER_TOP = 0.98;

// ── places on a counter and on the money table ──────────────────────────
export function shelfSlot(def: ShelfDef, slot: number) {
  const cols = 4;
  const rows = 2;
  const per = cols * rows;
  const layer = Math.floor(slot / per);
  const k = slot % per;
  return {
    x: def.box.x + ((k % cols) - (cols - 1) / 2) * 0.58,
    y: COUNTER_TOP + layer * ITEMS[def.item].height,
    z: def.box.z + (Math.floor(k / cols) - 0.5) * 0.42,
  };
}

export function cashSlot(shop: ShopState, slot: number) {
  const c = shop.def.cash;
  const p = pileSlot({ x: c.x, z: c.z, hw: c.w / 2, hd: c.d / 2 }, slot, 0.09);
  return { x: p.x, y: p.y + 0.06, z: p.z };
}

/** The queue slot for a place in line (a very long line bunches up at its end). */
export function queueSlot(shop: ShopState, place: number) {
  const q = shop.def.queue;
  return q[Math.min(place, q.length - 1)];
}

// ── numbers that depend on the state ────────────────────────────────────
/** What the customer pays for `item` in this business right now. */
export function cityPrice(game: Game, shop: ShopState, item: ItemId) {
  const st = game.state;
  const demand = (CITY_DEMAND[st.season] as readonly ItemId[]).includes(item) ? DEMAND_MULT : 1;
  const floors = st.city ? 1 + st.city.floors * FLOOR_PRICE_BONUS : 1;
  return ITEMS[item].price * shopPriceMult(shop.level) * demand * floors * (1 + game.perk("fame") * FAME_PER_LEVEL) * game.rushMult();
}

/** Customers per second a business attracts right now. */
export function customerRate(st: GameState, shop: ShopState) {
  let rate = adsSpeed(shop.ads) / CUSTOMER_INTERVAL;
  if (st.season === "spring") rate *= SPRING_CUSTOMERS;
  if (st.zones.has("c_park")) rate *= PARK_CUSTOMERS;
  if (shop.buzz > 0) rate *= BLOGGER_MULT;
  return rate * dayRush(timeOfDay(st.dayClock));
}

/** The farm's "копеечка": every machine on the farm sends a little. */
export const farmPenny = (farm: GameState) => Math.round(farm.machines.length * FARM_PENNY_PER_MACHINE * 100) / 100;

const activeCustomers = (city: CityState, id: string) => {
  let n = 0;
  for (const c of city.customers) if (c.shop === id && c.cphase !== "none") n++;
  return n;
};

// ── the tick ────────────────────────────────────────────────────────────
export function updateCity(game: Game, dt: number) {
  const st = game.state;
  const city = st.city;
  if (!city) return;
  updatePenny(game, city, dt);
  const rush = isRushHour(timeOfDay(st.dayClock));
  if (rush && !city.rushHour && st.tutorial >= TUTORIAL_DONE) game.emit({ type: "rushHour" });
  city.rushHour = rush;
  updateBlogger(game, city, dt);
  for (const shop of city.shops) {
    shop.pulse = Math.max(0, shop.pulse - dt * 3);
    for (const s of shop.shelves) s.spawnT += dt;
    for (const t of shop.tables) t.spawnT += dt;
    updateVan(game, shop, dt);
    updateArrivals(game, city, shop, dt);
    updateTill(game, shop, dt);
  }
  for (const c of city.customers) if (c.cphase !== "none") updateCustomer(game, c, dt);
}

function updatePenny(game: Game, city: CityState, dt: number) {
  if (city.penny <= 0) return;
  city.pennyAcc += city.penny * dt;
  city.pennyT -= dt;
  if (city.pennyT > 0) return;
  city.pennyT = FARM_PENNY_EVERY;
  const value = city.pennyAcc;
  city.pennyAcc = 0;
  if (value < 0.01) return;
  game.earn(value, true);
  game.emit({ type: "penny", value });
}

function updateBlogger(game: Game, city: CityState, dt: number) {
  for (const shop of city.shops) {
    if (shop.buzz <= 0) continue;
    shop.buzz -= dt;
    if (shop.buzz <= 0) {
      shop.buzz = 0;
      game.emit({ type: "buzz", shop: shop.id, state: "end" });
    }
  }
  if (game.state.tutorial < TUTORIAL_DONE) return;
  city.bloggerIn -= dt;
  if (city.bloggerIn > 0) return;
  city.bloggerIn = BLOGGER_EVERY.min + Math.random() * BLOGGER_EVERY.spread;
  const shop = city.shops[Math.floor(Math.random() * city.shops.length)];
  if (!shop || shop.shelves.length === 0) return;
  shop.buzz = BLOGGER_TIME;
  game.emit({ type: "buzz", shop: shop.id, state: "start" });
}

// ── the farm's van ──────────────────────────────────────────────────────
function updateVan(game: Game, shop: ShopState, dt: number) {
  const v = shop.van;
  const bay = shop.def.bay;
  switch (v.phase) {
    case "away":
      v.x = bay + VAN_FAR;
      v.t -= dt;
      if (v.t <= 0) {
        // Nothing ordered yet: the van has no reason to come.
        if (!game.state.machines.some((m) => m.type.supply && m.def.zone === shop.def.zone)) {
          v.t = 1;
          return;
        }
        v.phase = "arrive";
        v.t = 0;
      }
      return;
    case "arrive":
      v.t += dt / VAN_DRIVE;
      v.x = bay + VAN_FAR * (1 - easeInOutSine(Math.min(1, v.t)));
      if (v.t >= 1) {
        v.phase = "unload";
        v.t = 0;
        v.cd = 0.25;
        v.load = vanLoad(v.level);
      }
      return;
    case "unload":
      unload(game, shop, dt);
      return;
    case "leave":
      v.t += dt / VAN_DRIVE;
      v.x = bay - VAN_FAR * easeInOutSine(Math.min(1, v.t));
      if (v.t >= 1) {
        v.phase = "away";
        v.t = VAN_TRIP;
        v.x = bay + VAN_FAR;
      }
      return;
  }
}

function unload(game: Game, shop: ShopState, dt: number) {
  const v = shop.van;
  v.t += dt;
  v.cd -= dt;
  const cap = palletCapacity(v.level);
  while (v.cd <= 0 && v.load > 0) {
    // The emptiest pallet first, so every kind of goods keeps coming.
    let best = null;
    for (const m of game.state.machines) {
      if (!m.type.supply || m.def.zone !== shop.def.zone || m.output >= cap) continue;
      if (!best || m.output < best.output) best = m;
    }
    if (!best) {
      v.load = 0;
      break;
    }
    const slot = best.output;
    best.output++;
    best.incomingOut++;
    v.load--;
    game.flight(best.type.output.item, v.x + (Math.random() - 0.5) * 1.2, 1.1, v.z, { kind: "pileOut", machine: best.id, slot }, 0.36, 1.1);
    v.cd += VAN_UNLOAD_EVERY;
  }
  if (v.cd < 0) v.cd = 0;
  // Stops for a moment even with nothing to unload: vans do not just pass through.
  if (v.load <= 0 && v.t > 1.1) {
    v.phase = "leave";
    v.t = 0;
  }
}

// ── customers ───────────────────────────────────────────────────────────
function updateArrivals(game: Game, city: CityState, shop: ShopState, dt: number) {
  const st = game.state;
  if (shop.shelves.length === 0) return;
  // While learning, a customer comes when there is something to buy.
  if (st.tutorial < TUTORIAL_DONE) {
    const stocked = shop.shelves.some((s) => s.count - s.incoming > 0);
    if (!stocked || activeCustomers(city, shop.id) > 0) return;
  }
  shop.spawnT -= dt * customerRate(st, shop);
  if (shop.spawnT > 0) return;
  if (activeCustomers(city, shop.id) >= shopMaxCustomers(shop.ads, shop.tables.length)) {
    shop.spawnT = 0;
    return;
  }
  shop.spawnT = 0.75 + Math.random() * 0.5;
  spawn(game, city, shop);
}

function shoppingList(shop: ShopState): ItemId[] {
  const open = shop.shelves.filter((s) => s.spawnT > 0.5);
  if (open.length === 0) return [];
  const stocked = open.filter((s) => s.count - s.incoming > 0);
  const max = customerWants(shop.level);
  const n = 1 + Math.floor(Math.random() * max);
  const list: ItemId[] = [];
  for (let i = 0; i < n; i++) {
    // Most people want what they can see on the counter.
    const from = stocked.length > 0 && Math.random() < 0.8 ? stocked : open;
    list.push(from[Math.floor(Math.random() * from.length)].def.item);
  }
  return list;
}

function spawn(game: Game, city: CityState, shop: ShopState) {
  const c = city.customers.find((x) => x.cphase === "none");
  if (!c) return;
  const want = shoppingList(shop);
  if (want.length === 0) return;
  const door = shop.def.doors[Math.floor(Math.random() * shop.def.doors.length)];
  c.shop = shop.id;
  c.x = door.x;
  c.z = door.z;
  c.vx = 0;
  c.vz = 0;
  c.moving = false;
  c.scale = 0;
  c.stack.length = 0;
  c.incoming = 0;
  c.want = want;
  c.bill = 0;
  c.bag = false;
  c.dish = null;
  c.seat = null;
  c.path = [];
  c.pathIdx = 0;
  c.cphase = "enter";
}

function goTo(game: Game, c: Customer, x: number, z: number) {
  c.path = game.nav.findPath(c.x, c.z, x, z) ?? [{ x, z }];
  c.pathIdx = 0;
}

/** Follows the path; true once there. Customers never get pushed around. */
function walk(c: Customer, dt: number) {
  if (c.pathIdx >= c.path.length) {
    stand(c, dt);
    return true;
  }
  const p = c.path[c.pathIdx];
  const dx = p.x - c.x;
  const dz = p.z - c.z;
  const d = Math.hypot(dx, dz);
  const step = c.speed * dt;
  if (d <= step) {
    c.x = p.x;
    c.z = p.z;
    c.walk += d * 2.3;
    c.pathIdx++;
  } else {
    c.x += (dx / d) * step;
    c.z += (dz / d) * step;
    c.walk += step * 2.3;
  }
  if (d > 0.01) {
    const k = dampFactor(16, dt);
    c.vx += ((dx / d) * c.speed - c.vx) * k;
    c.vz += ((dz / d) * c.speed - c.vz) * k;
    c.facing = dampAngle(c.facing, Math.atan2(dx, dz), 10, dt);
  }
  c.moving = true;
  updateLean(c, dt);
  return c.pathIdx >= c.path.length;
}

function stand(c: Actor, dt: number) {
  const k = dampFactor(16, dt);
  c.vx -= c.vx * k;
  c.vz -= c.vz * k;
  c.moving = false;
  updateLean(c, dt);
}

const shopOf = (game: Game, c: Customer) => game.state.city!.shops.find((s) => s.id === c.shop)!;
const shelfFor = (shop: ShopState, item: ItemId): ShelfState | undefined => shop.shelves.find((s) => s.def.item === item);

function nextOnList(game: Game, c: Customer) {
  const shop = shopOf(game, c);
  while (c.want.length > 0) {
    const shelf = shelfFor(shop, c.want[0]);
    if (shelf) {
      const spot = shelf.def.front[Math.floor(Math.random() * shelf.def.front.length)];
      goTo(game, c, spot.x, spot.z);
      c.cphase = "toShelf";
      return;
    }
    c.want.shift();
  }
  if (c.stack.length > 0) joinQueue(game, shop, c);
  else leave(game, c, true);
}

function joinQueue(game: Game, shop: ShopState, c: Customer) {
  const place = shop.queue.length;
  shop.queue.push(c);
  const slot = queueSlot(shop, place);
  goTo(game, c, slot.x, slot.z);
  c.cphase = "toQueue";
}

function leave(game: Game, c: Customer, sad = false) {
  const shop = shopOf(game, c);
  const door = shop.def.doors[Math.floor(Math.random() * shop.def.doors.length)];
  goTo(game, c, door.x, door.z);
  c.cphase = "leave";
  if (sad) game.emit({ type: "sad", x: c.x, z: c.z });
}

function updateCustomer(game: Game, c: Customer, dt: number) {
  c.fullT += dt;
  switch (c.cphase) {
    case "enter":
      c.scale = Math.min(1, c.scale + dt * 3);
      stand(c, dt);
      if (c.scale >= 1) nextOnList(game, c);
      return;
    case "toShelf":
      if (walk(c, dt)) {
        c.cphase = "pick";
        c.t = 0.35 + Math.random() * 0.4;
        c.patience = CUSTOMER_PATIENCE;
      }
      return;
    case "pick":
      pick(game, c, dt);
      return;
    case "toQueue":
      if (walk(c, dt)) c.cphase = "queue";
      return;
    case "queue":
      walk(c, dt);
      if (c.pathIdx >= c.path.length) c.facing = dampAngle(c.facing, Math.PI, 8, dt);
      return;
    case "toTable":
      if (walk(c, dt) && c.seat) {
        c.cphase = "eat";
        c.t = TABLE_EAT_TIME * (0.8 + Math.random() * 0.4);
      }
      return;
    case "eat":
      eat(game, c, dt);
      return;
    case "leave":
      if (walk(c, dt)) c.cphase = "out";
      return;
    case "out":
      c.scale = Math.max(0, c.scale - dt * 3);
      stand(c, dt);
      if (c.scale <= 0) {
        c.cphase = "none";
        c.shop = null;
      }
      return;
  }
}

function pick(game: Game, c: Customer, dt: number) {
  stand(c, dt);
  c.facing = dampAngle(c.facing, Math.PI, 8, dt);
  c.t -= dt;
  if (c.t > 0) return;
  const shop = shopOf(game, c);
  const item = c.want[0];
  const shelf = item ? shelfFor(shop, item) : undefined;
  if (shelf && shelf.count - shelf.incoming > 0) {
    const from = shelfSlot(shelf.def, shelf.count - 1);
    shelf.count--;
    c.bill += cityPrice(game, shop, item);
    game.giveToActor(c, item, from.x, from.y, from.z, 0.3);
    c.want.shift();
    nextOnList(game, c);
    return;
  }
  c.patience -= dt;
  if (c.patience > 0) return;
  // Gave up on this one.
  c.want.shift();
  nextOnList(game, c);
}

function eat(game: Game, c: Customer, dt: number) {
  stand(c, dt);
  const seat = c.seat;
  if (!seat) {
    leave(game, c);
    return;
  }
  const t = seat.table.def;
  c.facing = dampAngle(c.facing, Math.atan2(t.x - c.x, t.z - c.z), 8, dt);
  c.t -= dt;
  if (c.t > 0) return;
  const shop = shopOf(game, c);
  const mult = game.state.season === "autumn" ? AUTUMN_TIP_MULT : 1;
  const tip = c.bill * TABLE_TIP * mult;
  addCash(game, shop, tip, t.x, 0.9, t.z);
  game.emit({ type: "tip", value: tip, x: t.x, z: t.z });
  seat.table.seats[seat.seat] = null;
  c.seat = null;
  c.dish = null;
  leave(game, c);
}

// ── the till ────────────────────────────────────────────────────────────
function updateTill(game: Game, shop: ShopState, dt: number) {
  const head = shop.queue[0];
  if (!head || head.cphase !== "queue" || head.pathIdx < head.path.length) {
    shop.serveT = 0;
    return;
  }
  const atTill = game.state.player.zoneId === `till:${shop.id}`;
  if (!atTill && !shop.cashier) return;
  const time = atTill ? PLAYER_SERVE : cashierServe(shop.level);
  shop.serveT += dt;
  if (shop.serveT < time || head.incoming > 0) return;
  shop.serveT = 0;
  finishServe(game, shop, head);
}

function finishServe(game: Game, shop: ShopState, c: Customer) {
  const st = game.state;
  const r = shop.def.register;
  const n = c.stack.length;
  const local = stackSlotLocal(c.stack, c.capacity, 0);
  for (const item of c.stack) {
    game.flight(item, c.x, local.y, c.z, { kind: "point", x: r.x + (Math.random() - 0.5) * 0.6, y: 1.05, z: r.z }, 0.26, 1.0);
  }
  const dish = c.stack[n - 1] ?? null;
  c.stack.length = 0;
  c.incoming = 0;
  const value = c.bill;
  addCash(game, shop, value, r.x, 1.1, r.z);
  st.stats.sold += n;
  st.stats.served++;
  shop.pulse = 1;
  game.emit({ type: "served", shop: shop.id, value, x: r.x, z: r.z });

  shop.queue.shift();
  shop.queue.forEach((q, i) => {
    const slot = queueSlot(shop, i);
    goTo(game, q, slot.x, slot.z);
  });

  c.bag = true;
  const table = freeSeat(shop);
  if (table) {
    table.table.seats[table.seat] = c;
    c.seat = table;
    c.dish = dish;
    const spot = table.table.def.seats[table.seat];
    goTo(game, c, spot.x, spot.z);
    c.cphase = "toTable";
  } else {
    leave(game, c);
  }
}

function freeSeat(shop: ShopState): { table: TableState; seat: 0 | 1 } | null {
  for (const table of shop.tables) {
    if (table.spawnT < 0.5) continue;
    if (!table.seats[0]) return { table, seat: 0 };
    if (!table.seats[1]) return { table, seat: 1 };
  }
  return null;
}

/** Money lands on the table; many small bills become a few thick bundles. */
export function addCash(game: Game, shop: ShopState, value: number, fx: number, fy: number, fz: number) {
  if (value <= 0) return;
  shop.cash += value;
  if (shop.bundles >= CASH_BUNDLES_MAX) return;
  const slot = shop.bundles;
  shop.bundles++;
  shop.incomingCash++;
  game.flight("cash", fx, fy, fz, { kind: "cash", shop: shop.id, slot }, 0.34, 1.2);
}

// ── what actors do in the city's zones (see systems/interact.ts) ────────
/** Index of the top-most landed item matching `pred`, or -1. */
function topMatching(a: Actor, pred: (item: ItemId) => boolean) {
  const landed = a.stack.length - a.incoming;
  for (let i = landed - 1; i >= 0; i--) if (pred(a.stack[i])) return i;
  return -1;
}

export function shelfAccepts(shop: ShopState, shelf: ShelfState, overfill: boolean) {
  const cap = shelfCapacity(shop.level);
  return shelf.count < (overfill ? cap * 1.5 : cap);
}

export function dropOnShelf(game: Game, a: Actor, shelf: ShelfState, isPlayer: boolean) {
  if (shelf.spawnT < 0.5) return false;
  const shop = game.state.city!.shops.find((s) => s.id === shelf.def.shop)!;
  if (!shelfAccepts(shop, shelf, isPlayer)) return false;
  const i = topMatching(a, (item) => item === shelf.def.item);
  if (i < 0) return false;
  const item = a.stack[i];
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  const slot = shelf.count;
  shelf.count++;
  shelf.incoming++;
  game.flight(item, from.x, from.y, from.z, { kind: "shelf", shelf: shelf.id, slot }, 0.3, 1.0);
  game.emit({ type: "drop", item, player: isPlayer, x: shelf.def.box.x, z: shelf.def.box.z });
  return true;
}

/** One bundle of money from the table to whoever stands on it. */
export function collectCash(game: Game, a: Actor, shop: ShopState, isPlayer: boolean) {
  const landed = shop.bundles - shop.incomingCash;
  if (landed <= 0) return false;
  const value = shop.cash / shop.bundles;
  shop.cash -= value;
  shop.bundles--;
  if (shop.bundles === 0) shop.cash = 0;
  game.earn(value, !isPlayer);
  const from = cashSlot(shop, landed - 1);
  game.flight("cash", from.x, from.y, from.z, { kind: "actor", actor: a.id }, 0.26, 1.0, { type: "saleLand", value, x: a.x, y: 1.5, z: a.z });
  return true;
}

/** Couriers take the top item off the stack and ride away with it. */
export function handToCourier(game: Game, a: Actor, shop: ShopState, isPlayer: boolean) {
  const box = shop.def.delivery;
  if (!box || !shop.delivery) return false;
  const i = topMatching(a, isSellable);
  if (i < 0) return false;
  const item = a.stack[i];
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  const value = cityPrice(game, shop, item) * DELIVERY_MULT;
  game.earn(value, !isPlayer);
  game.state.stats.sold++;
  game.state.stats.delivered++;
  game.flight(item, from.x, from.y, from.z, { kind: "point", x: box.x, y: 0.9, z: box.z + box.d / 2 + 0.5 }, 0.3, 1.2, { type: "delivered", value, x: box.x, z: box.z });
  game.emit({ type: "drop", item, player: isPlayer, x: box.x, z: box.z });
  return true;
}

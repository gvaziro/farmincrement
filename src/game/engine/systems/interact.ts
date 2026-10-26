import { pointInRect } from "../../core/math";
import {
  DEPOT_STORAGE,
  PAD_DELAY,
  PAD_MAX_SPEED,
  PAD_FILL_TIME,
  PAD_TICK,
  PLAYER_OVERFILL,
  WORKER_TRANSFER_INTERVAL,
  machineCapacity,
  transferInterval,
} from "../../data/balance";
import { ITEMS, isSellable, type ItemId } from "../../data/items";
import { DEPOT, MARKET, TRASH } from "../../data/layout";
import { MERCHANT_MULT } from "../../data/surprises";
import { inputSlot, outputSlot, pileSlot } from "../anchors";
import type { Game } from "../Game";
import { countOrderSale } from "./orders";
import type { Actor, InteractZone, Machine } from "../types";

/** Index of the top-most landed item matching `pred`, or -1. */
function topIndex(a: Actor, pred: (item: ItemId) => boolean) {
  const landed = a.stack.length - a.incoming;
  for (let i = landed - 1; i >= 0; i--) if (pred(a.stack[i])) return i;
  return -1;
}

export function updateInteractions(game: Game, dt: number) {
  const st = game.state;
  const p = st.player;

  let zone: InteractZone | null = null;
  for (const z of st.interact) {
    if (pointInRect(p.x, p.z, z.rect)) {
      zone = z;
      break;
    }
  }
  const zid = zone?.id ?? null;
  if (zid !== p.zoneId) {
    p.zoneId = zid;
    p.zoneTime = 0;
    p.transferCd = zone?.kind === "pad" ? PAD_DELAY : 0.05;
    game.emit({ type: "zone", kind: zone?.kind ?? null, ref: zone?.ref ?? null });
  } else {
    p.zoneTime += dt;
  }
  if (zone) processZone(game, p, zone, dt, true);

  for (const w of st.workers) {
    if (!w.targetZone) continue;
    const z = game.interactById(w.targetZone);
    if (!z || !pointInRect(w.x, w.z, z.rect, 0.15)) {
      w.zoneId = null;
      continue;
    }
    if (w.zoneId !== z.id) {
      w.zoneId = z.id;
      w.zoneTime = 0;
      w.transferCd = 0.1;
    } else w.zoneTime += dt;
    processZone(game, w, z, dt, false);
  }
}

function processZone(game: Game, a: Actor, zone: InteractZone, dt: number, isPlayer: boolean) {
  if (zone.kind === "pad") {
    // Pads only take money while you stand (almost) still — running across
    // one on the way somewhere must not spend anything.
    if (Math.hypot(a.vx, a.vz) > PAD_MAX_SPEED) {
      a.transferCd = Math.max(a.transferCd, PAD_DELAY);
      return;
    }
    a.transferCd -= dt;
    if (a.transferCd > 0) return;
    if (isPlayer) payPad(game, zone.ref);
    return;
  }
  a.transferCd -= dt;
  if (a.transferCd > 0) return;
  if (zone.kind === "farmhouse") return;

  const interval = isPlayer ? transferInterval(a.zoneTime) : WORKER_TRANSFER_INTERVAL;
  for (let guard = 0; guard < 4 && a.transferCd <= 0; guard++) {
    let ok = false;
    switch (zone.kind) {
      case "machineIn":
        ok = dropIntoMachine(game, a, game.machine(zone.ref)!, isPlayer);
        break;
      case "machineOut":
        ok = pickFromMachine(game, a, game.machine(zone.ref)!, isPlayer);
        break;
      case "market":
        ok = sellAtMarket(game, a, isPlayer);
        break;
      case "depot":
        ok = dropIntoDepot(game, a, isPlayer);
        break;
      case "trash":
        ok = isPlayer && dropIntoTrash(game, a, isPlayer);
        break;
      case "merchant":
        ok = isPlayer && giveToMerchant(game, a);
        break;
    }
    if (!ok) {
      a.transferCd = 0;
      return;
    }
    a.transferCd += interval;
  }
}

/**
 * Whether the machine takes one more `item`. The player may overfill the
 * input pallet by half — otherwise a full stack of raw goods in front of a
 * full machine would leave them with nothing to do.
 */
export function machineAccepts(m: Machine, item: ItemId, overfill = false) {
  if (!m.type.inputs.some((i) => i.item === item)) return false;
  const cap = machineCapacity(m.level) * (overfill ? PLAYER_OVERFILL : 1);
  return (m.inputs[item] ?? 0) < cap;
}

function dropIntoMachine(game: Game, a: Actor, m: Machine, isPlayer: boolean) {
  if (m.spawnT < 0.5) return false;
  const i = topIndex(a, (item) => machineAccepts(m, item, isPlayer));
  if (i < 0) return false;
  const item = a.stack[i];
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  const n = m.inputs[item] ?? 0;
  m.inputs[item] = n + 1;
  m.incomingIn[item] = (m.incomingIn[item] ?? 0) + 1;
  m.pulse = 1;
  const to = inputSlot(m, item, n);
  game.flight(item, from.x, from.y, from.z, { kind: "pileIn", machine: m.id, item, slot: n }, 0.32, 1.1);
  game.emit({ type: "drop", item, player: isPlayer, x: to.x, z: to.z });
  return true;
}

function pickFromMachine(game: Game, a: Actor, m: Machine, isPlayer: boolean) {
  if (m.output - m.incomingOut <= 0) return false;
  if (a.stack.length >= a.capacity) {
    if (isPlayer && a.fullT > 0.8) game.emit({ type: "full", actor: a.id });
    a.fullT = 0;
    return false;
  }
  const item = m.type.output.item;
  m.output--;
  const from = outputSlot(m, m.output);
  game.giveToActor(a, item, from.x, from.y + ITEMS[item].height / 2, from.z, 0.3);
  game.emit({ type: "pick", item, player: isPlayer, x: from.x, z: from.z });
  return true;
}

function sellAtMarket(game: Game, a: Actor, isPlayer: boolean) {
  const i = topIndex(a, isSellable);
  if (i < 0) return false;
  const item = a.stack[i];
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  const value = game.salePrice(item);
  game.earn(value, !isPlayer);
  game.state.stats.sold++;
  const tx = MARKET.x + (Math.random() - 0.5) * 2.4;
  const tz = MARKET.z + 0.6;
  game.flight(item, from.x, from.y, from.z, { kind: "point", x: tx, y: 1.15, z: tz }, 0.34, 1.3, {
    type: "saleLand",
    value,
    x: tx,
    y: 1.3,
    z: tz,
  });
  game.emit({ type: "sell", item, value, player: isPlayer });
  if (isPlayer) countOrderSale(game, item);
  return true;
}

function dropIntoDepot(game: Game, a: Actor, isPlayer: boolean) {
  const d = game.state.depot;
  if (!d || d.storage.length >= DEPOT_STORAGE) return false;
  const i = topIndex(a, isSellable);
  if (i < 0) return false;
  const item = a.stack[i];
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  const slot = d.storage.length;
  d.storage.push(item);
  d.incoming++;
  game.flight(item, from.x, from.y, from.z, { kind: "depot", slot }, 0.32, 1.1);
  game.emit({ type: "drop", item, player: isPlayer, x: DEPOT.input.x, z: DEPOT.input.z });
  return true;
}

/** The travelling merchant takes only his goods, at a premium, until he has enough. */
function giveToMerchant(game: Game, a: Actor) {
  const st = game.state;
  const m = st.surprises.merchant;
  if (!m || m.phase !== "wait") return false;
  const i = topIndex(a, (item) => item === m.item);
  if (i < 0) return false;
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  // The merchant pays his own price: "Скупой рынок" is about the market.
  const value = game.sellValue(m.item) * game.rushMult() * MERCHANT_MULT;
  game.earn(value, false);
  st.stats.sold++;
  m.have++;
  m.earned += value;
  const tx = m.x + (Math.random() - 0.5) * 1.2;
  game.flight(m.item, from.x, from.y, from.z, { kind: "point", x: tx, y: 1.15, z: m.z }, 0.34, 1.3, { type: "saleLand", value, x: tx, y: 1.4, z: m.z });
  game.emit({ type: "sell", item: m.item, value, player: true });
  if (m.have >= m.need) {
    m.phase = "leave";
    st.stats.merchants++;
    game.emit({ type: "merchant", state: "done", x: m.x, z: m.z, item: m.item, need: m.need, earned: m.earned });
  }
  return true;
}

/** Compost bin: throws away the top item. Escape hatch for unwanted goods. */
function dropIntoTrash(game: Game, a: Actor, isPlayer: boolean) {
  const i = topIndex(a, () => true);
  if (i < 0) return false;
  const item = a.stack[i];
  const from = game.stackSlotWorld(a, i);
  a.stack.splice(i, 1);
  game.flight(item, from.x, from.y, from.z, { kind: "point", x: TRASH.x, y: 0.7, z: TRASH.z - TRASH.d / 2 - 0.35 }, 0.3, 1.2, {
    type: "trashed",
    item,
    x: TRASH.x,
    z: TRASH.z - TRASH.d / 2 - 0.35,
  });
  game.emit({ type: "drop", item, player: isPlayer, x: TRASH.x, z: TRASH.z });
  return true;
}

/** Depot piles show at most this many crates; the rest is "inside". */
export const DEPOT_VISIBLE = 48;
export const depotSlot = (slot: number) =>
  pileSlot(
    { x: DEPOT.input.x, z: DEPOT.input.z - 0.1, hw: DEPOT.input.w / 2, hd: DEPOT.input.d / 2 },
    Math.min(slot, DEPOT_VISIBLE - 1),
    0.3,
  );

function payPad(game: Game, padId: string) {
  const st = game.state;
  const pad = game.pad(padId);
  if (!pad || !pad.visible || pad.done) return;
  const cost = game.padCost(pad);
  if (cost === null) return;
  const p = st.player;
  // Already fully paid (e.g. rounding in an old save): just finish it.
  if (pad.paid >= cost - 0.0001) {
    game.completePad(pad);
    p.transferCd = 0.5;
    return;
  }
  const step = Math.max(1, Math.ceil((cost * PAD_TICK) / PAD_FILL_TIME));
  for (let guard = 0; guard < 6 && p.transferCd <= 0; guard++) {
    const remaining = cost - pad.paid;
    const amount = Math.min(step, remaining, st.money);
    if (amount <= 0.0001) {
      p.transferCd = 0;
      return;
    }
    st.money -= amount;
    pad.paid += amount;
    game.flight("coin", p.x, 1.4, p.z, { kind: "point", x: pad.def.x, y: 0.1, z: pad.def.z }, 0.28, 1.2);
    game.emit({ type: "padTick", pad: pad.id, x: pad.def.x, z: pad.def.z });
    if (pad.paid >= cost - 0.0001) {
      game.completePad(pad);
      p.transferCd = 0.5;
      return;
    }
    p.transferCd += PAD_TICK;
  }
}

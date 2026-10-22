/**
 * Warehouse + delivery trucks. Goods dropped at the depot are stored; a truck
 * drives in along the road, loads up, drives off and pays DEPOT_BONUS × price.
 */
import { easeInOutSine } from "../../core/math";
import { DEPOT_BONUS, TRUCK_TRIP_TIME, truckCapacity } from "../../data/balance";
import { ITEMS } from "../../data/items";
import { DEPOT } from "../../data/layout";
import type { Game } from "../Game";
import type { Truck } from "../types";
import { DEPOT_VISIBLE, depotSlot } from "./interact";

export const TRUCK_FAR_X = 60;
const DRIVE_TIME = 3.2;
const LOAD_INTERVAL = 0.09;

export function truckDockX(index: number) {
  return DEPOT.dock.x + index * 5.4;
}

/** Truck bed slot (local, relative to truck origin; truck faces −x when arriving). */
export function truckSlot(t: Truck, slot: number) {
  const cols = 3;
  const rows = 2;
  const per = cols * rows;
  const layer = Math.floor(slot / per);
  const k = slot % per;
  return {
    x: t.x + 0.55 + (k % cols) * 0.5,
    y: 0.8 + layer * 0.3,
    z: t.z + (Math.floor(k / cols) - 0.5) * 0.5,
  };
}

export function updateDepot(game: Game, dt: number) {
  const d = game.state.depot;
  if (!d) return;
  const cap = truckCapacity(d.truckLevel);
  d.trucks.forEach((t, index) => {
    const dock = truckDockX(index);
    switch (t.phase) {
      case "away":
        t.t -= dt;
        t.x = TRUCK_FAR_X;
        if (t.t <= 0) {
          t.phase = "arrive";
          t.t = 0;
        }
        break;
      case "arrive":
        t.t += dt / DRIVE_TIME;
        t.x = TRUCK_FAR_X + (dock - TRUCK_FAR_X) * easeInOutSine(Math.min(1, t.t));
        if (t.t >= 1) {
          t.phase = "load";
          t.wait = 0;
          t.loadCd = 0;
        }
        break;
      case "load": {
        t.loadCd -= dt;
        const landed = d.storage.length - d.incoming;
        if (t.cargo.length < cap && landed > 0) {
          t.wait = 0;
          while (t.loadCd <= 0 && t.cargo.length < cap && d.storage.length - d.incoming > 0) {
            // Load the most valuable goods first.
            let best = 0;
            for (let i = 1; i < d.storage.length - d.incoming; i++) {
              if (ITEMS[d.storage[i]].price > ITEMS[d.storage[best]].price) best = i;
            }
            const item = d.storage[best];
            const top = d.storage.length - 1;
            const from = depotSlot(Math.min(top, DEPOT_VISIBLE - 1));
            d.storage.splice(best, 1);
            const slot = t.cargo.length;
            t.cargo.push(item);
            t.incoming++;
            game.flight(item, from.x, from.y + 0.15, from.z, { kind: "truck", truck: t.id, slot }, 0.4, 1.4);
            t.loadCd += LOAD_INTERVAL;
          }
        } else {
          t.wait += dt;
        }
        if (t.loadCd < 0) t.loadCd = 0;
        const full = t.cargo.length >= cap;
        if (t.incoming === 0 && t.cargo.length > 0 && (full || t.wait > 2.5)) {
          let value = 0;
          for (const it of t.cargo) value += game.sellValue(it) * DEPOT_BONUS;
          game.earn(value, true);
          game.state.stats.sold += t.cargo.length;
          game.emit({ type: "truckSold", value, x: t.x, z: t.z });
          t.phase = "leave";
          t.t = 0;
        }
        break;
      }
      case "leave":
        t.t += dt / DRIVE_TIME;
        t.x = dock + (TRUCK_FAR_X - dock) * easeInOutSine(Math.min(1, t.t));
        if (t.t >= 1) {
          t.cargo.length = 0;
          t.incoming = 0;
          t.phase = "away";
          t.t = TRUCK_TRIP_TIME;
        }
        break;
    }
  });
}

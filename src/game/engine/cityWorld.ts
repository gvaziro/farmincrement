/**
 * Derived city data: walkable land, colliders and interaction zones. A leaf of
 * the module graph so that world.ts can use it without a cycle.
 */
import { rect, type Rect } from "../core/math";
import { CITY_BUS_STOP, CITY_OFFICE, FACADE, FOUNTAIN, TOWER, type Box } from "../data/city";
import { CITY_ZONES, MERCHANT_CART, ZONE_D, ZONE_W, type ZoneId } from "../data/layout";
import type { GameState, InteractZone } from "./types";

const zoneKey = (gx: number, gz: number) => `${gx},${gz}`;
const ZONE_BY_GRID = new Map(CITY_ZONES.map((z) => [zoneKey(z.gx, z.gz), z.id]));

export function cityZoneIdAt(x: number, z: number): ZoneId | undefined {
  return ZONE_BY_GRID.get(zoneKey(Math.round(x / ZONE_W), Math.round(z / ZONE_D)));
}

export const boxRect = (b: Box) => rect(b.x, b.z, b.w, b.d);

export function cityObstacles(state: GameState): Rect[] {
  const city = state.city!;
  const obs: Rect[] = state.machines.filter((m) => !m.type.supply).map((m) => m.body);
  obs.push(rect(CITY_OFFICE.x, CITY_OFFICE.z, CITY_OFFICE.w, CITY_OFFICE.d));
  for (const s of city.shops) {
    obs.push(rect(s.def.cx, s.def.cz + FACADE.dz, FACADE.w, FACADE.d));
    obs.push(boxRect(s.def.register));
    for (const sh of s.shelves) obs.push(boxRect(sh.def.box));
    for (const t of s.tables) obs.push(rect(t.def.x, t.def.z, 0.9, 0.9));
  }
  if (state.zones.has("c_tower")) obs.push(rect(TOWER.x, TOWER.z, TOWER.w, TOWER.d));
  if (state.zones.has("c_park")) obs.push(rect(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.w, FOUNTAIN.d));
  const merchant = state.surprises.merchant;
  if (merchant) obs.push(rect(merchant.x, merchant.z, MERCHANT_CART.w, MERCHANT_CART.d));
  return obs;
}

export function cityInteract(state: GameState): InteractZone[] {
  const city = state.city!;
  const zones: InteractZone[] = [];
  for (const m of state.machines) {
    if (!m.type.supply) zones.push({ id: `in:${m.id}`, kind: "machineIn", ref: m.id, rect: m.inRect });
    zones.push({ id: `out:${m.id}`, kind: "machineOut", ref: m.id, rect: m.outRect });
  }
  for (const s of city.shops) {
    zones.push({ id: `till:${s.id}`, kind: "till", ref: s.id, rect: boxRect(s.def.till) });
    zones.push({ id: `cash:${s.id}`, kind: "cash", ref: s.id, rect: boxRect(s.def.cash) });
    zones.push({ id: `bin:${s.id}`, kind: "trash", ref: s.id, rect: boxRect(s.def.bin) });
    if (s.delivery && s.def.delivery) zones.push({ id: `delivery:${s.id}`, kind: "delivery", ref: s.id, rect: boxRect(s.def.delivery) });
    for (const sh of s.shelves) zones.push({ id: `shelf:${sh.id}`, kind: "shelf", ref: sh.id, rect: boxRect(sh.def.staff) });
  }
  zones.push({ id: "farmhouse", kind: "farmhouse", ref: "farmhouse", rect: rect(CITY_OFFICE.door.x, CITY_OFFICE.door.z, CITY_OFFICE.door.w, CITY_OFFICE.door.d) });
  zones.push({ id: "bus", kind: "bus", ref: "bus", rect: boxRect(CITY_BUS_STOP) });
  const merchant = state.surprises.merchant;
  if (merchant) {
    const drop = MERCHANT_CART.drop;
    zones.push({ id: "merchant", kind: "merchant", ref: "merchant", rect: rect(merchant.x, merchant.z + drop.dz, drop.w, drop.d) });
  }
  for (const p of state.pads) {
    if (p.visible) zones.push({ id: `pad:${p.id}`, kind: "pad", ref: p.id, rect: rect(p.def.x, p.def.z, p.def.size, p.def.size) });
  }
  return zones;
}

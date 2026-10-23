/**
 * The whole farm as static data. The runtime world is this layout filtered by
 * the set of completed pads — so a save only needs pad progress and levels.
 *
 * Coordinates: x → east (right on screen), z → south (towards the camera).
 * The map is a grid of land plots, 3 wide and 4 deep (the northern row came
 * with the seasons update), each ZONE_W × ZONE_D metres.
 */
import { CROPS, type CropId } from "./crops";
import { MACHINE_TYPES, type MachineTypeId } from "./machines";

export const ZONE_W = 26;
export const ZONE_D = 22;

export type ZoneId = "farm" | "coop" | "pasture" | "depot" | "orchard" | "garden" | "sweets" | "pond" | "apiary" | "sheep" | "berries" | "pumpkins";

export interface ZoneDef {
  id: ZoneId;
  name: string;
  icon: string;
  gx: number;
  gz: number;
  /** Fields unlocked for free together with the land. */
  includes: string[];
  /** Ground tint for the plot. */
  tint: string;
  /** What grows on the plot while it is locked (forest gets cleared on purchase). */
  wild?: "bushes" | "forest";
}

export const ZONES: ZoneDef[] = [
  { id: "farm", name: "Ферма", icon: "🏡", gx: 0, gz: 0, includes: ["wheat_1"], tint: "#7ccf5a" },
  { id: "coop", name: "Курятник", icon: "🐔", gx: 0, gz: -1, includes: ["corn_1"], tint: "#86d35e" },
  { id: "pasture", name: "Пастбище", icon: "🐄", gx: 1, gz: 0, includes: ["grass_1"], tint: "#79cc58" },
  { id: "depot", name: "Склад", icon: "🚚", gx: 1, gz: 1, includes: [], tint: "#83cf5d" },
  { id: "orchard", name: "Сад", icon: "🍎", gx: 0, gz: 1, includes: ["apple_1"], tint: "#7fd05b" },
  { id: "garden", name: "Огород", icon: "🍅", gx: -1, gz: 0, includes: ["tomato_1"], tint: "#81cd5a" },
  { id: "sweets", name: "Кондитерская", icon: "🎂", gx: 1, gz: -1, includes: ["wheat_4"], tint: "#88d460" },
  { id: "pond", name: "Пруд", icon: "🎣", gx: -1, gz: 1, includes: ["fish_1"], tint: "#7dce5c" },
  { id: "apiary", name: "Пасека", icon: "🐝", gx: -1, gz: -1, includes: ["flowers_1"], tint: "#8ad662", wild: "forest" },
  // The northern row.
  { id: "sheep", name: "Овчарня", icon: "🐑", gx: -1, gz: -2, includes: ["grass_3"], tint: "#84d15e", wild: "forest" },
  { id: "berries", name: "Ягодник", icon: "🍓", gx: 0, gz: -2, includes: ["berries_1"], tint: "#80cf5b" },
  { id: "pumpkins", name: "Тыквенное поле", icon: "🎃", gx: 1, gz: -2, includes: ["pumpkins_1"], tint: "#86d25f" },
];

export const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;
export const zoneCenter = (z: { gx: number; gz: number }) => ({ x: z.gx * ZONE_W, z: z.gz * ZONE_D });
export const zoneRect = (z: { gx: number; gz: number }) => ({
  x: z.gx * ZONE_W,
  z: z.gz * ZONE_D,
  hw: ZONE_W / 2,
  hd: ZONE_D / 2,
});

/** Map extents: the grid of plots. */
export const MAP_BOUNDS = {
  minX: (Math.min(...ZONES.map((z) => z.gx)) - 0.5) * ZONE_W,
  maxX: (Math.max(...ZONES.map((z) => z.gx)) + 0.5) * ZONE_W,
  minZ: (Math.min(...ZONES.map((z) => z.gz)) - 0.5) * ZONE_D,
  maxZ: (Math.max(...ZONES.map((z) => z.gz)) + 0.5) * ZONE_D,
};

// ── fields ──────────────────────────────────────────────────────────────
export interface FieldDef {
  id: string;
  crop: CropId;
  zone: ZoneId;
  x: number;
  z: number;
  cols: number;
  rows: number;
  /** Row spacing if it differs from the crop spacing (fishing spots around the pier). */
  rowSpacing?: number;
  /**
   * Where a worker stands to reach a spot (water fields): a fixed x and/or z,
   * or an offset from the spot. Defaults to the spot itself.
   */
  stand?: { x?: number; z?: number; dx?: number; dz?: number };
}

/** Stand point for a spot of a field (see FieldDef.stand). */
export function standPoint(f: FieldDef, x: number, z: number) {
  const s = f.stand;
  if (!s) return { x, z };
  return { x: s.x ?? x + (s.dx ?? 0), z: s.z ?? z + (s.dz ?? 0) };
}

export const FIELDS: FieldDef[] = [
  { id: "wheat_1", crop: "wheat", zone: "farm", x: -8, z: 0.6, cols: 5, rows: 5 },
  { id: "wheat_2", crop: "wheat", zone: "farm", x: -8, z: 7, cols: 5, rows: 5 },
  { id: "wheat_3", crop: "wheat", zone: "farm", x: -1.6, z: 6.2, cols: 5, rows: 5 },
  { id: "corn_1", crop: "corn", zone: "coop", x: -8, z: -16.4, cols: 5, rows: 4 },
  { id: "corn_2", crop: "corn", zone: "coop", x: -8, z: -23.4, cols: 5, rows: 4 },
  { id: "grass_1", crop: "grass", zone: "pasture", x: 19, z: 5.4, cols: 5, rows: 5 },
  { id: "grass_2", crop: "grass", zone: "pasture", x: 19, z: -2.2, cols: 5, rows: 5 },
  { id: "apple_1", crop: "apple", zone: "orchard", x: -7, z: 16.8, cols: 3, rows: 2 },
  { id: "apple_2", crop: "apple", zone: "orchard", x: -7, z: 24.2, cols: 3, rows: 2 },
  { id: "tomato_1", crop: "tomato", zone: "garden", x: -19, z: 4, cols: 5, rows: 4 },
  { id: "tomato_2", crop: "tomato", zone: "garden", x: -19, z: -3.6, cols: 5, rows: 4 },
  { id: "wheat_4", crop: "wheat", zone: "sweets", x: 19.5, z: -16.5, cols: 5, rows: 4 },
  // Pond: fishing spots along the east shore and on both sides of the pier.
  { id: "fish_1", crop: "fish", zone: "pond", x: -28.4, z: 16.6, cols: 1, rows: 4, rowSpacing: 1.8, stand: { x: -26.2 } },
  { id: "fish_2", crop: "fish", zone: "pond", x: -30.9, z: 22, cols: 3, rows: 2, rowSpacing: 3.6, stand: { z: 22 } },
  { id: "fish_3", crop: "fish", zone: "pond", x: -28.4, z: 27, cols: 1, rows: 3, rowSpacing: 1.8, stand: { x: -26.2 } },
  // Apiary: flower meadows in the forest clearing.
  { id: "flowers_1", crop: "flowers", zone: "apiary", x: -19.5, z: -17, cols: 5, rows: 4 },
  { id: "flowers_2", crop: "flowers", zone: "apiary", x: -19.5, z: -24, cols: 5, rows: 4 },
  // Sheep farm: meadows east of the pens.
  { id: "grass_3", crop: "grass", zone: "sheep", x: -19.5, z: -38.6, cols: 5, rows: 5 },
  { id: "grass_4", crop: "grass", zone: "sheep", x: -19.5, z: -47.4, cols: 5, rows: 5 },
  // Berry garden: strawberry beds on the west half.
  { id: "berries_1", crop: "strawberry", zone: "berries", x: -6.5, z: -38.4, cols: 5, rows: 4 },
  { id: "berries_2", crop: "strawberry", zone: "berries", x: -6.5, z: -46.6, cols: 5, rows: 4 },
  // Pumpkin field: big pumpkins, wider spacing.
  { id: "pumpkins_1", crop: "pumpkin", zone: "pumpkins", x: 19.5, z: -38.6, cols: 4, rows: 4 },
  { id: "pumpkins_2", crop: "pumpkin", zone: "pumpkins", x: 19.5, z: -47.6, cols: 4, rows: 4 },
];

/** The pond: water you cannot walk on, with a walkable pier from the east shore. */
export const POND = {
  water: { x0: -37, x1: -27.2, z0: 13.2, z1: 30.8 },
  pier: { x0: -33.4, x1: -27.2, z0: 21.1, z1: 22.9 },
};

const fromBounds = (x0: number, x1: number, z0: number, z1: number) => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 });

/** Water as collision rectangles — the pier is the gap between them. */
export const WATER_RECTS = [
  fromBounds(POND.water.x0, POND.water.x1, POND.water.z0, POND.pier.z0),
  fromBounds(POND.water.x0, POND.water.x1, POND.pier.z1, POND.water.z1),
  fromBounds(POND.water.x0, POND.pier.x0, POND.pier.z0, POND.pier.z1),
];

export const fieldById = (id: string) => FIELDS.find((f) => f.id === id)!;

// ── machines ────────────────────────────────────────────────────────────
export interface MachineDef {
  id: string;
  type: MachineTypeId;
  zone: ZoneId;
  x: number;
  z: number;
  /** Price of the build pad; 0 = exists from the start. */
  cost: number;
}

export const MACHINES: MachineDef[] = [
  { id: "mill", type: "mill", zone: "farm", x: -1, z: -5, cost: 0 },
  { id: "bakery", type: "bakery", zone: "farm", x: 7.5, z: -5.5, cost: 80 },
  { id: "feedmill", type: "feedmill", zone: "coop", x: -1.5, z: -22, cost: 500 },
  { id: "coop", type: "coop", zone: "coop", x: 7.6, z: -23, cost: 900 },
  { id: "barn", type: "barn", zone: "pasture", x: 29, z: -5.6, cost: 2200 },
  { id: "dairy", type: "dairy", zone: "pasture", x: 32.5, z: 4.4, cost: 3500 },
  { id: "juicer", type: "juicer", zone: "orchard", x: 4, z: 18, cost: 12000 },
  { id: "saucery", type: "saucery", zone: "garden", x: -30, z: -3, cost: 35000 },
  { id: "mill_2", type: "mill", zone: "sweets", x: 19.5, z: -26.5, cost: 60000 },
  { id: "confectionery", type: "confectionery", zone: "sweets", x: 28.5, z: -24.5, cost: 100000 },
  { id: "smokehouse", type: "smokehouse", zone: "pond", x: -20.5, z: 15.8, cost: 250000 },
  { id: "cannery", type: "cannery", zone: "pond", x: -19.5, z: 25.5, cost: 400000 },
  { id: "hives", type: "apiary", zone: "apiary", x: -29.5, z: -16.5, cost: 850000 },
  { id: "honeyhouse", type: "honeyhouse", zone: "apiary", x: -29.5, z: -26, cost: 1350000 },
  { id: "sheepfold", type: "sheepfold", zone: "sheep", x: -30.5, z: -38.2, cost: 2_000_000 },
  { id: "spinnery", type: "spinnery", zone: "sheep", x: -30.5, z: -45.6, cost: 3_000_000 },
  { id: "knitting", type: "knitting", zone: "sheep", x: -30.5, z: -52.4, cost: 4_000_000 },
  { id: "jamhouse", type: "jamhouse", zone: "berries", x: 4.5, z: -38.6, cost: 5_000_000 },
  { id: "icecream", type: "icecream", zone: "berries", x: 5.0, z: -48.4, cost: 9_000_000 },
  { id: "piebakery", type: "piebakery", zone: "pumpkins", x: 30.5, z: -38.8, cost: 20_000_000 },
  { id: "lanternshop", type: "lanternshop", zone: "pumpkins", x: 30.5, z: -47.6, cost: 30_000_000 },
];

export const machineById = (id: string) => MACHINES.find((m) => m.id === id)!;
/** Base for upgrade prices: initial machines get a fixed small base. */
export const machineUpgradeBase = (m: MachineDef) => (m.cost > 0 ? m.cost * 0.6 : 30);

// ── fixed buildings ─────────────────────────────────────────────────────
export const MARKET = { x: 7, z: 4.4, w: 4.4, d: 2.6, sell: { x: 7, z: 7, w: 3.8, d: 1.8 }, upPad: { x: 10.7, z: 4.8 } };
export const FARMHOUSE = { x: -8.6, z: -7.4, w: 4.4, d: 3.2, door: { x: -8.6, z: -4.95, w: 2.4, d: 1.4 } };
export const DEPOT = {
  x: 23.5,
  z: 18.6,
  w: 6,
  d: 4,
  input: { x: 22.6, z: 22, w: 3.6, d: 2 },
  /** Where the truck parks while loading. */
  dock: { x: 30.6, z: 18.2 },
  /** Truck route: enters from the east edge along the road. */
  roadZ: 25.6,
  upPad: { x: 27.2, z: 22.2 },
};
export const STATUE = { x: 33.5, z: -16.2, w: 3, d: 3 };
/** Compost bin next to the farmhouse: drop anything you do not want to carry. */
export const TRASH = { x: -4.6, z: -8.5, w: 1.7, d: 1.5 };

export const PLAYER_SPAWN = { x: -2.6, z: 1.4 };

/** Lamp posts (decor): they light up at night. Kept clear of all gameplay areas. */
export const LAMPS: readonly { x: number; z: number }[] = [
  { x: 5.3, z: 8.7 },
  { x: 10.6, z: 8.5 },
  { x: -6.1, z: -4.4 },
  { x: 3.0, z: -7.3 },
  { x: 2.0, z: 1.4 },
  { x: 0.6, z: -14.2 },
  { x: 24.6, z: 1.2 },
  { x: 19.5, z: 22.8 },
  { x: 0.4, z: 13.8 },
  { x: -24.4, z: -0.6 },
  { x: 33.0, z: -19.4 },
  { x: -24.2, z: 24.2 },
  { x: -24.6, z: -12.6 },
  { x: -24.4, z: -34.2 },
  { x: -36.6, z: -48.8 },
  { x: 0.4, z: -44.2 },
  { x: 11.2, z: -41.8 },
  { x: 25.2, z: -39.4 },
  { x: 36.8, z: -43.2 },
];

// ── workers ─────────────────────────────────────────────────────────────
export type WorkerTarget =
  | { kind: "machine"; id: string }
  | { kind: "market" }
  | { kind: "depot" };

export type WorkerJob =
  | { kind: "harvester"; fields: string[]; target: string }
  | { kind: "carrier"; source: string; target: WorkerTarget }
  | { kind: "operator"; machine: string };

export interface WorkerDef {
  id: string;
  name: string;
  job: WorkerJob;
}

// ── pads ────────────────────────────────────────────────────────────────
export type PadEffect =
  | { type: "machine"; id: string }
  | { type: "field"; id: string }
  | { type: "zone"; id: ZoneId }
  | { type: "worker"; worker: WorkerDef }
  | { type: "upgradeMachine"; id: string }
  | { type: "upgradeMarket" }
  | { type: "upgradeTruck" }
  | { type: "truck" }
  | { type: "statue" };

export type PadKind = "build" | "land" | "hire" | "upgrade" | "special";

export interface PadDef {
  id: string;
  kind: PadKind;
  zone: ZoneId;
  x: number;
  z: number;
  /** Side of the square pad. */
  size: number;
  cost: number;
  /** Pad ids that must be completed before this pad shows up. */
  requires: string[];
  effect: PadEffect;
  label: string;
  icon: string;
  /** Repeatable pads (upgrades) never complete; they level up. */
  repeatable?: boolean;
}

const PADS_LIST: PadDef[] = [];

function addPad(p: Omit<PadDef, "size"> & { size?: number }) {
  PADS_LIST.push({ size: 2.0, ...p });
}

/** Build pad for a machine — sits in front of where the building will appear. */
function machinePad(id: string, requires: string[]) {
  const m = machineById(id);
  const t = MACHINE_TYPES[m.type];
  addPad({
    id: `build_${id}`,
    kind: "build",
    zone: m.zone,
    x: m.x,
    z: m.z + t.size[1] / 2 + 1.35,
    size: 2.5,
    cost: m.cost,
    requires,
    effect: { type: "machine", id },
    label: t.name,
    icon: "🏗️",
  });
}

function fieldPad(id: string, cost: number, requires: string[]) {
  const f = fieldById(id);
  // Fishing spots are in the water: their pad sits where you stand to fish.
  const at = CROPS[f.crop].kind === "water" ? standPoint(f, f.x, f.z) : { x: f.x, z: f.z };
  addPad({
    id: `field_${id}`,
    kind: "build",
    zone: f.zone,
    x: at.x,
    z: at.z,
    size: 2.5,
    cost,
    requires,
    effect: { type: "field", id },
    label: f.crop === "apple" ? "Сад" : f.crop === "fish" ? "Рыбное место" : f.crop === "flowers" ? "Цветник" : "Грядка",
    icon: { wheat: "🌾", corn: "🌽", grass: "🌿", tomato: "🍅", apple: "🌳", flowers: "🌸", fish: "🎣", strawberry: "🍓", pumpkin: "🎃" }[f.crop],
  });
}

function zonePad(id: ZoneId, at: ZoneId, x: number, z: number, cost: number, requires: string[]) {
  const zd = zoneById(id);
  addPad({
    id: `zone_${id}`,
    kind: "land",
    zone: at,
    x,
    z,
    size: 2.8,
    cost,
    requires,
    effect: { type: "zone", id },
    label: zd.name,
    icon: zd.icon,
  });
}

function hirePad(
  id: string,
  zone: ZoneId,
  x: number,
  z: number,
  cost: number,
  requires: string[],
  name: string,
  job: WorkerJob,
) {
  const icon = job.kind === "harvester" ? "👨‍🌾" : job.kind === "carrier" ? "📦" : "⚙️";
  addPad({
    id: `hire_${id}`,
    kind: "hire",
    zone,
    x,
    z,
    size: 2.0,
    cost,
    requires,
    effect: { type: "worker", worker: { id, name, job } },
    label: name,
    icon,
  });
}

/** Operator hire pad sits on the machine's operator spot. */
function operatorPad(machine: string, cost: number, requires: string[]) {
  const m = machineById(machine);
  const t = MACHINE_TYPES[m.type];
  hirePad(`op_${machine}`, m.zone, m.x + t.opSpot[0], m.z + t.opSpot[1], cost, requires, "Оператор", {
    kind: "operator",
    machine,
  });
}

const harvester = (fields: string[], target: string): WorkerJob => ({ kind: "harvester", fields, target });
const carrier = (source: string, target: WorkerTarget): WorkerJob => ({ kind: "carrier", source, target });
const toMachine = (id: string): WorkerTarget => ({ kind: "machine", id });
const MARKET_T: WorkerTarget = { kind: "market" };
const DEPOT_T: WorkerTarget = { kind: "depot" };

// ── Ферма ───────────────────────────────────────────────────────────────
fieldPad("wheat_2", 15, []);
machinePad("bakery", ["field_wheat_2"]);
hirePad("h_wheat_1", "farm", -3.9, 1.6, 150, ["build_bakery"], "Сборщик", harvester(["wheat_1", "wheat_2", "wheat_3"], "mill"));
hirePad("c_mill_bakery", "farm", 3.3, -1.5, 250, ["hire_h_wheat_1"], "Грузчик", carrier("mill", toMachine("bakery")));
hirePad("c_bakery_market", "farm", 11.6, -2.4, 350, ["hire_c_mill_bakery"], "Грузчик", carrier("bakery", MARKET_T));
fieldPad("wheat_3", 300, ["hire_h_wheat_1"]);
hirePad("h_wheat_2", "farm", -3.9, 1.6, 500, ["hire_h_wheat_1", "field_wheat_3"], "Сборщик 2", harvester(["wheat_1", "wheat_2", "wheat_3"], "mill"));
operatorPad("mill", 450, ["hire_c_bakery_market"]);
operatorPad("bakery", 700, ["hire_op_mill"]);
zonePad("coop", "farm", 2.6, -9.7, 1500, ["hire_c_bakery_market"]);

// ── Курятник ────────────────────────────────────────────────────────────
machinePad("feedmill", ["zone_coop"]);
machinePad("coop", ["build_feedmill"]);
hirePad("h_corn_1", "coop", -4.3, -16.4, 1100, ["build_coop"], "Сборщик", harvester(["corn_1", "corn_2"], "feedmill"));
hirePad("c_feed_coop", "coop", 3.2, -17.3, 1400, ["hire_h_corn_1"], "Грузчик", carrier("feedmill", toMachine("coop")));
hirePad("c_coop_market", "coop", 11.7, -16.6, 1800, ["hire_c_feed_coop"], "Грузчик", carrier("coop", MARKET_T));
fieldPad("corn_2", 1600, ["hire_h_corn_1"]);
hirePad("h_corn_2", "coop", -4.3, -16.4, 2600, ["hire_h_corn_1", "field_corn_2"], "Сборщик 2", harvester(["corn_1", "corn_2"], "feedmill"));
operatorPad("feedmill", 2200, ["hire_c_coop_market"]);
operatorPad("coop", 3000, ["hire_op_feedmill"]);
zonePad("pasture", "farm", 11.8, 0.4, 6000, ["hire_c_coop_market"]);

// ── Пастбище ────────────────────────────────────────────────────────────
machinePad("barn", ["zone_pasture"]);
machinePad("dairy", ["build_barn"]);
hirePad("h_grass_1", "pasture", 22.9, 2.0, 4000, ["build_dairy"], "Сборщик", harvester(["grass_1", "grass_2"], "barn"));
hirePad("c_barn_dairy", "pasture", 33.6, -1.4, 5000, ["hire_h_grass_1"], "Грузчик", carrier("barn", toMachine("dairy")));
hirePad("c_dairy_market", "pasture", 28.4, 8.6, 6000, ["hire_c_barn_dairy"], "Грузчик", carrier("dairy", MARKET_T));
fieldPad("grass_2", 5000, ["hire_h_grass_1"]);
hirePad("h_grass_2", "pasture", 22.9, 2.0, 8000, ["hire_h_grass_1", "field_grass_2"], "Сборщик 2", harvester(["grass_1", "grass_2"], "barn"));
operatorPad("barn", 7000, ["hire_c_dairy_market"]);
operatorPad("dairy", 9500, ["hire_op_barn"]);
zonePad("depot", "pasture", 23.6, 9.8, 12000, ["hire_c_dairy_market"]);

// ── Склад ───────────────────────────────────────────────────────────────
hirePad("c_bakery_depot", "depot", 17.4, 13.4, 9000, ["zone_depot"], "Грузчик", carrier("bakery", DEPOT_T));
hirePad("c_coop_depot", "depot", 17.4, 16.4, 12000, ["hire_c_bakery_depot"], "Грузчик", carrier("coop", DEPOT_T));
hirePad("c_dairy_depot", "depot", 17.4, 19.4, 16000, ["hire_c_coop_depot"], "Грузчик", carrier("dairy", DEPOT_T));
addPad({
  id: "truck_2",
  kind: "special",
  zone: "depot",
  x: 34.8,
  z: 21.4,
  size: 2.4,
  cost: 20000,
  requires: ["hire_c_bakery_depot"],
  effect: { type: "truck" },
  label: "Грузовик 2",
  icon: "🚚",
});
zonePad("orchard", "farm", 3.4, 9.9, 30000, ["zone_depot"]);

// ── Сад ─────────────────────────────────────────────────────────────────
machinePad("juicer", ["zone_orchard"]);
hirePad("h_apple_1", "orchard", -2.3, 14.6, 15000, ["build_juicer"], "Сборщик", harvester(["apple_1", "apple_2"], "juicer"));
hirePad("c_juicer_depot", "orchard", 9.2, 16.6, 18000, ["hire_h_apple_1"], "Грузчик", carrier("juicer", DEPOT_T));
fieldPad("apple_2", 20000, ["hire_h_apple_1"]);
hirePad("h_apple_2", "orchard", -2.3, 14.6, 26000, ["hire_h_apple_1", "field_apple_2"], "Сборщик 2", harvester(["apple_1", "apple_2"], "juicer"));
operatorPad("juicer", 24000, ["hire_c_juicer_depot"]);
zonePad("garden", "farm", -11.8, -3.9, 80000, ["hire_c_juicer_depot"]);

// ── Огород ──────────────────────────────────────────────────────────────
machinePad("saucery", ["zone_garden"]);
hirePad("h_tomato_1", "garden", -22.6, 1.4, 40000, ["build_saucery"], "Сборщик", harvester(["tomato_1", "tomato_2"], "saucery"));
hirePad("c_saucery_market", "garden", -26.8, 3.6, 50000, ["hire_h_tomato_1"], "Грузчик", carrier("saucery", MARKET_T));
fieldPad("tomato_2", 55000, ["hire_h_tomato_1"]);
hirePad("h_tomato_2", "garden", -22.6, 1.4, 70000, ["hire_h_tomato_1", "field_tomato_2"], "Сборщик 2", harvester(["tomato_1", "tomato_2"], "saucery"));
operatorPad("saucery", 65000, ["hire_c_saucery_market"]);
zonePad("sweets", "coop", 11.8, -27.6, 200000, ["hire_c_saucery_market"]);

// ── Кондитерская ────────────────────────────────────────────────────────
machinePad("mill_2", ["zone_sweets"]);
hirePad("h_wheat_4", "sweets", 23.2, -19.6, 70000, ["build_mill_2"], "Сборщик", harvester(["wheat_4"], "mill_2"));
machinePad("confectionery", ["hire_h_wheat_4"]);
hirePad("c_mill2_conf", "sweets", 23.9, -21.4, 90000, ["build_confectionery"], "Грузчик", carrier("mill_2", toMachine("confectionery")));
hirePad("c_barn_conf", "sweets", 27.2, -13.4, 120000, ["hire_c_mill2_conf"], "Грузчик", carrier("barn", toMachine("confectionery")));
hirePad("c_coop_conf", "sweets", 24.8, -13.4, 130000, ["hire_c_barn_conf"], "Грузчик", carrier("coop", toMachine("confectionery")));
hirePad("c_conf_depot", "sweets", 36.4, -19.8, 150000, ["hire_c_coop_conf"], "Грузчик", carrier("confectionery", DEPOT_T));
operatorPad("confectionery", 180000, ["hire_c_conf_depot"]);
zonePad("pond", "garden", -25.5, 9.6, 450000, ["hire_c_conf_depot"]);

// ── Пруд ────────────────────────────────────────────────────────────────
machinePad("smokehouse", ["zone_pond"]);
machinePad("cannery", ["build_smokehouse"]);
hirePad("h_fish_1", "pond", -24.4, 22, 300000, ["build_cannery"], "Рыбак", harvester(["fish_1", "fish_2", "fish_3"], "smokehouse"));
hirePad("c_smoke_cannery", "pond", -17.2, 21.7, 450000, ["hire_h_fish_1"], "Грузчик", carrier("smokehouse", toMachine("cannery")));
hirePad("c_cannery_depot", "pond", -14.7, 30.2, 550000, ["hire_c_smoke_cannery"], "Грузчик", carrier("cannery", DEPOT_T));
fieldPad("fish_2", 450000, ["hire_h_fish_1"]);
hirePad("h_fish_2", "pond", -24.4, 22, 700000, ["hire_h_fish_1", "field_fish_2"], "Рыбак 2", harvester(["fish_1", "fish_2", "fish_3"], "smokehouse"));
fieldPad("fish_3", 800000, ["hire_h_fish_2"]);
operatorPad("smokehouse", 650000, ["hire_c_cannery_depot"]);
operatorPad("cannery", 900000, ["hire_op_smokehouse"]);
zonePad("apiary", "garden", -25.5, -9.6, 2_000_000, ["hire_c_cannery_depot"]);

// ── Пасека ──────────────────────────────────────────────────────────────
machinePad("hives", ["zone_apiary"]);
machinePad("honeyhouse", ["build_hives"]);
hirePad("h_flower_1", "apiary", -23.6, -20.5, 1_000_000, ["build_honeyhouse"], "Сборщик", harvester(["flowers_1", "flowers_2"], "hives"));
hirePad("c_hives_honey", "apiary", -26.2, -20.6, 1_500_000, ["hire_h_flower_1"], "Грузчик", carrier("hives", toMachine("honeyhouse")));
hirePad("c_honey_market", "apiary", -21.8, -29.2, 1_900_000, ["hire_c_hives_honey"], "Грузчик", carrier("honeyhouse", MARKET_T));
fieldPad("flowers_2", 1_300_000, ["hire_h_flower_1"]);
hirePad("h_flower_2", "apiary", -23.6, -20.5, 2_200_000, ["hire_h_flower_1", "field_flowers_2"], "Сборщик 2", harvester(["flowers_1", "flowers_2"], "hives"));
operatorPad("hives", 2_000_000, ["hire_c_honey_market"]);
operatorPad("honeyhouse", 2_700_000, ["hire_op_hives"]);
zonePad("sheep", "apiary", -25.5, -31.3, 4_500_000, ["hire_c_honey_market"]);

// ── Овчарня ─────────────────────────────────────────────────────────────
machinePad("sheepfold", ["zone_sheep"]);
machinePad("spinnery", ["build_sheepfold"]);
hirePad("h_grass_3", "sheep", -23.4, -43.0, 2_500_000, ["build_spinnery"], "Сборщик", harvester(["grass_3", "grass_4"], "sheepfold"));
machinePad("knitting", ["hire_h_grass_3"]);
hirePad("c_fold_spin", "sheep", -26.0, -41.2, 3_500_000, ["build_knitting"], "Грузчик", carrier("sheepfold", toMachine("spinnery")));
hirePad("c_spin_knit", "sheep", -26.0, -48.6, 4_500_000, ["hire_c_fold_spin"], "Грузчик", carrier("spinnery", toMachine("knitting")));
hirePad("c_knit_market", "sheep", -23.4, -52.6, 5_500_000, ["hire_c_spin_knit"], "Грузчик", carrier("knitting", MARKET_T));
fieldPad("grass_4", 3_000_000, ["hire_h_grass_3"]);
hirePad("h_grass_4", "sheep", -23.4, -43.0, 5_000_000, ["hire_h_grass_3", "field_grass_4"], "Сборщик 2", harvester(["grass_3", "grass_4"], "sheepfold"));
operatorPad("sheepfold", 6_000_000, ["hire_c_knit_market"]);
operatorPad("spinnery", 7_000_000, ["hire_op_sheepfold"]);
operatorPad("knitting", 8_500_000, ["hire_op_spinnery"]);
zonePad("berries", "sheep", -15.0, -42.8, 10_000_000, ["hire_c_knit_market"]);

// ── Ягодник ─────────────────────────────────────────────────────────────
machinePad("jamhouse", ["zone_berries"]);
hirePad("h_berry_1", "berries", -2.2, -42.6, 6_000_000, ["build_jamhouse"], "Сборщик", harvester(["berries_1", "berries_2"], "jamhouse"));
hirePad("c_jam_market", "berries", 9.4, -35.2, 7_000_000, ["hire_h_berry_1"], "Грузчик", carrier("jamhouse", MARKET_T));
fieldPad("berries_2", 6_500_000, ["hire_h_berry_1"]);
machinePad("icecream", ["hire_c_jam_market"]);
hirePad("h_berry_2", "berries", -2.2, -50.6, 9_000_000, ["build_icecream", "field_berries_2"], "Сборщик 2", harvester(["berries_1", "berries_2"], "icecream"));
hirePad("c_barn_ice", "berries", 11.4, -46.2, 10_000_000, ["hire_h_berry_2"], "Грузчик", carrier("barn", toMachine("icecream")));
hirePad("c_ice_market", "berries", 11.4, -50.6, 12_000_000, ["hire_c_barn_ice"], "Грузчик", carrier("icecream", MARKET_T));
operatorPad("jamhouse", 13_000_000, ["hire_c_ice_market"]);
operatorPad("icecream", 16_000_000, ["hire_op_jamhouse"]);
zonePad("pumpkins", "berries", 11.6, -38.6, 30_000_000, ["hire_c_ice_market"]);

// ── Тыквенное поле ──────────────────────────────────────────────────────
machinePad("piebakery", ["zone_pumpkins"]);
hirePad("h_pumpkin_1", "pumpkins", 24.6, -43.2, 18_000_000, ["build_piebakery"], "Сборщик", harvester(["pumpkins_1", "pumpkins_2"], "piebakery"));
hirePad("c_mill2_pie", "pumpkins", 25.4, -35.2, 22_000_000, ["hire_h_pumpkin_1"], "Грузчик", carrier("mill_2", toMachine("piebakery")));
hirePad("c_pie_depot", "pumpkins", 36.6, -35.4, 26_000_000, ["hire_c_mill2_pie"], "Грузчик", carrier("piebakery", DEPOT_T));
fieldPad("pumpkins_2", 20_000_000, ["hire_h_pumpkin_1"]);
machinePad("lanternshop", ["hire_c_pie_depot"]);
hirePad("h_pumpkin_2", "pumpkins", 24.6, -51.6, 32_000_000, ["build_lanternshop", "field_pumpkins_2"], "Сборщик 2", harvester(["pumpkins_1", "pumpkins_2"], "lanternshop"));
hirePad("c_lantern_market", "pumpkins", 36.6, -50.4, 38_000_000, ["hire_h_pumpkin_2"], "Грузчик", carrier("lanternshop", MARKET_T));
operatorPad("piebakery", 42_000_000, ["hire_c_lantern_market"]);
operatorPad("lanternshop", 50_000_000, ["hire_op_piebakery"]);

addPad({
  id: "statue",
  kind: "special",
  zone: "sweets",
  x: STATUE.x,
  z: STATUE.z,
  size: 2.8,
  cost: 150_000_000,
  requires: ["hire_c_lantern_market"],
  effect: { type: "statue" },
  label: "Золотая статуя",
  icon: "🏆",
});

// ── repeatable upgrades ─────────────────────────────────────────────────
for (const m of MACHINES) {
  const t = MACHINE_TYPES[m.type];
  addPad({
    id: `up_${m.id}`,
    kind: "upgrade",
    zone: m.zone,
    x: m.x + t.upPad[0],
    z: m.z + t.upPad[1],
    size: 1.9,
    cost: machineUpgradeBase(m),
    requires: m.cost > 0 ? [`build_${m.id}`] : ["field_wheat_2"],
    effect: { type: "upgradeMachine", id: m.id },
    label: t.name,
    icon: "⬆️",
    repeatable: true,
  });
}
addPad({
  id: "up_market",
  kind: "upgrade",
  zone: "farm",
  x: MARKET.upPad.x,
  z: MARKET.upPad.z,
  size: 1.9,
  cost: 250,
  requires: ["build_bakery"],
  effect: { type: "upgradeMarket" },
  label: "Рынок",
  icon: "⬆️",
  repeatable: true,
});
addPad({
  id: "up_truck",
  kind: "upgrade",
  zone: "depot",
  x: DEPOT.upPad.x,
  z: DEPOT.upPad.z,
  size: 1.9,
  cost: 8000,
  requires: ["zone_depot"],
  effect: { type: "upgradeTruck" },
  label: "Грузовики",
  icon: "⬆️",
  repeatable: true,
});

export const PADS: readonly PadDef[] = PADS_LIST;
export const padById = (id: string) => PADS.find((p) => p.id === id);

/** Machines that exist from the very start. */
export const INITIAL_MACHINES = MACHINES.filter((m) => m.cost === 0 && m.zone === "farm").map((m) => m.id);

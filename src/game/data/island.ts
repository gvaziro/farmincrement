/**
 * Chapter III, the island, as data: an archipelago of nine plots in a warm
 * sea. Between the plots runs a strait you cross on bridges; the lagoon and
 * the pearl bay are real water with fishing spots.
 *
 * Every production plot follows one template (local to its centre):
 *   fields on the west half · huts on the east half · bridges in the middle
 * of every side, so the centre stays a crossroads.
 */
import type { Rect } from "../core/math";
import { CROPS } from "./crops";
import type { ItemId } from "./items";
import { DEPOT, FARMHOUSE, MARKET, STATUE, ZONE_D, ZONE_W, registerWorldData, standPoint, type FieldDef, type IslandZoneId, type MachineDef, type PadDef, type PadKind, type WorkerJob, type WorkerTarget, type ZoneDef, type ZoneId } from "./layout";
import { MACHINE_TYPES, type MachineTypeId } from "./machines";
import { registerLayout, type FarmLayout, type TutorialStep } from "./worlds";


export const ISLAND_ZONES: ZoneDef[] = [
  { id: "i_beach", name: "Пляж", icon: "🏝️", gx: 0, gz: 0, includes: [], tint: "#e8d6a0" },
  { id: "i_bananas", name: "Банановая роща", icon: "🍌", gx: 1, gz: 0, includes: ["ban_1"], tint: "#9fd46a" },
  { id: "i_palms", name: "Кокосовая роща", icon: "🥥", gx: 0, gz: -1, includes: ["coco_1"], tint: "#c9d98a" },
  { id: "i_harbor", name: "Гавань", icon: "⚓", gx: 1, gz: -1, includes: [], tint: "#d9cfa8" },
  { id: "i_lagoon", name: "Лагуна", icon: "🐠", gx: -1, gz: 0, includes: ["lag_1"], tint: "#e3d8a8" },
  { id: "i_cane", name: "Тростниковое поле", icon: "🎋", gx: -1, gz: -1, includes: ["cane_1"], tint: "#a8d26a" },
  { id: "i_cocoa", name: "Какао-плантация", icon: "🍫", gx: 0, gz: -2, includes: ["cocoa_1"], tint: "#8fcc5e" },
  { id: "i_coffee", name: "Кофейные холмы", icon: "☕", gx: -1, gz: -2, includes: ["coffee_1", "van_1"], tint: "#98cf62" },
  { id: "i_pearls", name: "Жемчужная бухта", icon: "🦪", gx: 1, gz: -2, includes: ["oys_1"], tint: "#e6dcae" },
];

const zoneOf = (id: IslandZoneId) => ISLAND_ZONES.find((z) => z.id === id)!;
/** World position of a local point on a plot. */
const at = (zone: IslandZoneId, lx: number, lz: number) => {
  const z = zoneOf(zone);
  return { x: z.gx * ZONE_W + lx, z: z.gz * ZONE_D + lz };
};

export const ISLAND_BOUNDS = {
  minX: (Math.min(...ISLAND_ZONES.map((z) => z.gx)) - 0.5) * ZONE_W,
  maxX: (Math.max(...ISLAND_ZONES.map((z) => z.gx)) + 0.5) * ZONE_W,
  minZ: (Math.min(...ISLAND_ZONES.map((z) => z.gz)) - 0.5) * ZONE_D,
  maxZ: (Math.max(...ISLAND_ZONES.map((z) => z.gz)) + 0.5) * ZONE_D,
};

// ── water: straits between the plots, the lagoon and two bays ───────────
/** The strait between two plots is this wide; bridges cross it in the middle of each side. */
export const STRAIT = 2.4;
export const BRIDGE_HALF = 1.6;
const box = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2 });

function straits(): Rect[] {
  const out: Rect[] = [];
  const h = STRAIT / 2;
  const gxs = [...new Set(ISLAND_ZONES.map((z) => z.gx))].sort((a, b) => a - b);
  const gzs = [...new Set(ISLAND_ZONES.map((z) => z.gz))].sort((a, b) => a - b);
  // Between columns: a strait along z, broken by a bridge in the middle of each plot's side.
  for (let i = 0; i < gxs.length - 1; i++) {
    const x = (gxs[i] + 0.5) * ZONE_W;
    for (const gz of gzs) {
      const cz = gz * ZONE_D;
      out.push(box(x - h, x + h, cz - ZONE_D / 2, cz - BRIDGE_HALF), box(x - h, x + h, cz + BRIDGE_HALF, cz + ZONE_D / 2));
    }
  }
  // Between rows: a strait along x.
  for (let i = 0; i < gzs.length - 1; i++) {
    const z = (gzs[i] + 0.5) * ZONE_D;
    for (const gx of gxs) {
      const cx = gx * ZONE_W;
      out.push(box(cx - ZONE_W / 2, cx - BRIDGE_HALF, z - h, z + h), box(cx + BRIDGE_HALF, cx + ZONE_W / 2, z - h, z + h));
    }
  }
  return out;
}

const lagoonC = at("i_lagoon", 0, 0);
const harborC = at("i_harbor", 0, 0);
const pearlC = at("i_pearls", 0, 0);
/** Lakes and bays (world coordinates). */
export const LAGOON = box(lagoonC.x - 11.8, lagoonC.x - 4.4, lagoonC.z - 7.4, lagoonC.z + 7.4);
export const HARBOR_BAY = box(harborC.x + 4.6, harborC.x + 13, harborC.z + 1.0, harborC.z + 6.4);
export const PEARL_BAY = box(pearlC.x + 4.6, pearlC.x + 13, pearlC.z - 7.4, pearlC.z + 7.4);
export const ISLAND_WATER: readonly Rect[] = [...straits(), LAGOON, HARBOR_BAY, PEARL_BAY];

// ── fields ──────────────────────────────────────────────────────────────
const field = (id: string, crop: FieldDef["crop"], zone: IslandZoneId, lx: number, lz: number, cols: number, rows: number, extra: Partial<FieldDef> = {}): FieldDef => {
  const p = at(zone, lx, lz);
  return { id, crop, zone, x: p.x, z: p.z, cols, rows, ...extra };
};

/** Field slots of a production plot: two on the west half. */
const FA = { lx: -6.6, lz: -2.8 };
const FB = { lx: -6.6, lz: 4.6 };

export const ISLAND_FIELDS: FieldDef[] = [
  field("pine_1", "pineapple", "i_beach", -6.6, -1.4, 5, 4),
  field("pine_2", "pineapple", "i_beach", -6.6, 5.8, 5, 4),
  field("pine_3", "pineapple", "i_beach", -1.2, 6.0, 4, 4),
  field("ban_1", "banana", "i_bananas", FA.lx, FA.lz, 3, 2),
  field("ban_2", "banana", "i_bananas", FB.lx, FB.lz, 3, 2),
  field("coco_1", "coconut", "i_palms", FA.lx, FA.lz, 3, 2),
  field("coco_2", "coconut", "i_palms", FB.lx, FB.lz, 3, 2),
  // The lagoon: fishing spots along its east shore.
  field("lag_1", "fish", "i_lagoon", -5.4, -3.6, 1, 4, { rowSpacing: 1.8, stand: { x: lagoonC.x - 3.2 } }),
  field("lag_2", "fish", "i_lagoon", -5.4, 3.6, 1, 4, { rowSpacing: 1.8, stand: { x: lagoonC.x - 3.2 } }),
  field("cane_1", "cane", "i_cane", FA.lx, FA.lz, 5, 4),
  field("cane_2", "cane", "i_cane", FB.lx, FB.lz, 5, 4),
  field("cocoa_1", "cocoa", "i_cocoa", FA.lx, FA.lz, 3, 2),
  field("cocoa_2", "cocoa", "i_cocoa", FB.lx, FB.lz, 3, 2),
  field("coffee_1", "coffee", "i_coffee", FA.lx, FA.lz, 5, 4),
  field("van_1", "vanilla", "i_coffee", FB.lx, FB.lz, 5, 4),
  // The pearl bay: oyster beds along its west shore.
  field("oys_1", "oyster", "i_pearls", 5.4, -3.6, 1, 4, { rowSpacing: 1.8, stand: { x: pearlC.x + 3.2 } }),
  field("oys_2", "oyster", "i_pearls", 5.4, 3.6, 1, 4, { rowSpacing: 1.8, stand: { x: pearlC.x + 3.2 } }),
];

// ── huts ────────────────────────────────────────────────────────────────
const M1 = { lx: 5.2, lz: -6.6 };
const M2 = { lx: 5.2, lz: 3.0 };
const hut = (id: string, type: MachineTypeId, zone: IslandZoneId, lx: number, lz: number, cost: number): MachineDef => {
  const p = at(zone, lx, lz);
  return { id, type, zone, x: p.x, z: p.z, cost };
};

export const ISLAND_MACHINES: MachineDef[] = [
  hut("i_juicer", "i_juicer", "i_beach", -0.6, -5.4, 0),
  hut("i_icepop", "i_icepop", "i_beach", 7.5, -5.4, 80),
  hut("i_dryer", "i_dryer", "i_bananas", M1.lx, M1.lz, 500),
  hut("i_press", "i_press", "i_palms", M1.lx, M1.lz, 2_200),
  hut("i_smoothie", "i_smoothie", "i_palms", M2.lx, M2.lz, 3_500),
  hut("i_grill", "i_grill", "i_lagoon", M1.lx, M1.lz, 35_000),
  hut("i_sugarmill", "i_sugarmill", "i_cane", M1.lx, M1.lz, 90_000),
  hut("i_candy", "i_candy", "i_cane", M2.lx, M2.lz, 160_000),
  hut("i_cocoadryer", "i_cocoadryer", "i_cocoa", M1.lx, M1.lz, 600_000),
  hut("i_chocolate", "i_chocolate", "i_cocoa", M2.lx, M2.lz, 1_100_000),
  hut("i_roaster", "i_roaster", "i_coffee", M1.lx, M1.lz, 2_600_000),
  hut("i_gelato", "i_gelato", "i_coffee", M2.lx, M2.lz, 4_800_000),
  // The pearl bay has its huts on the west half: the water is in the east.
  hut("i_pearlshop", "i_pearlshop", "i_pearls", -5.6, M1.lz, 12_000_000),
  hut("i_jeweler", "i_jeweler", "i_pearls", -5.6, M2.lz, 22_000_000),
];

const machine = (id: string) => ISLAND_MACHINES.find((m) => m.id === id)!;
const fieldOf = (id: string) => ISLAND_FIELDS.find((f) => f.id === id)!;

// ── fixed buildings ─────────────────────────────────────────────────────
const beach = at("i_beach", 0, 0);
export const ISLAND_MARKET: typeof MARKET = { ...MARKET, x: beach.x + 7, z: beach.z + 4.4, sell: { ...MARKET.sell, x: beach.x + 7, z: beach.z + 7 }, upPad: { x: beach.x + 10.7, z: beach.z + 4.8 } };
export const ISLAND_HOUSE: typeof FARMHOUSE = { ...FARMHOUSE, x: beach.x - 8.6, z: beach.z - 7.6, door: { ...FARMHOUSE.door, x: beach.x - 8.6, z: beach.z - 5.15 } };
export const ISLAND_TRASH = { x: beach.x - 4.6, z: beach.z - 8.1, w: 1.7, d: 1.5 };
/** The seaplane's jetty on the south beach. */
export const SEAPLANE_STOP = { x: beach.x + 3.0, z: beach.z + 9.2, w: 2.8, d: 1.8 };
export const ISLAND_SPAWN = { x: beach.x - 2.6, z: beach.z + 1.4 };
/** The harbour: a warehouse by the bay; boats moor where trucks would park. */
export const ISLAND_DEPOT: typeof DEPOT = {
  ...DEPOT,
  x: harborC.x - 2.5,
  z: harborC.z - 3.4,
  input: { ...DEPOT.input, x: harborC.x - 3.4, z: harborC.z + 0.2 },
  dock: { x: harborC.x + 6.8, z: harborC.z + 3.7 },
  roadZ: harborC.z + 3.7,
  upPad: { x: harborC.x + 1.0, z: harborC.z + 0.2 },
};
/** The finale: a lighthouse on the rocks by the harbour. */
export const LIGHTHOUSE: typeof STATUE = { ...STATUE, x: harborC.x + 8.6, z: harborC.z - 6.4 };

// ── pads ────────────────────────────────────────────────────────────────
const LIST: PadDef[] = [];
function addPad(p: Omit<PadDef, "size"> & { size?: number }) {
  LIST.push({ size: 2.0, ...p });
}

function machinePad(id: string, requires: string[]) {
  const m = machine(id);
  const t = MACHINE_TYPES[m.type];
  addPad({ id: `build_${id}`, kind: "build", zone: m.zone, x: m.x, z: m.z + t.size[1] / 2 + 1.35, size: 2.4, cost: m.cost, requires, effect: { type: "machine", id }, label: t.name, icon: "🛖" });
}

const FIELD_ICONS: Partial<Record<FieldDef["crop"], string>> = { pineapple: "🍍", banana: "🍌", coconut: "🥥", fish: "🎣", cane: "🎋", cocoa: "🍫", coffee: "☕", vanilla: "🌼", oyster: "🦪" };

function fieldPad(id: string, cost: number, requires: string[]) {
  const f = fieldOf(id);
  const where = CROPS[f.crop].kind === "water" ? standPoint(f, f.x, f.z) : { x: f.x, z: f.z };
  const label = CROPS[f.crop].kind === "water" ? (f.crop === "oyster" ? "Устричная отмель" : "Рыбное место") : CROPS[f.crop].kind === "tree" ? "Роща" : "Грядка";
  addPad({ id: `field_${id}`, kind: "build", zone: f.zone, x: where.x, z: where.z, size: 2.4, cost, requires, effect: { type: "field", id }, label, icon: FIELD_ICONS[f.crop] ?? "🌱" });
}

function zonePad(id: IslandZoneId, from: IslandZoneId, lx: number, lz: number, cost: number, requires: string[], size = 2.0) {
  const p = at(from, lx, lz);
  const z = zoneOf(id);
  addPad({ id: `zone_${id}`, kind: "land", zone: from, x: p.x, z: p.z, size, cost, requires, effect: { type: "zone", id }, label: z.name, icon: z.icon });
}

function hirePad(id: string, zone: IslandZoneId, lx: number, lz: number, cost: number, requires: string[], name: string, job: WorkerJob) {
  const p = at(zone, lx, lz);
  const icon = job.kind === "harvester" ? "🧑‍🌾" : job.kind === "carrier" ? "📦" : "⚙️";
  addPad({ id: `hire_${id}`, kind: "hire" as PadKind, zone, x: p.x, z: p.z, cost, requires, effect: { type: "worker", worker: { id, name, job } }, label: name, icon });
}

function operatorPad(id: string, cost: number, requires: string[]) {
  const m = machine(id);
  const t = MACHINE_TYPES[m.type];
  addPad({ id: `hire_op_${id}`, kind: "hire", zone: m.zone, x: m.x + t.opSpot[0], z: m.z + t.opSpot[1], cost, requires, effect: { type: "worker", worker: { id: `op_${id}`, name: "Оператор", job: { kind: "operator", machine: id } } }, label: "Оператор", icon: "⚙️" });
}

const harvest = (fields: string[], target: string): WorkerJob => ({ kind: "harvester", fields, target });
const carry = (source: string, target: WorkerTarget): WorkerJob => ({ kind: "carrier", source, target });
const toM = (id: string): WorkerTarget => ({ kind: "machine", id });
const MARKET_T: WorkerTarget = { kind: "market" };
const DEPOT_T: WorkerTarget = { kind: "depot" };

/** Hire spots of a production plot (local), in the order they are handed out. */
const SPOTS = [
  [-1.4, 0.9],
  [1.8, -1.0],
  [4.6, -1.0],
  [7.0, -1.0],
  [-1.4, -2.0],
  [-1.4, 3.6],
  [1.8, 1.3],
  [8.6, -8.6],
  [8.4, 8.4],
] as const;
const spotIdx = new Map<IslandZoneId, number>();
const spot = (zone: IslandZoneId): [number, number] => {
  const i = spotIdx.get(zone) ?? 0;
  spotIdx.set(zone, i + 1);
  return [SPOTS[i][0], SPOTS[i][1]];
};
const hire = (id: string, zone: IslandZoneId, cost: number, requires: string[], name: string, job: WorkerJob) => hirePad(id, zone, ...spot(zone), cost, requires, name, job);

// ── Пляж ────────────────────────────────────────────────────────────────
fieldPad("pine_2", 15, []);
machinePad("i_icepop", ["field_pine_2"]);
hirePad("h_pine_1", "i_beach", -3.2, 2.2, 150, ["build_i_icepop"], "Сборщик", harvest(["pine_1", "pine_2", "pine_3"], "i_juicer"));
hirePad("c_juicer_icepop", "i_beach", 3.6, -0.6, 250, ["hire_h_pine_1"], "Грузчик", carry("i_juicer", toM("i_icepop")));
hirePad("c_icepop_market", "i_beach", 7.0, 1.4, 350, ["hire_c_juicer_icepop"], "Грузчик", carry("i_icepop", MARKET_T));
fieldPad("pine_3", 300, ["hire_h_pine_1"]);
hirePad("h_pine_2", "i_beach", -3.2, 2.2, 500, ["hire_h_pine_1", "field_pine_3"], "Сборщик 2", harvest(["pine_1", "pine_2", "pine_3"], "i_juicer"));
operatorPad("i_juicer", 450, ["hire_c_icepop_market"]);
operatorPad("i_icepop", 700, ["hire_op_i_juicer"]);
zonePad("i_bananas", "i_beach", 10.4, 0, 1_500, ["hire_c_icepop_market"]);

// ── Банановая роща ──────────────────────────────────────────────────────
machinePad("i_dryer", ["zone_i_bananas"]);
hire("h_ban_1", "i_bananas", 1_100, ["build_i_dryer"], "Сборщик", harvest(["ban_1", "ban_2"], "i_dryer"));
hire("c_dryer_market", "i_bananas", 1_600, ["hire_h_ban_1"], "Грузчик", carry("i_dryer", MARKET_T));
fieldPad("ban_2", 1_400, ["hire_h_ban_1"]);
operatorPad("i_dryer", 2_400, ["hire_c_dryer_market"]);
zonePad("i_palms", "i_beach", 0, -8.6, 6_000, ["hire_c_dryer_market"]);

// ── Кокосовая роща ──────────────────────────────────────────────────────
machinePad("i_press", ["zone_i_palms"]);
hire("h_coco_1", "i_palms", 4_000, ["build_i_press"], "Сборщик", harvest(["coco_1", "coco_2"], "i_press"));
machinePad("i_smoothie", ["hire_h_coco_1"]);
hire("c_press_smoothie", "i_palms", 5_000, ["build_i_smoothie"], "Грузчик", carry("i_press", toM("i_smoothie")));
hire("h_ban_s", "i_palms", 6_000, ["hire_c_press_smoothie"], "Сборщик бананов", harvest(["ban_1", "ban_2"], "i_smoothie"));
hire("c_smoothie_market", "i_palms", 7_000, ["hire_h_ban_s"], "Грузчик", carry("i_smoothie", MARKET_T));
fieldPad("coco_2", 5_000, ["hire_h_coco_1"]);
operatorPad("i_press", 7_500, ["hire_c_smoothie_market"]);
operatorPad("i_smoothie", 9_500, ["hire_op_i_press"]);
zonePad("i_harbor", "i_bananas", 0, -8.6, 12_000, ["hire_c_smoothie_market"]);

// ── Гавань ──────────────────────────────────────────────────────────────
const HARBOR_SPOTS: [number, number][] = [
  [-9.6, -7.4],
  [-9.6, -4.8],
  [-9.6, -2.2],
  [-9.6, 2.4],
  [-9.6, 5.0],
];
let hs = 0;
const harborHire = (id: string, cost: number, requires: string[], source: string) => hirePad(id, "i_harbor", ...HARBOR_SPOTS[hs++], cost, requires, "Грузчик", carry(source, DEPOT_T));
harborHire("c_icepop_depot", 9_000, ["zone_i_harbor"], "i_icepop");
harborHire("c_dryer_depot", 12_000, ["hire_c_icepop_depot"], "i_dryer");
harborHire("c_smoothie_depot", 16_000, ["hire_c_dryer_depot"], "i_smoothie");
addPad({ id: "truck_2", kind: "special", zone: "i_harbor", x: harborC.x + 3.6, z: harborC.z - 3.0, size: 2.2, cost: 20_000, requires: ["hire_c_icepop_depot"], effect: { type: "truck" }, label: "Лодка 2", icon: "⛵" });
zonePad("i_lagoon", "i_beach", -10.6, 2.2, 30_000, ["zone_i_harbor"]);

// ── Лагуна ──────────────────────────────────────────────────────────────
machinePad("i_grill", ["zone_i_lagoon"]);
hire("h_fish_1", "i_lagoon", 15_000, ["build_i_grill"], "Рыбак", harvest(["lag_1", "lag_2"], "i_grill"));
hire("c_grill_depot", "i_lagoon", 18_000, ["hire_h_fish_1"], "Грузчик", carry("i_grill", DEPOT_T));
fieldPad("lag_2", 20_000, ["hire_h_fish_1"]);
hire("h_fish_2", "i_lagoon", 26_000, ["hire_h_fish_1", "field_lag_2"], "Рыбак 2", harvest(["lag_1", "lag_2"], "i_grill"));
operatorPad("i_grill", 24_000, ["hire_c_grill_depot"]);
// Between two groves the path is narrow: a smaller pad.
zonePad("i_cane", "i_palms", -10.6, 0.9, 80_000, ["hire_c_grill_depot"], 1.5);

// ── Тростниковое поле ───────────────────────────────────────────────────
machinePad("i_sugarmill", ["zone_i_cane"]);
hire("h_cane_1", "i_cane", 40_000, ["build_i_sugarmill"], "Сборщик", harvest(["cane_1", "cane_2"], "i_sugarmill"));
machinePad("i_candy", ["hire_h_cane_1"]);
hire("c_mill_candy", "i_cane", 50_000, ["build_i_candy"], "Грузчик", carry("i_sugarmill", toM("i_candy")));
hire("c_press_candy", "i_cane", 60_000, ["hire_c_mill_candy"], "Грузчик", carry("i_press", toM("i_candy")));
hire("c_candy_market", "i_cane", 70_000, ["hire_c_press_candy"], "Грузчик", carry("i_candy", MARKET_T));
fieldPad("cane_2", 55_000, ["hire_h_cane_1"]);
hire("h_cane_2", "i_cane", 70_000, ["hire_h_cane_1", "field_cane_2"], "Сборщик 2", harvest(["cane_1", "cane_2"], "i_sugarmill"));
operatorPad("i_sugarmill", 65_000, ["hire_c_candy_market"]);
operatorPad("i_candy", 90_000, ["hire_op_i_sugarmill"]);
zonePad("i_cocoa", "i_palms", 0, -8.6, 200_000, ["hire_c_candy_market"]);

// ── Какао-плантация ─────────────────────────────────────────────────────
machinePad("i_cocoadryer", ["zone_i_cocoa"]);
hire("h_cocoa_1", "i_cocoa", 300_000, ["build_i_cocoadryer"], "Сборщик", harvest(["cocoa_1", "cocoa_2"], "i_cocoadryer"));
machinePad("i_chocolate", ["hire_h_cocoa_1"]);
hire("c_beans_choc", "i_cocoa", 450_000, ["build_i_chocolate"], "Грузчик", carry("i_cocoadryer", toM("i_chocolate")));
hire("c_sugar_choc", "i_cocoa", 500_000, ["hire_c_beans_choc"], "Грузчик", carry("i_sugarmill", toM("i_chocolate")));
hire("c_milk_choc", "i_cocoa", 550_000, ["hire_c_sugar_choc"], "Грузчик", carry("i_press", toM("i_chocolate")));
hire("c_choc_depot", "i_cocoa", 600_000, ["hire_c_milk_choc"], "Грузчик", carry("i_chocolate", DEPOT_T));
fieldPad("cocoa_2", 450_000, ["hire_h_cocoa_1"]);
operatorPad("i_cocoadryer", 650_000, ["hire_c_choc_depot"]);
operatorPad("i_chocolate", 900_000, ["hire_op_i_cocoadryer"]);
zonePad("i_coffee", "i_cocoa", -10.6, 0.9, 2_000_000, ["hire_c_choc_depot"], 1.5);

// ── Кофейные холмы ──────────────────────────────────────────────────────
machinePad("i_roaster", ["zone_i_coffee"]);
hire("h_coffee", "i_coffee", 1_000_000, ["build_i_roaster"], "Сборщик", harvest(["coffee_1"], "i_roaster"));
hire("c_roast_market", "i_coffee", 1_500_000, ["hire_h_coffee"], "Грузчик", carry("i_roaster", MARKET_T));
machinePad("i_gelato", ["hire_c_roast_market"]);
hire("h_vanilla", "i_coffee", 2_200_000, ["build_i_gelato"], "Сборщик", harvest(["van_1"], "i_gelato"));
hire("c_milk_gelato", "i_coffee", 2_600_000, ["hire_h_vanilla"], "Грузчик", carry("i_press", toM("i_gelato")));
hire("c_sugar_gelato", "i_coffee", 3_000_000, ["hire_c_milk_gelato"], "Грузчик", carry("i_sugarmill", toM("i_gelato")));
hire("c_gelato_market", "i_coffee", 3_600_000, ["hire_c_sugar_gelato"], "Грузчик", carry("i_gelato", MARKET_T));
operatorPad("i_roaster", 3_000_000, ["hire_c_gelato_market"]);
operatorPad("i_gelato", 4_500_000, ["hire_op_i_roaster"]);
zonePad("i_pearls", "i_cocoa", 10.4, 0, 9_000_000, ["hire_c_gelato_market"]);

// ── Жемчужная бухта ─────────────────────────────────────────────────────
const PEARL_SPOTS: [number, number][] = [
  [-0.8, 0.9],
  [-0.8, -2.0],
  [0.2, 3.6],
  [-9.6, -1.0],
  [-9.6, 6.6],
];
let ps = 0;
const pearlHire = (id: string, cost: number, requires: string[], name: string, job: WorkerJob) => hirePad(id, "i_pearls", ...PEARL_SPOTS[ps++], cost, requires, name, job);
machinePad("i_pearlshop", ["zone_i_pearls"]);
pearlHire("h_oys_1", 6_000_000, ["build_i_pearlshop"], "Ныряльщик", harvest(["oys_1", "oys_2"], "i_pearlshop"));
machinePad("i_jeweler", ["hire_h_oys_1"]);
pearlHire("c_pearl_jew", 8_000_000, ["build_i_jeweler"], "Грузчик", carry("i_pearlshop", toM("i_jeweler")));
pearlHire("c_jew_depot", 10_000_000, ["hire_c_pearl_jew"], "Грузчик", carry("i_jeweler", DEPOT_T));
fieldPad("oys_2", 7_000_000, ["hire_h_oys_1"]);
pearlHire("h_oys_2", 12_000_000, ["hire_h_oys_1", "field_oys_2"], "Ныряльщик 2", harvest(["oys_1", "oys_2"], "i_pearlshop"));
operatorPad("i_pearlshop", 14_000_000, ["hire_c_jew_depot"]);
operatorPad("i_jeweler", 18_000_000, ["hire_op_i_pearlshop"]);

addPad({ id: "statue", kind: "special", zone: "i_harbor", x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, size: 2.8, cost: 120_000_000, requires: ["hire_c_jew_depot"], effect: { type: "statue" }, label: "Маяк", icon: "🗼" });

// ── repeatable upgrades ─────────────────────────────────────────────────
for (const m of ISLAND_MACHINES) {
  const t = MACHINE_TYPES[m.type];
  addPad({ id: `up_${m.id}`, kind: "upgrade", zone: m.zone, x: m.x + t.upPad[0], z: m.z + t.upPad[1], size: 1.9, cost: m.cost > 0 ? m.cost * 0.6 : 30, requires: m.cost > 0 ? [`build_${m.id}`] : ["field_pine_2"], effect: { type: "upgradeMachine", id: m.id }, label: t.name, icon: "⬆️", repeatable: true });
}
addPad({ id: "up_market", kind: "upgrade", zone: "i_beach", x: ISLAND_MARKET.upPad.x, z: ISLAND_MARKET.upPad.z, size: 1.9, cost: 250, requires: ["build_i_icepop"], effect: { type: "upgradeMarket" }, label: "Рынок", icon: "⬆️", repeatable: true });
addPad({ id: "up_truck", kind: "upgrade", zone: "i_harbor", x: ISLAND_DEPOT.upPad.x, z: ISLAND_DEPOT.upPad.z, size: 1.9, cost: 8_000, requires: ["zone_i_harbor"], effect: { type: "upgradeTruck" }, label: "Лодки", icon: "⬆️", repeatable: true });

export const ISLAND_PADS: readonly PadDef[] = LIST;

/** Where the merchant's boat ties up on each plot. */
export const ISLAND_MERCHANT_SPOTS: Partial<Record<ZoneId, { x: number; z: number }>> = {
  i_bananas: at("i_bananas", -0.6, 6.6),
  i_palms: at("i_palms", -0.6, 6.6),
  i_cane: at("i_cane", -0.6, 6.6),
  i_cocoa: at("i_cocoa", -0.6, 6.6),
  i_coffee: at("i_coffee", -0.6, 6.6),
};

// ── the chapter's own numbers ───────────────────────────────────────────
/** Stars for the lighthouse and for each island opened. */
export const LIGHTHOUSE_STARS = 50;
export const ISLE_STARS = 2;
/** Exotic fame: each island makes goods dearer on the farm and in town. */
export const FAME_PER_ISLE = 0.02;
export const FAME_LIGHTHOUSE = 0.1;
/** The city sends the island this much per business, per second. */
export const CITY_PENNY_PER_SHOP = 0.5;

/** The island's seasons: the same calendar and perks, tropical names, no snow. */
export const ISLAND_SEASONS = {
  spring: { name: "Цветение", icon: "🌺" },
  summer: { name: "Сухой сезон", icon: "🌞" },
  autumn: { name: "Сбор урожая", icon: "🥭" },
  winter: { name: "Сезон дождей", icon: "🌧️" },
} as const;

export const ISLAND_DEMAND = {
  spring: ["icepop", "smoothie", "candy"],
  summer: ["ajuice", "gelato", "grillfish"],
  autumn: ["chips", "chocolate", "roasted"],
  winter: ["cmilk", "sugar", "necklace"],
} as const satisfies Record<string, readonly ItemId[]>;

export const ISLAND_TUTORIAL: readonly TutorialStep[] = [
  { text: "Пробеги по грядке — собери ананасы", icon: "🍍", item: "pineapple" },
  { text: "Отнеси ананасы в соковыжималку", icon: "🧃", item: "pineapple" },
  { text: "Забери готовый сок", icon: "🧃", item: "ajuice" },
  { text: "Продай сок на пляжном рынке", icon: "💰", item: "ajuice" },
  { text: "Встань на площадку — купи грядку", icon: "🏗️" },
];

export const ISLAND_LAYOUT: FarmLayout = {
  id: "island",
  zones: ISLAND_ZONES,
  fields: ISLAND_FIELDS,
  machines: ISLAND_MACHINES,
  pads: ISLAND_PADS,
  startZone: "i_beach",
  startFields: ["pine_1"],
  startMachines: ["i_juicer"],
  depotZone: "i_harbor",
  market: ISLAND_MARKET,
  farmhouse: ISLAND_HOUSE,
  depot: ISLAND_DEPOT,
  statue: LIGHTHOUSE,
  trash: ISLAND_TRASH,
  water: ISLAND_WATER,
  spawn: ISLAND_SPAWN,
  bounds: ISLAND_BOUNDS,
  merchantSpots: ISLAND_MERCHANT_SPOTS,
  runawayHomes: { monkey: "i_dryer" },
  busStop: SEAPLANE_STOP,
  tutorial: { steps: ISLAND_TUTORIAL, raw: "pineapple", product: "ajuice", firstPad: "field_pine_2" },
};

registerWorldData({ zones: ISLAND_ZONES, fields: ISLAND_FIELDS, machines: ISLAND_MACHINES });
registerLayout(ISLAND_LAYOUT);

/**
 * Chapter II, the city, as static data: businesses, counters, tables and the
 * pads that open them. Every business sits on a plot of the same size as a
 * farm plot and is laid out the same way, from north to south:
 *
 *   facade · kitchens · staff walkway · counters · customers · tables ·
 *   pavement with the farm's pallets · road with the van
 *
 * Coordinates in the tables below are local to the plot's centre.
 */
import { CITY_KITCHEN_X, CITY_KITCHEN_Z, CITY_ZONES, ZONE_D, cityPrice, ZONE_W, machineById, type CityZoneId, type PadDef, type PadEffect, type PadKind, type WorkerJob, type WorkerTarget, type ZoneDef } from "./layout";
import { MACHINE_TYPES, type SupplyItem } from "./machines";
import { ITEMS, type ItemId } from "./items";

export const CITY_BOUNDS = {
  minX: (Math.min(...CITY_ZONES.map((z) => z.gx)) - 0.5) * ZONE_W,
  maxX: (Math.max(...CITY_ZONES.map((z) => z.gx)) + 0.5) * ZONE_W,
  minZ: (Math.min(...CITY_ZONES.map((z) => z.gz)) - 0.5) * ZONE_D,
  maxZ: (Math.max(...CITY_ZONES.map((z) => z.gz)) + 0.5) * ZONE_D,
};

const zoneOf = (id: CityZoneId) => CITY_ZONES.find((z) => z.id === id)!;
const centre = (z: ZoneDef) => ({ x: z.gx * ZONE_W, z: z.gz * ZONE_D });

// ── plot layout, local to the plot's centre ─────────────────────────────
/** The road along the south of every row of plots. */
export const ROAD_DZ = 9.3;
export const ROAD_HALF = 1.7;
export const PAVEMENT_DZ = 6.5;
/** Back wall of a business: you walk round it at the plot's sides. */
export const FACADE = { w: 20, d: 0.8, dz: -10.6 };
const COUNTER_Z = -0.6;
const COUNTER_D = 1.0;
const SHELF_W = 2.6;
const SHELF_X = [-4.6, -2.0, 0.6, 3.2, 5.8];
const STAFF_Z = -1.75;
const STAFF_D = 1.3;
const REGISTER_X = -7.6;
const REGISTER_W = 2.2;
const CASH = { x: -10.9, z: -1.3, w: 2.2, d: 2.2 };
const TABLE_X = [-4.6, -1.8, 1.0, 3.8, 6.6];
const TABLE_Z = 3.2;
const DELIVERY = { x: -6.4, z: 6.5, w: 2.8, d: 1.7 };
const BIN = { x: -0.4, z: -7.6, w: 1.7, d: 1.5 };
/** Where hire pads go, one after another. */
const HIRE_SPOTS: readonly [number, number][] = [
  [-6, -3.35],
  [-3.8, -3.35],
  [-1.6, -3.35],
  [0.6, -3.35],
  [2.8, -3.35],
  [5, -3.35],
  [7.2, -3.35],
  [9.4, -3.35],
  [11.6, -3.35],
  [9.4, 1.2],
  [11.6, 1.2],
  [9.4, 3.3],
  [2.2, 6.5],
  [0, 6.5],
  [-2.2, 6.5],
];
const SHOP_LEVEL_SPOT: readonly [number, number] = [9.4, -0.7];
const SHOP_ADS_SPOT: readonly [number, number] = [11.6, -0.7];
const SHOP_VAN_SPOT: readonly [number, number] = [11.6, 3.6];
const COLLECTOR_SPOT: readonly [number, number] = [-10.9, -3.6];

// ── businesses ──────────────────────────────────────────────────────────
export type ShopId = "lavka" | "cafe" | "pizza" | "fish" | "sweets" | "fashion" | "store";

export interface Box {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface ShelfDef {
  id: string;
  shop: ShopId;
  item: ItemId;
  /** The counter itself. */
  box: Box;
  /** The strip behind it where staff put goods down. */
  staff: Box;
  /** Where customers stand in front of it. */
  front: readonly { x: number; z: number }[];
}

export interface TableDef {
  id: string;
  shop: ShopId;
  x: number;
  z: number;
  /** Where its two guests stand. */
  seats: readonly { x: number; z: number }[];
}

export interface ShopDef {
  id: ShopId;
  zone: CityZoneId;
  name: string;
  /** Sign above the facade. */
  sign: string;
  icon: string;
  wall: string;
  trim: string;
  awning: string;
  cx: number;
  cz: number;
  /** The till's counter. */
  register: Box;
  /** Stand here to serve customers. */
  till: Box;
  /** Money piles up here. */
  cash: Box;
  /** Stand here to throw away what you carry. */
  bin: Box;
  queue: readonly { x: number; z: number }[];
  /** Where customers come from and go to. */
  doors: readonly { x: number; z: number }[];
  /** Where the farm van stops, and the lane it drives along. */
  bay: number;
  roadZ: number;
  delivery?: Box;
  /** Base price of its level, advertising and van upgrades. */
  upgradeBase: number;
}

interface ShopSpec {
  id: ShopId;
  zone: CityZoneId;
  name: string;
  sign: string;
  icon: string;
  wall: string;
  trim: string;
  awning: string;
  upgradeBase: number;
  delivery?: boolean;
}

const SHOP_SPECS: ShopSpec[] = [
  { id: "lavka", zone: "c_lavka", name: "Фермерская лавка", sign: "ФЕРМЕРСКАЯ ЛАВКА", icon: "🧺", wall: "#e8c98f", trim: "#a8642a", awning: "#5fae45", upgradeBase: 60 },
  { id: "cafe", zone: "c_cafe", name: "Кафе", sign: "КАФЕ", icon: "☕", wall: "#d98f6a", trim: "#7a4a2a", awning: "#c98f5a", upgradeBase: 700 },
  { id: "pizza", zone: "c_pizza", name: "Пиццерия", sign: "ПИЦЦЕРИЯ", icon: "🍕", wall: "#e8b45a", trim: "#b5322a", awning: "#e8413c", upgradeBase: 7_000, delivery: true },
  { id: "fish", zone: "c_fish", name: "Рыбный ресторан", sign: "РЫБНЫЙ РЕСТОРАН", icon: "🍽️", wall: "#7fb0c8", trim: "#2f5a72", awning: "#3f8fd9", upgradeBase: 60_000, delivery: true },
  { id: "sweets", zone: "c_sweets", name: "Кондитерская", sign: "КОНДИТЕРСКАЯ", icon: "🍰", wall: "#f2b6c8", trim: "#c25a7f", awning: "#ff8fb1", upgradeBase: 350_000 },
  { id: "fashion", zone: "c_fashion", name: "Модный дом", sign: "МОДНЫЙ ДОМ", icon: "🧥", wall: "#9a8fc8", trim: "#4a3f7a", awning: "#6c5cc4", upgradeBase: 2_500_000 },
  { id: "store", zone: "c_store", name: "Универмаг", sign: "УНИВЕРМАГ", icon: "🏬", wall: "#8fc8b0", trim: "#2f7a5f", awning: "#35a37a", upgradeBase: 15_000_000, delivery: true },
];

const local = (cx: number, cz: number, b: Box): Box => ({ x: cx + b.x, z: cz + b.z, w: b.w, d: b.d });

function queueSlots(cx: number, cz: number) {
  const out: { x: number; z: number }[] = [];
  // Down from the till, then back up beside the line.
  for (const [col, rows] of [
    [0, [0.75, 1.8, 2.85, 3.9, 4.95]],
    [-1.15, [4.95, 3.9, 2.85, 1.8, 0.75]],
  ] as const) {
    for (const r of rows) out.push({ x: cx + REGISTER_X + col, z: cz + r });
  }
  return out;
}

export const SHOPS: readonly ShopDef[] = SHOP_SPECS.map((s) => {
  const c = centre(zoneOf(s.zone));
  return {
    id: s.id,
    zone: s.zone,
    name: s.name,
    sign: s.sign,
    icon: s.icon,
    wall: s.wall,
    trim: s.trim,
    awning: s.awning,
    cx: c.x,
    cz: c.z,
    register: local(c.x, c.z, { x: REGISTER_X, z: COUNTER_Z, w: REGISTER_W, d: COUNTER_D }),
    till: local(c.x, c.z, { x: REGISTER_X, z: STAFF_Z, w: REGISTER_W, d: STAFF_D }),
    cash: local(c.x, c.z, CASH),
    bin: local(c.x, c.z, BIN),
    queue: queueSlots(c.x, c.z),
    doors: [
      { x: c.x + 12.4, z: c.z + PAVEMENT_DZ },
      { x: c.x - 12.4, z: c.z + PAVEMENT_DZ },
    ],
    bay: c.x + 8,
    roadZ: c.z + ROAD_DZ - 0.75,
    delivery: s.delivery ? local(c.x, c.z, DELIVERY) : undefined,
    upgradeBase: cityPrice(s.upgradeBase, s.zone),
  };
});

const SHOP_INDEX = new Map(SHOPS.map((s) => [s.id as string, s]));
export const shopById = (id: string) => SHOP_INDEX.get(id)!;
export const isShopId = (v: unknown): v is ShopId => typeof v === "string" && SHOP_INDEX.has(v);

function shelf(shop: ShopId, slot: number, item: ItemId): ShelfDef {
  const s = shopById(shop);
  const x = s.cx + SHELF_X[slot];
  return {
    id: `shelf_${shop}_${item}`,
    shop,
    item,
    box: { x, z: s.cz + COUNTER_Z, w: SHELF_W - 0.06, d: COUNTER_D },
    staff: { x, z: s.cz + STAFF_Z, w: SHELF_W - 0.06, d: STAFF_D },
    front: [
      { x: x - 0.55, z: s.cz + 0.55 },
      { x: x + 0.55, z: s.cz + 0.55 },
    ],
  };
}

export const SHELVES: readonly ShelfDef[] = [
  shelf("lavka", 0, "bread"),
  shelf("lavka", 1, "egg"),
  shelf("lavka", 2, "milk"),
  shelf("cafe", 0, "juice"),
  shelf("cafe", 1, "cheese"),
  shelf("cafe", 2, "latte"),
  shelf("cafe", 3, "sandwich"),
  shelf("pizza", 0, "juice"),
  shelf("pizza", 1, "sauce"),
  shelf("pizza", 2, "pizza"),
  shelf("fish", 0, "smokedfish"),
  shelf("fish", 1, "canned"),
  shelf("fish", 2, "fishdish"),
  shelf("sweets", 0, "cake"),
  shelf("sweets", 1, "eclair"),
  shelf("sweets", 2, "honey"),
  shelf("sweets", 3, "medovik"),
  shelf("fashion", 0, "yarn"),
  shelf("fashion", 1, "sweater"),
  shelf("fashion", 2, "coat"),
  shelf("store", 0, "jam"),
  shelf("store", 1, "lantern"),
  shelf("store", 2, "icecream"),
  shelf("store", 3, "pie"),
  shelf("store", 4, "giftbox"),
];
const SHELF_INDEX = new Map(SHELVES.map((s) => [s.id, s]));
export const shelfById = (id: string) => SHELF_INDEX.get(id)!;

function table(shop: ShopId, slot: number): TableDef {
  const s = shopById(shop);
  const x = s.cx + TABLE_X[slot];
  const z = s.cz + TABLE_Z;
  return {
    id: `table_${shop}_${slot}`,
    shop,
    x,
    z,
    seats: [
      { x: x - 0.78, z },
      { x: x + 0.78, z },
    ],
  };
}

export const TABLES: readonly TableDef[] = [0, 1, 2, 3].map((i) => table("cafe", i)).concat([0, 1, 2].map((i) => table("pizza", i)), [0, 1, 2, 3, 4].map((i) => table("fish", i)), [0, 1, 2, 3].map((i) => table("sweets", i)));
export const tableById = (id: string) => TABLES.find((t) => t.id === id)!;

/** The start: what stands on the first plot from day one. */
export const CITY_START_MACHINES = ["sup_c_lavka_bread"];
export const CITY_START_SHELVES = ["shelf_lavka_bread"];
/** The pad the city's tutorial points at. */
export const CITY_FIRST_PAD = "goods_lavka_egg";

export const supplyId = (zone: CityZoneId, item: SupplyItem) => `sup_${zone}_${item}`;

// ── fixed places ────────────────────────────────────────────────────────
const LAVKA = shopById("lavka");
/** Stops: the farm's by its south fence, the city's on the first plot's pavement. */
export const FARM_BUS_STOP: Box = { x: 8, z: 9.9, w: 2.8, d: 1.8 };
export const CITY_BUS_STOP: Box = { x: LAVKA.cx - 9.9, z: LAVKA.cz + 6.5, w: 2.8, d: 1.8 };
export const CITY_SPAWN = { x: LAVKA.cx - 9.9, z: LAVKA.cz + 4.7 };
/** Where you step off the bus on the farm: beside the stop, not on it. */
export const FARM_SPAWN = { x: FARM_BUS_STOP.x, z: FARM_BUS_STOP.z - 1.7 };
/** The owner's office: upgrades, like the farmhouse on the farm. */
export const CITY_OFFICE = { x: LAVKA.cx + CITY_KITCHEN_X[0], z: LAVKA.cz + CITY_KITCHEN_Z, w: 4.4, d: 3.2, door: { x: LAVKA.cx + CITY_KITCHEN_X[0], z: LAVKA.cz + CITY_KITCHEN_Z + 2.45, w: 2.4, d: 1.4 } };

const towerZone = zoneOf("c_tower");
export const TOWER = { x: towerZone.gx * ZONE_W, z: towerZone.gz * ZONE_D - 4.2, w: 13, d: 9 };
export const TOWER_FLOORS = 5;
export const FLOOR_COSTS: readonly number[] = [30_000_000, 50_000_000, 80_000_000, 120_000_000, 180_000_000];
const parkZone = zoneOf("c_park");
export const FOUNTAIN = { x: parkZone.gx * ZONE_W, z: parkZone.gz * ZONE_D - 1, w: 4.2, d: 4.2 };

export const SHOP_MAX_LEVEL = 10;
/** Advertising and the van cost a little more than repairs. */
export const ADS_COST_MULT = 1.4;
export const VAN_COST_MULT = 1.1;
/** Every floor of the tower makes the whole company's goods dearer. */
export const FLOOR_PRICE_BONUS = 0.05;

// ── pads ────────────────────────────────────────────────────────────────
const LIST: PadDef[] = [];
const spotIndex = new Map<ShopId, number>();

function add(id: string, kind: PadKind, zone: CityZoneId, x: number, z: number, cost: number, requires: string[], effect: PadEffect, label: string, icon: string, extra: { size?: number; repeatable?: boolean } = {}) {
  LIST.push({ id, kind, zone, x, z, size: extra.size ?? 1.9, cost, requires, effect, label, icon, repeatable: extra.repeatable });
}

const nextSpot = (shop: ShopId) => {
  const s = shopById(shop);
  const i = spotIndex.get(shop) ?? 0;
  spotIndex.set(shop, i + 1);
  if (i >= HIRE_SPOTS.length) throw new Error(`no free spots left on ${shop}`);
  const [lx, lz] = HIRE_SPOTS[i];
  return { x: s.cx + lx, z: s.cz + lz };
};

const city = (machines: string[], shelves: string[], tables: string[] = [], delivery?: string): PadEffect => ({ type: "city", machines, shelves, tables, delivery });
const scaled = (shop: ShopId, cost: number) => cityPrice(cost, shopById(shop).zone);

/** A new product on the counter, with its pallet of goods from the farm. */
function goods(shop: ShopId, item: SupplyItem, cost: number, requires: string[]) {
  const sd = shopById(shop);
  const sh = shelfById(`shelf_${shop}_${item}`);
  add(`goods_${shop}_${item}`, "build", sd.zone, sh.box.x, sh.box.z, scaled(shop, cost), requires, city([supplyId(sd.zone, item)], [sh.id]), ITEMS[item].name, ITEMS[item].icon, { size: 2.4 });
}

/** A kitchen with the pallets it needs and a counter for what it makes. */
function kitchen(shop: ShopId, id: string, requires: string[], pallets: SupplyItem[], product: ItemId) {
  const sd = shopById(shop);
  const m = machineById(id);
  const t = MACHINE_TYPES[m.type];
  add(`build_${id}`, "build", sd.zone, m.x, m.z + t.size[1] / 2 + 1.25, m.cost, requires, city([id, ...pallets.map((p) => supplyId(sd.zone, p))], [`shelf_${shop}_${product}`]), t.name, "🏗️", { size: 2.3 });
  add(`up_${id}`, "upgrade", sd.zone, m.x + t.upPad[0], m.z + t.upPad[1], m.cost * 0.6, [`build_${id}`], { type: "upgradeMachine", id }, t.name, "⬆️", { size: 1.9, repeatable: true });
}

function hire(shop: ShopId, id: string, name: string, job: WorkerJob, cost: number, requires: string[], at?: { x: number; z: number }) {
  const sd = shopById(shop);
  const p = at ?? nextSpot(shop);
  const icon = job.kind === "cashier" ? "🧑‍💼" : job.kind === "collector" ? "💼" : job.kind === "operator" ? "👨‍🍳" : "📦";
  add(`hire_${id}`, "hire", sd.zone, p.x, p.z, scaled(shop, cost), requires, { type: "worker", worker: { id, name, job } }, name, icon);
}

const cashier = (shop: ShopId, cost: number, requires: string[]) => hire(shop, `cash_${shop}`, "Кассир", { kind: "cashier", shop }, cost, requires);
function collector(shop: ShopId, cost: number, requires: string[]) {
  const s = shopById(shop);
  hire(shop, `coll_${shop}`, "Инкассатор", { kind: "collector", shop }, cost, requires, { x: s.cx + COLLECTOR_SPOT[0], z: s.cz + COLLECTOR_SPOT[1] });
}
const toShelf = (id: string): WorkerTarget => ({ kind: "shelf", id });
const toMachine = (id: string): WorkerTarget => ({ kind: "machine", id });

/** A carrier: pallet or kitchen → counter, kitchen or delivery. */
function carry(shop: ShopId, id: string, source: string, target: WorkerTarget, cost: number, requires: string[]) {
  hire(shop, id, "Грузчик", { kind: "carrier", source, target }, cost, requires);
}

/** A cook: makes the kitchen faster. The pad stands where the cook will. */
function cook(shop: ShopId, machine: string, cost: number, requires: string[]) {
  const m = machineById(machine);
  const t = MACHINE_TYPES[m.type];
  hire(shop, `op_${machine}`, "Повар", { kind: "operator", machine }, cost, requires, { x: m.x + t.opSpot[0], z: m.z + t.opSpot[1] });
}

function tablePad(shop: ShopId, slot: number, cost: number, requires: string[]) {
  const t = TABLES.find((x) => x.id === `table_${shop}_${slot}`)!;
  add(`table_${shop}_${slot}`, "build", shopById(shop).zone, t.x, t.z, scaled(shop, cost), requires, city([], [], [t.id]), "Столик", "🪑", { size: 1.9 });
}

function deliveryPad(shop: ShopId, cost: number, requires: string[]) {
  const s = shopById(shop);
  add(`delivery_${shop}`, "build", s.zone, s.delivery!.x, s.delivery!.z, scaled(shop, cost), requires, city([], [], [], shop), "Доставка", "🛵", { size: 2.2 });
}

/** The three repeatable upgrades every business has. */
function upgrades(shop: ShopId, requires: { level: string; ads: string; van: string }) {
  const s = shopById(shop);
  const b = s.upgradeBase;
  add(`shop_${shop}`, "upgrade", s.zone, s.cx + SHOP_LEVEL_SPOT[0], s.cz + SHOP_LEVEL_SPOT[1], b, [requires.level], { type: "shopLevel", shop }, "Ремонт", "⬆️", { size: 1.9, repeatable: true });
  add(`ads_${shop}`, "upgrade", s.zone, s.cx + SHOP_ADS_SPOT[0], s.cz + SHOP_ADS_SPOT[1], b * ADS_COST_MULT, [requires.ads], { type: "shopAds", shop }, "Реклама", "📣", { size: 1.9, repeatable: true });
  add(`van_${shop}`, "upgrade", s.zone, s.cx + SHOP_VAN_SPOT[0], s.cz + SHOP_VAN_SPOT[1], b * VAN_COST_MULT, [requires.van], { type: "shopVan", shop }, "Фургон", "🚐", { size: 1.9, repeatable: true });
}

function plot(id: CityZoneId, at: ShopId, lx: number, lz: number, cost: number, requires: string[]) {
  const s = shopById(at);
  const z = zoneOf(id);
  add(`zone_${id}`, "land", s.zone, s.cx + lx, s.cz + lz, cityPrice(cost, id), requires, { type: "zone", id }, z.name, z.icon, { size: 2.6 });
}

// ── Лавка ───────────────────────────────────────────────────────────────
goods("lavka", "egg", 40, []);
cashier("lavka", 120, ["goods_lavka_egg"]);
carry("lavka", "c_l_bread", supplyId("c_lavka", "bread"), toShelf("shelf_lavka_bread"), 180, ["hire_cash_lavka"]);
goods("lavka", "milk", 180, ["hire_cash_lavka"]);
carry("lavka", "c_l_egg", supplyId("c_lavka", "egg"), toShelf("shelf_lavka_egg"), 320, ["hire_c_l_bread"]);
collector("lavka", 450, ["hire_c_l_egg"]);
carry("lavka", "c_l_milk", supplyId("c_lavka", "milk"), toShelf("shelf_lavka_milk"), 600, ["goods_lavka_milk", "hire_c_l_egg"]);
upgrades("lavka", { level: "goods_lavka_egg", ads: "hire_cash_lavka", van: "hire_c_l_bread" });
plot("c_cafe", "lavka", 11.7, -6.4, 1_800, ["hire_coll_lavka", "hire_c_l_milk"]);

// ── Кафе ────────────────────────────────────────────────────────────────
goods("cafe", "juice", 1_200, ["zone_c_cafe"]);
cashier("cafe", 900, ["goods_cafe_juice"]);
goods("cafe", "cheese", 2_000, ["hire_cash_cafe"]);
carry("cafe", "c_c_juice", supplyId("c_cafe", "juice"), toShelf("shelf_cafe_juice"), 1_400, ["hire_cash_cafe"]);
tablePad("cafe", 0, 1_000, ["hire_cash_cafe"]);
tablePad("cafe", 1, 1_800, ["table_cafe_0"]);
carry("cafe", "c_c_cheese", supplyId("c_cafe", "cheese"), toShelf("shelf_cafe_cheese"), 2_400, ["goods_cafe_cheese", "hire_c_c_juice"]);
kitchen("cafe", "coffee", ["hire_c_c_cheese"], ["milk"], "latte");
carry("cafe", "c_c_milk", supplyId("c_cafe", "milk"), toMachine("coffee"), 3_000, ["build_coffee"]);
carry("cafe", "c_c_latte", "coffee", toShelf("shelf_cafe_latte"), 3_600, ["hire_c_c_milk"]);
collector("cafe", 4_000, ["hire_c_c_latte"]);
tablePad("cafe", 2, 4_000, ["hire_c_c_latte"]);
kitchen("cafe", "sandwich", ["hire_coll_cafe"], ["bread"], "sandwich");
carry("cafe", "c_c_bread", supplyId("c_cafe", "bread"), toMachine("sandwich"), 7_000, ["build_sandwich"]);
carry("cafe", "c_c_ch2", supplyId("c_cafe", "cheese"), toMachine("sandwich"), 8_000, ["hire_c_c_bread"]);
carry("cafe", "c_c_sand", "sandwich", toShelf("shelf_cafe_sandwich"), 9_000, ["hire_c_c_ch2"]);
tablePad("cafe", 3, 9_000, ["hire_c_c_sand"]);
cook("cafe", "coffee", 6_000, ["hire_c_c_latte"]);
cook("cafe", "sandwich", 12_000, ["hire_c_c_sand"]);
upgrades("cafe", { level: "goods_cafe_juice", ads: "hire_cash_cafe", van: "hire_c_c_juice" });
plot("c_pizza", "lavka", -11.7, -6.4, 18_000, ["hire_c_c_sand"]);

// ── Пиццерия ────────────────────────────────────────────────────────────
goods("pizza", "juice", 15_000, ["zone_c_pizza"]);
cashier("pizza", 9_000, ["goods_pizza_juice"]);
goods("pizza", "sauce", 20_000, ["hire_cash_pizza"]);
carry("pizza", "c_p_juice", supplyId("c_pizza", "juice"), toShelf("shelf_pizza_juice"), 14_000, ["hire_cash_pizza"]);
carry("pizza", "c_p_sauce", supplyId("c_pizza", "sauce"), toShelf("shelf_pizza_sauce"), 20_000, ["goods_pizza_sauce", "hire_c_p_juice"]);
tablePad("pizza", 0, 12_000, ["hire_c_p_juice"]);
kitchen("pizza", "oven", ["hire_c_p_sauce"], ["flour", "cheese"], "pizza");
carry("pizza", "c_p_flour", supplyId("c_pizza", "flour"), toMachine("oven"), 30_000, ["build_oven"]);
carry("pizza", "c_p_sauce2", supplyId("c_pizza", "sauce"), toMachine("oven"), 35_000, ["hire_c_p_flour"]);
carry("pizza", "c_p_cheese", supplyId("c_pizza", "cheese"), toMachine("oven"), 40_000, ["hire_c_p_sauce2"]);
carry("pizza", "c_p_pizza", "oven", toShelf("shelf_pizza_pizza"), 48_000, ["hire_c_p_cheese"]);
collector("pizza", 40_000, ["hire_c_p_pizza"]);
tablePad("pizza", 1, 30_000, ["hire_c_p_pizza"]);
tablePad("pizza", 2, 55_000, ["table_pizza_1"]);
deliveryPad("pizza", 70_000, ["hire_coll_pizza"]);
carry("pizza", "c_p_deliv", "oven", { kind: "delivery", shop: "pizza" }, 90_000, ["delivery_pizza"]);
cook("pizza", "oven", 80_000, ["hire_c_p_pizza"]);
upgrades("pizza", { level: "goods_pizza_juice", ads: "hire_cash_pizza", van: "hire_c_p_juice" });
plot("c_fish", "cafe", 11.7, -6.4, 150_000, ["hire_c_p_pizza"]);

// ── Рыбный ресторан ─────────────────────────────────────────────────────
goods("fish", "smokedfish", 120_000, ["zone_c_fish"]);
cashier("fish", 70_000, ["goods_fish_smokedfish"]);
goods("fish", "canned", 200_000, ["hire_cash_fish"]);
carry("fish", "c_f_smoked", supplyId("c_fish", "smokedfish"), toShelf("shelf_fish_smokedfish"), 110_000, ["hire_cash_fish"]);
tablePad("fish", 0, 90_000, ["hire_cash_fish"]);
tablePad("fish", 1, 150_000, ["table_fish_0"]);
carry("fish", "c_f_canned", supplyId("c_fish", "canned"), toShelf("shelf_fish_canned"), 180_000, ["goods_fish_canned", "hire_c_f_smoked"]);
kitchen("fish", "grill", ["hire_c_f_canned"], ["sauce"], "fishdish");
carry("fish", "c_f_smoked2", supplyId("c_fish", "smokedfish"), toMachine("grill"), 260_000, ["build_grill"]);
carry("fish", "c_f_sauce", supplyId("c_fish", "sauce"), toMachine("grill"), 300_000, ["hire_c_f_smoked2"]);
carry("fish", "c_f_dish", "grill", toShelf("shelf_fish_fishdish"), 360_000, ["hire_c_f_sauce"]);
collector("fish", 320_000, ["hire_c_f_dish"]);
tablePad("fish", 2, 300_000, ["hire_c_f_dish"]);
tablePad("fish", 3, 480_000, ["table_fish_2"]);
tablePad("fish", 4, 700_000, ["table_fish_3"]);
deliveryPad("fish", 500_000, ["hire_coll_fish"]);
carry("fish", "c_f_deliv", "grill", { kind: "delivery", shop: "fish" }, 650_000, ["delivery_fish"]);
cook("fish", "grill", 550_000, ["hire_c_f_dish"]);
upgrades("fish", { level: "goods_fish_smokedfish", ads: "hire_cash_fish", van: "hire_c_f_smoked" });
plot("c_sweets", "fish", -11.7, -6.4, 900_000, ["hire_c_f_dish"]);
plot("c_park", "fish", 11.7, -9.4, 600_000, ["hire_coll_fish"]);

// ── Кондитерская ────────────────────────────────────────────────────────
goods("sweets", "cake", 700_000, ["zone_c_sweets"]);
cashier("sweets", 400_000, ["goods_sweets_cake"]);
carry("sweets", "c_s_cake", supplyId("c_sweets", "cake"), toShelf("shelf_sweets_cake"), 600_000, ["hire_cash_sweets"]);
tablePad("sweets", 0, 500_000, ["hire_cash_sweets"]);
kitchen("sweets", "pastry", ["hire_c_s_cake"], ["flour", "egg"], "eclair");
carry("sweets", "c_s_flour", supplyId("c_sweets", "flour"), toMachine("pastry"), 800_000, ["build_pastry"]);
carry("sweets", "c_s_egg", supplyId("c_sweets", "egg"), toMachine("pastry"), 900_000, ["hire_c_s_flour"]);
carry("sweets", "c_s_eclair", "pastry", toShelf("shelf_sweets_eclair"), 1_100_000, ["hire_c_s_egg"]);
goods("sweets", "honey", 2_000_000, ["hire_c_s_eclair"]);
carry("sweets", "c_s_honey", supplyId("c_sweets", "honey"), toShelf("shelf_sweets_honey"), 1_600_000, ["goods_sweets_honey"]);
collector("sweets", 1_800_000, ["hire_c_s_honey"]);
tablePad("sweets", 1, 1_500_000, ["hire_c_s_honey"]);
kitchen("sweets", "honeycake", ["hire_coll_sweets"], [], "medovik");
carry("sweets", "c_s_cake2", supplyId("c_sweets", "cake"), toMachine("honeycake"), 2_800_000, ["build_honeycake"]);
carry("sweets", "c_s_honey2", supplyId("c_sweets", "honey"), toMachine("honeycake"), 3_200_000, ["hire_c_s_cake2"]);
carry("sweets", "c_s_medovik", "honeycake", toShelf("shelf_sweets_medovik"), 3_800_000, ["hire_c_s_honey2"]);
tablePad("sweets", 2, 2_800_000, ["hire_c_s_medovik"]);
tablePad("sweets", 3, 4_000_000, ["table_sweets_2"]);
cook("sweets", "pastry", 2_400_000, ["hire_c_s_eclair"]);
cook("sweets", "honeycake", 5_000_000, ["hire_c_s_medovik"]);
upgrades("sweets", { level: "goods_sweets_cake", ads: "hire_cash_sweets", van: "hire_c_s_cake" });
plot("c_fashion", "pizza", -11.7, -9.4, 5_000_000, ["hire_c_s_medovik"]);

// ── Модный дом ──────────────────────────────────────────────────────────
goods("fashion", "yarn", 5_000_000, ["zone_c_fashion"]);
cashier("fashion", 2_500_000, ["goods_fashion_yarn"]);
carry("fashion", "c_m_yarn", supplyId("c_fashion", "yarn"), toShelf("shelf_fashion_yarn"), 3_500_000, ["hire_cash_fashion"]);
goods("fashion", "sweater", 8_000_000, ["hire_c_m_yarn"]);
carry("fashion", "c_m_sweater", supplyId("c_fashion", "sweater"), toShelf("shelf_fashion_sweater"), 6_000_000, ["goods_fashion_sweater"]);
collector("fashion", 8_000_000, ["hire_c_m_sweater"]);
kitchen("fashion", "tailor", ["hire_coll_fashion"], [], "coat");
carry("fashion", "c_m_sw2", supplyId("c_fashion", "sweater"), toMachine("tailor"), 12_000_000, ["build_tailor"]);
carry("fashion", "c_m_y2", supplyId("c_fashion", "yarn"), toMachine("tailor"), 14_000_000, ["hire_c_m_sw2"]);
carry("fashion", "c_m_coat", "tailor", toShelf("shelf_fashion_coat"), 17_000_000, ["hire_c_m_y2"]);
cook("fashion", "tailor", 22_000_000, ["hire_c_m_coat"]);
upgrades("fashion", { level: "goods_fashion_yarn", ads: "hire_cash_fashion", van: "hire_c_m_yarn" });
plot("c_store", "fashion", -11.7, -9.4, 30_000_000, ["hire_c_m_coat"]);

// ── Универмаг ───────────────────────────────────────────────────────────
goods("store", "jam", 35_000_000, ["zone_c_store"]);
cashier("store", 15_000_000, ["goods_store_jam"]);
carry("store", "c_u_jam", supplyId("c_store", "jam"), toShelf("shelf_store_jam"), 20_000_000, ["hire_cash_store"]);
goods("store", "lantern", 50_000_000, ["hire_c_u_jam"]);
carry("store", "c_u_lantern", supplyId("c_store", "lantern"), toShelf("shelf_store_lantern"), 30_000_000, ["goods_store_lantern"]);
goods("store", "icecream", 70_000_000, ["hire_c_u_lantern"]);
carry("store", "c_u_ice", supplyId("c_store", "icecream"), toShelf("shelf_store_icecream"), 42_000_000, ["goods_store_icecream"]);
collector("store", 48_000_000, ["hire_c_u_ice"]);
goods("store", "pie", 100_000_000, ["hire_coll_store"]);
carry("store", "c_u_pie", supplyId("c_store", "pie"), toShelf("shelf_store_pie"), 60_000_000, ["goods_store_pie"]);
kitchen("store", "packer", ["hire_c_u_pie"], [], "giftbox");
carry("store", "c_u_jam2", supplyId("c_store", "jam"), toMachine("packer"), 85_000_000, ["build_packer"]);
carry("store", "c_u_lantern2", supplyId("c_store", "lantern"), toMachine("packer"), 100_000_000, ["hire_c_u_jam2"]);
carry("store", "c_u_gift", "packer", toShelf("shelf_store_giftbox"), 120_000_000, ["hire_c_u_lantern2"]);
deliveryPad("store", 130_000_000, ["hire_c_u_gift"]);
carry("store", "c_u_deliv", "packer", { kind: "delivery", shop: "store" }, 150_000_000, ["delivery_store"]);
cook("store", "packer", 140_000_000, ["hire_c_u_gift"]);
upgrades("store", { level: "goods_store_jam", ads: "hire_cash_store", van: "hire_c_u_jam" });
plot("c_tower", "sweets", 11.7, -9.4, 80_000_000, ["hire_c_u_jam"]);

// ── Башня ───────────────────────────────────────────────────────────────
add("tower_floor", "special", "c_tower", TOWER.x, TOWER.z + TOWER.d / 2 + 2.2, FLOOR_COSTS[0], ["zone_c_tower"], { type: "towerFloor" }, "Этаж башни", "🏙️", { size: 2.8, repeatable: true });

export const CITY_PADS: readonly PadDef[] = LIST;

// ── numbers ─────────────────────────────────────────────────────────────
export const shopPriceMult = (level: number) => 1 + 0.12 * (level - 1);
export const shopUpgradeCost = (base: number, level: number) => Math.round(base * Math.pow(1.85, level - 1));
export const shelfCapacity = (level: number) => 16 + 4 * (level - 1);
export const adsSpeed = (ads: number) => 1 + 0.3 * (ads - 1);
/** Seconds between customers at the first advertising level. */
export const CUSTOMER_INTERVAL = 3.5;
export const shopMaxCustomers = (ads: number, tables: number) => 3 + ads + tables;
/** How many different things a customer wants, by the level of the place. */
export const customerWants = (level: number) => 1 + Math.floor(level / 4);

/** Seconds a customer keeps waiting by an empty counter before giving up on it. */
export const CUSTOMER_PATIENCE = 14;
export const CUSTOMER_SPEED = 2.2;
/** Seconds per customer at the till. */
export const PLAYER_SERVE = 0.55;
export const cashierServe = (level: number) => 1.5 / (1 + 0.15 * (level - 1));

export const TABLE_EAT_TIME = 7;
/** Tip left by a guest who ate at a table, as a share of the bill. */
export const TABLE_TIP = 0.3;
export const AUTUMN_TIP_MULT = 1.5;
export const SPRING_CUSTOMERS = 1.15;

/** A delivery pays more than the counter. */
export const DELIVERY_MULT = 1.3;

export const VAN_MAX_LEVEL = 10;
export const vanLoad = (level: number) => 16 + 8 * (level - 1);
/** A pallet holds this much at most: the van does not bury the pavement. */
export const palletCapacity = (vanLevel: number) => 24 + 8 * (vanLevel - 1);
export const VAN_TRIP = 9;
export const VAN_DRIVE = 2.4;
export const VAN_UNLOAD_EVERY = 0.09;

/** Where a van starts its way and ends it (relative to the bay, along the road). */
export const VAN_FAR = 34;

/** Lunchtime and evening bring more people; at night the streets are quiet. */
export function dayRush(timeOfDay: number) {
  if (timeOfDay >= 0.34 && timeOfDay < 0.46) return 1.5;
  if (timeOfDay >= 0.66 && timeOfDay < 0.78) return 1.5;
  if (timeOfDay >= 0.88 || timeOfDay < 0.04) return 0.65;
  return 1;
}
export const isRushHour = (timeOfDay: number) => dayRush(timeOfDay) > 1;

/** The park draws people to every business. */
export const PARK_CUSTOMERS = 1.2;

/** "Копеечка": what the farm's manager sends over, per machine, per second. */
export const FARM_PENNY_PER_MACHINE = 0.15;
export const FARM_PENNY_EVERY = 30;

/** Money a newcomer steps off the bus with. */
export const CITY_START_MONEY = 40;

/** City fame on the farm: every business open, and each floor of the tower. */
export const FAME_PER_SHOP = 0.03;
export const FAME_PER_FLOOR = 0.04;

/** Stars for finishing the chapter, and for each business opened. */
export const TOWER_STARS = 40;
export const SHOP_STARS = 2;

/** In town the merchant parks his cart on a free stretch by the road. */
export const CITY_MERCHANT_SPOTS: Partial<Record<CityZoneId, { x: number; z: number }>> = Object.fromEntries(SHOPS.map((s) => [s.zone, { x: s.cx - 3.9, z: s.cz + 4.6 }]));

/** Blogger: from time to time a business gets famous for a while. */
export const BLOGGER_EVERY = { min: 300, spread: 240 };
export const BLOGGER_FIRST = 240;
export const BLOGGER_TIME = 40;
export const BLOGGER_MULT = 2.5;

/** Goods in demand in the city, by season. */
export const CITY_DEMAND = {
  spring: ["egg", "eclair", "jam"],
  summer: ["juice", "pizza", "icecream"],
  autumn: ["sandwich", "fishdish", "pie"],
  winter: ["latte", "medovik", "coat"],
} as const satisfies Record<string, readonly ItemId[]>;

export const CITY_SEASON_PERK = {
  spring: "покупателей на 15% больше",
  summer: "работники бегают на 15% быстрее",
  autumn: "чаевые в полтора раза больше",
  winter: "кухни работают на 20% быстрее",
} as const;

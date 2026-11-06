import type { Rect } from "../core/math";
import type { PlayerStatId, WorkerStatId } from "../data/balance";
import type { ChallengeId } from "../data/challenges";
import type { ShelfDef, ShopDef, ShopId, TableDef } from "../data/city";
import type { CropDef } from "../data/crops";
import type { HatId } from "../data/hats";
import type { PerkId } from "../data/legacy";
import type { ItemId } from "../data/items";
import type { FieldDef, MachineDef, PadDef, PadKind, WorkerDef, ZoneId } from "../data/layout";
import type { MachineTypeDef } from "../data/machines";
import type { SeasonId } from "./seasons";
import type { WeatherKind } from "./weather";

/** Anything that walks and carries a stack: the player and the workers. */
export interface Actor {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Y-rotation; forward = (sin, cos). */
  facing: number;
  stack: ItemId[];
  /** Items already in `stack` that are still flying in (rendered hidden). */
  incoming: number;
  capacity: number;
  speed: number;
  moving: boolean;
  /** Walk-cycle phase, advances with distance travelled. */
  walk: number;
  zoneId: string | null;
  zoneTime: number;
  transferCd: number;
  /** Stack lean spring (local space), purely visual. */
  lean: { x: number; z: number; vx: number; vz: number };
  /** Seconds since the stack last bumped into its capacity. */
  fullT: number;
}

export interface Player extends Actor {
  reach: number;
}

export type WorkerPhase =
  | "spawn"
  | "harvest"
  | "toSource"
  | "collect"
  | "toTarget"
  | "drop"
  | "toSpot"
  | "operate";

export interface PathPoint {
  x: number;
  z: number;
}

export interface Worker extends Actor {
  def: WorkerDef;
  reach: number;
  phase: WorkerPhase;
  path: PathPoint[];
  pathIdx: number;
  /** The only interaction zone this worker may use right now. */
  targetZone: string | null;
  wait: number;
  stuck: number;
  repath: number;
  spawnT: number;
  /** Personal offset inside target zones so workers don't overlap perfectly. */
  jitter: PathPoint;
  harvestTarget: { field: number; plant: number } | null;
}

export interface Plant {
  /** Where a worker stands to reach it (differs only for fishing spots). */
  sx: number;
  sz: number;
  x: number;
  z: number;
  /** 0..1, 1 = ripe (plants) */
  growth: number;
  /** Ripe fruits on a tree. */
  fruits: number;
  /** Tree regrow timer. */
  timer: number;
  /** Seconds since last harvest/ripening — drives the bounce animation. */
  pop: number;
  /** Stable per-plant random in [0,1). */
  seed: number;
}

export interface Field {
  id: string;
  def: FieldDef;
  crop: CropDef;
  plants: Plant[];
  rect: Rect;
  spawnT: number;
}

export interface Machine {
  id: string;
  def: MachineDef;
  type: MachineTypeDef;
  level: number;
  inputs: Partial<Record<ItemId, number>>;
  output: number;
  progress: number;
  working: boolean;
  operator: boolean;
  incomingIn: Partial<Record<ItemId, number>>;
  incomingOut: number;
  body: Rect;
  inRect: Rect;
  outRect: Rect;
  spawnT: number;
  /** 1 → 0 after receiving an item / producing. */
  pulse: number;
  produced: number;
  idle: "input" | "output" | null;
}

export interface PadState {
  id: string;
  def: PadDef;
  paid: number;
  /** Current level for repeatable upgrade pads. */
  level: number;
  done: boolean;
  visible: boolean;
  /** Seconds since the pad became visible. */
  appearT: number;
}

export type TruckPhase = "away" | "arrive" | "load" | "leave";

export interface Truck {
  id: string;
  phase: TruckPhase;
  t: number;
  x: number;
  z: number;
  cargo: ItemId[];
  incoming: number;
  wait: number;
  loadCd: number;
}

export interface Depot {
  storage: ItemId[];
  incoming: number;
  truckLevel: number;
  trucks: Truck[];
}

export type InteractKind = "machineIn" | "machineOut" | "market" | "depot" | "pad" | "farmhouse" | "trash" | "merchant" | "bus" | "shelf" | "till" | "cash" | "delivery";

/** What a golden plant gives: a sales rush, a bag of money or every field ripe at once. */
export type GoldenReward = "rush" | "money" | "bloom";

export interface InteractZone {
  id: string;
  kind: InteractKind;
  ref: string;
  rect: Rect;
}

export type Anchor =
  | { kind: "stack"; actor: string; slot: number }
  | { kind: "pileIn"; machine: string; item: ItemId; slot: number }
  | { kind: "pileOut"; machine: string; slot: number }
  | { kind: "depot"; slot: number }
  | { kind: "truck"; truck: string; slot: number }
  | { kind: "actor"; actor: string }
  | { kind: "point"; x: number; y: number; z: number }
  | { kind: "shelf"; shelf: string; slot: number }
  | { kind: "cash"; shop: string; slot: number };

export type FlightItem = ItemId | "coin" | "cash";

export interface Flight {
  item: FlightItem;
  fx: number;
  fy: number;
  fz: number;
  to: Anchor;
  t: number;
  dur: number;
  arc: number;
  spin: number;
  /** Event fired when the flight lands. */
  land?: GameEvent;
}

export interface Stats {
  earned: number;
  harvested: number;
  sold: number;
  produced: number;
  purchases: number;
  playTime: number;
  orders: number;
  /** Fairs (seasonal orders) completed. */
  fairs: number;
  /** Season changes lived through. */
  seasons: number;
  /** Fish caught at night. */
  nightFish: number;
  /** Harvests made in the rain. */
  rainHarvest: number;
  /** Extra items from the autumn bonus. */
  bonusHarvest: number;
  /** Golden plants collected. */
  golden: number;
  /** Merchant visits served in full. */
  merchants: number;
  /** Runaway animals caught. */
  caught: number;
  /** Times the foreman's whistle was blown. */
  whistles: number;
  /** Family records beaten (a plot or the statue sooner than ever). */
  records: number;
  /** City: customers served at a till. */
  served: number;
  /** City: goods handed to couriers. */
  delivered: number;
}

/** One generation in the family chronicle. */
export interface ChronicleEntry {
  /** 1 = the founders. */
  gen: number;
  /** Seconds of play to the Golden Statue. */
  statue: number;
  /** Seconds the generation farmed before handing over. */
  played: number;
  stars: number;
  challenges: ChallengeId[];
}

/** The travelling merchant: parks his cart at a plot's edge and buys one kind of goods. */
export interface Merchant {
  zone: ZoneId;
  x: number;
  z: number;
  item: ItemId;
  need: number;
  have: number;
  /** Money he has paid so far. */
  earned: number;
  /** Seconds left before he gives up and drives on. */
  t: number;
  phase: "arrive" | "wait" | "leave";
  /** 0 … 1: how far the cart has rolled in. */
  anim: number;
}

export type RunawayKind = "chicken" | "cow" | "sheep";

/** An animal that slipped out of its pen and wanders the farm, dodging the farmer. */
export interface Runaway extends Actor {
  kind: RunawayKind;
  /** Where it got out — and where it trots back to. */
  homeX: number;
  homeZ: number;
  /** Where it is wandering to, and how long it dawdles there. */
  tx: number;
  tz: number;
  pause: number;
  /** Seconds before it gets bored and goes home by itself. */
  t: number;
  /** Seconds it has been trying to get home (it hops there if stuck). */
  homing: number;
  /** Seconds it has been walking into a wall while wandering. */
  stuck: number;
}

/** Little events "in between": golden plants, the merchant, runaways, the whistle. */
export interface Surprises {
  /** RNG state: events are reproducible in tests and survive a reload. */
  seed: number;
  goldenIn: number;
  golden: { field: string; plant: number; t: number } | null;
  /** Seconds of "gold rush" left: every sale pays double. */
  rush: number;
  merchantIn: number;
  merchant: Merchant | null;
  runawayIn: number;
  runaway: Runaway | null;
  /** Seconds the foreman's whistle still works / until it can be blown again. */
  whistle: number;
  whistleCd: number;
}

// ── the city ────────────────────────────────────────────────────────────
export interface ShelfState {
  id: string;
  def: ShelfDef;
  count: number;
  incoming: number;
  /** Seconds since it was built. */
  spawnT: number;
}

export interface TableState {
  id: string;
  def: TableDef;
  /** Guests on each of the two seats (null = free). */
  seats: [Customer | null, Customer | null];
  spawnT: number;
}

export type VanPhase = "away" | "arrive" | "unload" | "leave";

/** The farm's van: drives up the road, unloads onto the business's pallets, drives on. */
export interface Van {
  phase: VanPhase;
  t: number;
  x: number;
  z: number;
  level: number;
  /** Goods left to unload on this trip. */
  load: number;
  cd: number;
}

export interface ShopState {
  id: ShopId;
  def: ShopDef;
  level: number;
  ads: number;
  van: Van;
  shelves: ShelfState[];
  tables: TableState[];
  /** Money waiting to be picked up, and the bundles it is shown as. */
  cash: number;
  bundles: number;
  incomingCash: number;
  /** Customers in line, the first one is at the till. */
  queue: Customer[];
  /** Seconds until the next customer. */
  spawnT: number;
  /** Progress with the customer at the till, in seconds. */
  serveT: number;
  /** A hired cashier is standing at the till. */
  cashier: boolean;
  /** A hired collector is looking after the money table. */
  collector: boolean;
  delivery: boolean;
  /** Seconds of "the whole town is talking about it" left. */
  buzz: number;
  /** 1 → 0 when a customer has been served. */
  pulse: number;
}

export type CustomerPhase = "none" | "enter" | "toShelf" | "pick" | "toQueue" | "queue" | "toTable" | "eat" | "leave" | "out";

/** Someone who came to buy something. Pooled: renderers keep one character per slot. */
export interface Customer extends Actor {
  shop: ShopId | null;
  cphase: CustomerPhase;
  scale: number;
  path: PathPoint[];
  pathIdx: number;
  /** What is still on the shopping list; the first one is being looked for. */
  want: ItemId[];
  /** Seconds left at an empty counter. */
  patience: number;
  /** Generic countdown: browsing, eating. */
  t: number;
  /** What the goods on the stack cost. */
  bill: number;
  /** Paid and carrying a bag. */
  bag: boolean;
  /** At a table, eating this. */
  dish: ItemId | null;
  seat: { table: TableState; seat: 0 | 1 } | null;
}

export interface CityState {
  shops: ShopState[];
  customers: Customer[];
  /** Floors of the tower built so far. */
  floors: number;
  /** The tower is finished: the chapter is over. */
  finished: boolean;
  /** The farm's "копеечка": money per second, money on its way, seconds to the next payment. */
  penny: number;
  pennyAcc: number;
  pennyT: number;
  bloggerIn: number;
  /** Rush hour right now (for a toast when it begins). */
  rushHour: boolean;
}

export interface GameState {
  /** Which map this is: the farm, or the city of chapter II. */
  world: "farm" | "city";
  /** The city's own entities; null on the farm. */
  city: CityState | null;
  /** The family has built the statue once: the bus to the city runs. */
  bus: boolean;
  time: number;
  money: number;
  player: Player;
  playerLevels: Record<PlayerStatId, number>;
  workerLevels: Record<WorkerStatId, number>;
  marketLevel: number;
  zones: Set<ZoneId>;
  fields: Field[];
  machines: Machine[];
  workers: Worker[];
  pads: PadState[];
  depot: Depot | null;
  statue: boolean;
  flights: Flight[];
  interact: InteractZone[];
  obstacles: Rect[];
  stats: Stats;
  /** Index into TUTORIAL; >= TUTORIAL.length means finished. */
  tutorial: number;
  /**
   * Prestige: stars to spend in the legacy shop, stars earned over all
   * generations, and how many generations have farmed here.
   */
  prestige: { stars: number; totalStars: number; generations: number };
  /** Levels of the legacy shop's family upgrades. */
  legacy: Partial<Record<PerkId, number>>;
  /** Money earned by this generation — basis for prestige stars. */
  runEarned: number;
  /** Rolling estimate of automated income per second (for offline). */
  autoIncome: {
    acc: number;
    window: number;
    rate: number;
    /** A gold rush or the whistle touched this window: it says nothing about the usual income. */
    skip: boolean;
  };
  /** Seconds of play since the farm was founded — drives the day/night cycle and the seasons. */
  dayClock: number;
  /** Current season (derived from dayClock, kept in sync by the tick). */
  season: SeasonId;
  /** Weather that is properly under way right now (derived from dayClock). */
  weather: WeatherKind;
  /** Current market order (null while the next one is on cooldown). */
  order: Order | null;
  /** Serial number of the last season that had its fair (-1 = none yet). */
  lastFair: number;
  /** Goods made by machines, per item (kept across generations, like stats). */
  made: Partial<Record<ItemId, number>>;
  /** Unlocked achievements (kept across generations). */
  achievements: Set<string>;
  achievementTimer: number;
  /** Finds glued into the album (kept across generations). */
  album: Set<string>;
  surprises: Surprises;
  /** The challenges this generation took on. */
  challenges: ChallengeId[];
  /** When (dayClock seconds) this generation bought each plot and the statue. */
  genTimes: Partial<Record<string, number>>;
  /** The family's best times for the same (kept across generations). */
  records: Partial<Record<string, number>>;
  /** Every generation that handed the farm over (kept across generations). */
  chronicle: ChronicleEntry[];
  /** The farmer's hat (kept across generations). */
  hat: HatId;
  orderCooldown: number;
  /** Increments whenever entities appear/disappear — React re-renders on it. */
  structure: number;
}

export type GameEvent =
  | { type: "harvest"; item: ItemId; x: number; z: number; player: boolean }
  | { type: "drop"; item: ItemId; player: boolean; x: number; z: number }
  | { type: "pick"; item: ItemId; player: boolean; x: number; z: number }
  | { type: "sell"; item: ItemId; value: number; player: boolean }
  | { type: "saleLand"; value: number; x: number; y: number; z: number }
  | { type: "padTick"; pad: string; x: number; z: number }
  | { type: "purchase"; pad: string; kind: PadKind; label: string; x: number; z: number }
  | { type: "levelUp"; pad: string; level: number; x: number; z: number }
  | { type: "full"; actor: string }
  | { type: "produce"; machine: string; item: ItemId }
  | { type: "zone"; kind: InteractKind | null; ref: string | null }
  | { type: "toast"; text: string; icon: string }
  | { type: "truckSold"; value: number; x: number; z: number }
  | { type: "tutorial"; step: number }
  | { type: "statue" }
  | { type: "trashed"; item: ItemId; x: number; z: number }
  | { type: "order"; state: "new" | "fair" | "expired" | "done"; reward?: number; fair?: boolean }
  | { type: "dayPhase"; phase: "night" | "dawn" }
  | { type: "season"; season: SeasonId }
  | { type: "weather"; kind: WeatherKind; from: WeatherKind }
  | { type: "achievement"; id: string }
  | { type: "perk"; perk: PerkId; level: number }
  | { type: "golden"; state: "spawn" | "fade"; x: number; z: number }
  | { type: "golden"; state: "collect"; reward: GoldenReward; value: number; x: number; z: number }
  | { type: "rushEnd" }
  | { type: "merchant"; state: "arrive" | "done" | "leave"; x: number; z: number; item: ItemId; need: number; earned?: number }
  | { type: "runaway"; state: "escape" | "caught" | "home"; kind: RunawayKind; x: number; z: number; value?: number }
  | { type: "find"; id: string; complete: boolean; x: number; z: number }
  | { type: "whistle"; state: "start" | "end" }
  /** A plot (zone id) or the statue ("statue") came sooner than the family record. */
  | { type: "record"; key: string; time: number; prev: number }
  /** Autumn: a harvest gave one item extra. */
  | { type: "bonusHarvest"; item: ItemId; x: number; z: number; player: boolean }
  /** City: a customer paid at the till. */
  | { type: "served"; shop: ShopId; value: number; x: number; z: number }
  /** City: a tip landed on the money table. */
  | { type: "tip"; value: number; x: number; z: number }
  /** City: nobody had what this customer wanted. */
  | { type: "sad"; x: number; z: number }
  | { type: "delivered"; value: number; x: number; z: number }
  /** The farm's "копеечка" arrived. */
  | { type: "penny"; value: number }
  | { type: "rushHour" }
  | { type: "buzz"; shop: ShopId; state: "start" | "end" }
  | { type: "floor"; floor: number; x: number; z: number }
  | { type: "chapterDone"; stars: number }
  | { type: "shopOpen"; shop: ShopId; stars: number };

export interface OrderLine {
  item: ItemId;
  need: number;
  have: number;
}

export interface Order {
  id: number;
  lines: OrderLine[];
  /** Bonus paid on completion, on top of the normal sale price. */
  reward: number;
  /** A seasonal fair order (last day of a season): seasonal goods, double bonus. */
  fair?: boolean;
}

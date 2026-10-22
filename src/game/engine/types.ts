import type { Rect } from "../core/math";
import type { PlayerStatId, WorkerStatId } from "../data/balance";
import type { CropDef } from "../data/crops";
import type { ItemId } from "../data/items";
import type { FieldDef, MachineDef, PadDef, PadKind, WorkerDef, ZoneId } from "../data/layout";
import type { MachineTypeDef } from "../data/machines";

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

export type InteractKind = "machineIn" | "machineOut" | "market" | "depot" | "pad" | "farmhouse" | "trash";

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
  | { kind: "point"; x: number; y: number; z: number };

export type FlightItem = ItemId | "coin";

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
}

export interface GameState {
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
  prestige: { stars: number; seasons: number };
  /** Money earned this season — basis for prestige stars. */
  seasonEarned: number;
  /** Rolling estimate of automated income per second (for offline). */
  autoIncome: { acc: number; window: number; rate: number };
  /** Current market order (null while the next one is on cooldown). */
  order: Order | null;
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
  | { type: "order"; state: "new" | "done"; reward?: number };

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
}

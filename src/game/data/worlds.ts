/**
 * A farm-like world as data: the home farm and the island of chapter III are
 * two layouts of the same engine. Everything that used to be a constant of
 * the farm (where the market stands, which field you start with…) is read
 * from the layout of the world being played.
 */
import type { Rect } from "../core/math";
import { FARM_BUS_STOP, type Box } from "./city";
import type { ItemId } from "./items";
import {
  DEPOT,
  FARMHOUSE,
  FIELDS,
  INITIAL_MACHINES,
  MACHINES,
  MAP_BOUNDS,
  MARKET,
  MERCHANT_SPOTS,
  PADS,
  PLAYER_SPAWN,
  STATUE,
  TRASH,
  WATER_RECTS,
  ZONES,
  type FieldDef,
  type MachineDef,
  type PadDef,
  type ZoneDef,
  type ZoneId,
} from "./layout";

export type FarmWorldId = "farm" | "island";
export type WorldId = FarmWorldId | "city";

export type MarketDef = typeof MARKET;
export type HouseDef = typeof FARMHOUSE;
export type DepotDef = typeof DEPOT;
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type RunawayKind = "chicken" | "cow" | "sheep" | "monkey";

export interface TutorialStep {
  /** Item whose rendered icon the HUD shows instead of the emoji. */
  item?: ItemId;
  text: string;
  icon: string;
}

export interface FarmLayout {
  id: FarmWorldId;
  zones: readonly ZoneDef[];
  fields: readonly FieldDef[];
  machines: readonly MachineDef[];
  pads: readonly PadDef[];
  /** What you start with. */
  startZone: ZoneId;
  startFields: readonly string[];
  startMachines: readonly string[];
  /** Buying this plot builds the depot. */
  depotZone: ZoneId;
  market: MarketDef;
  farmhouse: HouseDef;
  depot: DepotDef;
  statue: { x: number; z: number; w: number; d: number };
  trash: Box;
  /** Water you cannot walk on. */
  water: readonly Rect[];
  spawn: { x: number; z: number };
  bounds: Bounds;
  merchantSpots: Partial<Record<ZoneId, { x: number; z: number }>>;
  /** Which machine an escaped animal belongs to. */
  runawayHomes: Partial<Record<RunawayKind, string>>;
  /** The stop to the other worlds. */
  busStop: Box;
  tutorial: {
    steps: readonly TutorialStep[];
    /** The raw crop of the first steps and what the first machine makes of it. */
    raw: ItemId;
    product: ItemId;
    /** The pad the last step points at. */
    firstPad: string;
  };
}

export const FARM_TUTORIAL: readonly TutorialStep[] = [
  { text: "Пробеги по полю — собери пшеницу", icon: "🌾", item: "wheat" },
  { text: "Отнеси пшеницу на мельницу", icon: "🌀", item: "wheat" },
  { text: "Забери готовую муку", icon: "🍚", item: "flour" },
  { text: "Продай муку на рынке", icon: "💰", item: "flour" },
  { text: "Встань на площадку — купи грядку", icon: "🏗️" },
];

export const FARM_LAYOUT: FarmLayout = {
  id: "farm",
  zones: ZONES,
  fields: FIELDS,
  machines: MACHINES,
  pads: PADS,
  startZone: "farm",
  startFields: ["wheat_1"],
  startMachines: INITIAL_MACHINES,
  depotZone: "depot",
  market: MARKET,
  farmhouse: FARMHOUSE,
  depot: DEPOT,
  statue: STATUE,
  trash: TRASH,
  water: WATER_RECTS,
  spawn: PLAYER_SPAWN,
  bounds: MAP_BOUNDS,
  merchantSpots: MERCHANT_SPOTS,
  runawayHomes: { chicken: "coop", cow: "barn", sheep: "sheepfold" },
  busStop: FARM_BUS_STOP,
  tutorial: { steps: FARM_TUTORIAL, raw: "wheat", product: "flour", firstPad: "field_wheat_2" },
};

const LAYOUTS = new Map<FarmWorldId, FarmLayout>([["farm", FARM_LAYOUT]]);

/** Islands register here (data/island.ts), so this module stays a leaf of the farm. */
export function registerLayout(l: FarmLayout) {
  LAYOUTS.set(l.id, l);
}

export function layoutFor(world: FarmWorldId): FarmLayout {
  return LAYOUTS.get(world) ?? FARM_LAYOUT;
}

/** The layout of a farm-like world (the city has none: callers check first). */
export const layoutOf = (st: { world: WorldId }) => layoutFor(st.world === "island" ? "island" : "farm");

export const isFarmWorld = (w: WorldId): w is FarmWorldId => w === "farm" || w === "island";

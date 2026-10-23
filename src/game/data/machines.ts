import type { ItemId } from "./items";

export type MachineTypeId =
  | "mill"
  | "bakery"
  | "feedmill"
  | "coop"
  | "barn"
  | "dairy"
  | "juicer"
  | "saucery"
  | "confectionery"
  | "smokehouse"
  | "cannery"
  | "apiary"
  | "honeyhouse"
  | "sheepfold"
  | "spinnery"
  | "knitting"
  | "jamhouse"
  | "icecream"
  | "piebakery"
  | "lanternshop";

/** [x, z] offset or [x, z, w, d] rectangle in machine-local space (machine faces +z). */
type Off = readonly [number, number];
type Box = readonly [number, number, number, number];

export interface MachineTypeDef {
  id: MachineTypeId;
  name: string;
  inputs: readonly { item: ItemId; amount: number }[];
  output: { item: ItemId; amount: number };
  /** Seconds per cycle at level 1. */
  time: number;
  /** Collision footprint (w, d). */
  size: readonly [number, number];
  /** Height of the building — anchors bubbles above it. */
  height: number;
  inZone: Box;
  outZone: Box;
  /** Upgrade pad offset. */
  upPad: Off;
  /** Where the operator stands (and where the hire pad sits). */
  opSpot: Off;
  /** Where processed items pop out of the building. */
  core: readonly [number, number, number];
}

const std = (w: number, d: number) => ({
  size: [w, d] as const,
  inZone: [-1.9, d / 2 + 1.3, 2, 2] as const,
  outZone: [1.9, d / 2 + 1.3, 2, 2] as const,
  upPad: [w / 2 + 1.25, 0.5] as const,
  opSpot: [-(w / 2 + 1.1), 0.4] as const,
  core: [0, 1.2, d / 2 - 0.2] as const,
});

export const MACHINE_TYPES: Record<MachineTypeId, MachineTypeDef> = {
  mill: {
    id: "mill",
    name: "Мельница",
    inputs: [{ item: "wheat", amount: 1 }],
    output: { item: "flour", amount: 1 },
    time: 1.2,
    height: 5.2,
    ...std(3.2, 3.2),
  },
  bakery: {
    id: "bakery",
    name: "Пекарня",
    inputs: [{ item: "flour", amount: 1 }],
    output: { item: "bread", amount: 1 },
    time: 1.6,
    height: 3.8,
    ...std(3.6, 3.0),
  },
  feedmill: {
    id: "feedmill",
    name: "Кормовая станция",
    inputs: [{ item: "corn", amount: 1 }],
    output: { item: "feed", amount: 1 },
    time: 1.2,
    height: 4.4,
    ...std(3.4, 3.0),
  },
  coop: {
    id: "coop",
    name: "Курятник",
    inputs: [{ item: "feed", amount: 1 }],
    output: { item: "egg", amount: 1 },
    time: 1.8,
    height: 3.2,
    ...std(5.2, 4.4),
    inZone: [-2.1, 3.5, 2, 2],
    outZone: [2.1, 3.5, 2, 2],
  },
  barn: {
    id: "barn",
    name: "Коровник",
    inputs: [{ item: "grass", amount: 1 }],
    output: { item: "milk", amount: 1 },
    time: 1.8,
    height: 4.4,
    ...std(6.2, 5.0),
    inZone: [-2.2, 3.8, 2, 2],
    outZone: [2.2, 3.8, 2, 2],
  },
  dairy: {
    id: "dairy",
    name: "Сыроварня",
    inputs: [{ item: "milk", amount: 1 }],
    output: { item: "cheese", amount: 1 },
    time: 2.2,
    height: 3.8,
    ...std(3.6, 3.2),
  },
  juicer: {
    id: "juicer",
    name: "Соковыжималка",
    inputs: [{ item: "apple", amount: 1 }],
    output: { item: "juice", amount: 1 },
    time: 2.0,
    height: 3.8,
    ...std(3.4, 3.0),
  },
  saucery: {
    id: "saucery",
    name: "Соусная",
    inputs: [{ item: "tomato", amount: 1 }],
    output: { item: "sauce", amount: 1 },
    time: 2.4,
    height: 3.8,
    ...std(3.6, 3.2),
  },
  confectionery: {
    id: "confectionery",
    name: "Кондитерская",
    inputs: [
      { item: "flour", amount: 1 },
      { item: "milk", amount: 1 },
      { item: "egg", amount: 1 },
    ],
    output: { item: "cake", amount: 1 },
    time: 3.0,
    height: 4.6,
    ...std(4.6, 3.6),
    inZone: [-1.6, 3.1, 3.6, 2],
    outZone: [2.6, 3.1, 2, 2],
    upPad: [3.6, -0.2],
  },
  smokehouse: {
    id: "smokehouse",
    name: "Коптильня",
    inputs: [{ item: "fish", amount: 1 }],
    output: { item: "smokedfish", amount: 1 },
    time: 2.4,
    height: 4.2,
    ...std(3.4, 3.0),
  },
  cannery: {
    id: "cannery",
    name: "Консервный цех",
    inputs: [{ item: "smokedfish", amount: 1 }],
    output: { item: "canned", amount: 1 },
    time: 2.6,
    height: 4.0,
    ...std(3.6, 3.2),
  },
  apiary: {
    id: "apiary",
    name: "Ульи",
    inputs: [{ item: "flower", amount: 1 }],
    output: { item: "honeycomb", amount: 1 },
    time: 2.6,
    height: 2.6,
    ...std(4.6, 3.0),
  },
  honeyhouse: {
    id: "honeyhouse",
    name: "Медогонка",
    inputs: [{ item: "honeycomb", amount: 1 }],
    output: { item: "honey", amount: 1 },
    time: 2.8,
    height: 4.2,
    ...std(3.6, 3.2),
  },
  sheepfold: {
    id: "sheepfold",
    name: "Овчарня",
    inputs: [{ item: "grass", amount: 1 }],
    output: { item: "wool", amount: 1 },
    time: 2.4,
    height: 4.0,
    ...std(6.2, 5.0),
    inZone: [-2.2, 3.8, 2, 2],
    outZone: [2.2, 3.8, 2, 2],
  },
  spinnery: {
    id: "spinnery",
    name: "Прядильня",
    inputs: [{ item: "wool", amount: 1 }],
    output: { item: "yarn", amount: 1 },
    time: 2.6,
    height: 4.4,
    ...std(3.6, 3.2),
  },
  knitting: {
    id: "knitting",
    name: "Вязальня",
    inputs: [{ item: "yarn", amount: 1 }],
    output: { item: "sweater", amount: 1 },
    time: 3.0,
    height: 4.6,
    ...std(3.8, 3.2),
  },
  jamhouse: {
    id: "jamhouse",
    name: "Джемоварня",
    inputs: [{ item: "strawberry", amount: 1 }],
    output: { item: "jam", amount: 1 },
    time: 2.8,
    height: 4.4,
    ...std(3.6, 3.2),
  },
  icecream: {
    id: "icecream",
    name: "Кафе-мороженое",
    inputs: [
      { item: "milk", amount: 1 },
      { item: "strawberry", amount: 1 },
    ],
    output: { item: "icecream", amount: 1 },
    time: 3.2,
    height: 5.0,
    ...std(4.4, 3.4),
    inZone: [-1.4, 3.0, 3.2, 2],
    outZone: [2.4, 3.0, 2, 2],
    upPad: [3.45, 0],
  },
  piebakery: {
    id: "piebakery",
    name: "Тыквенная пекарня",
    inputs: [
      { item: "pumpkin", amount: 1 },
      { item: "flour", amount: 1 },
    ],
    output: { item: "pie", amount: 1 },
    time: 3.2,
    height: 4.6,
    ...std(4.4, 3.4),
    inZone: [-1.4, 3.0, 3.2, 2],
    outZone: [2.4, 3.0, 2, 2],
    upPad: [3.45, 0],
  },
  lanternshop: {
    id: "lanternshop",
    name: "Мастерская фонарей",
    inputs: [{ item: "pumpkin", amount: 1 }],
    output: { item: "lantern", amount: 1 },
    time: 2.6,
    height: 4.4,
    ...std(3.6, 3.2),
  },
};

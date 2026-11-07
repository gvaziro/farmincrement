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
  | "lanternshop"
  // City kitchens and workshops.
  | "c_coffee"
  | "c_sandwich"
  | "c_oven"
  | "c_grill"
  | "c_pastry"
  | "c_honeycake"
  | "c_tailor"
  | "c_packer"
  | `supply_${SupplyItem}`
  // The island's huts.
  | "i_juicer"
  | "i_icepop"
  | "i_dryer"
  | "i_press"
  | "i_smoothie"
  | "i_grill"
  | "i_sugarmill"
  | "i_candy"
  | "i_cocoadryer"
  | "i_chocolate"
  | "i_roaster"
  | "i_gelato"
  | "i_pearlshop"
  | "i_jeweler";

/** What the farm van brings to the city: each gets a pallet of its own. */
export const SUPPLY_ITEMS = ["bread", "egg", "milk", "juice", "cheese", "flour", "sauce", "smokedfish", "canned", "cake", "honey", "yarn", "sweater", "jam", "icecream", "lantern", "pie"] as const satisfies readonly ItemId[];
export type SupplyItem = (typeof SUPPLY_ITEMS)[number];

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
  /** A pallet the farm van fills: nothing to build, nothing to feed. */
  supply?: boolean;
}

const std = (w: number, d: number) => ({
  size: [w, d] as const,
  inZone: [-1.9, d / 2 + 1.3, 2, 2] as const,
  outZone: [1.9, d / 2 + 1.3, 2, 2] as const,
  upPad: [w / 2 + 1.25, 0.5] as const,
  opSpot: [-(w / 2 + 1.1), 0.4] as const,
  core: [0, 1.2, d / 2 - 0.2] as const,
});

/** A kitchen with two inputs: a long pallet row on the left, the output on the right. */
const wide = (w: number, d: number) => ({
  ...std(w, d),
  inZone: [-1.5, d / 2 + 1.3, 3.4, 2] as const,
  outZone: [2.5, d / 2 + 1.3, 2, 2] as const,
  upPad: [w / 2 + 1.25, 0] as const,
});

function supplyType(item: SupplyItem): MachineTypeDef {
  return {
    id: `supply_${item}`,
    name: "Товар с фермы",
    inputs: [],
    output: { item, amount: 1 },
    time: 1,
    height: 1,
    size: [0, 0],
    inZone: [0, 0, 0, 0],
    outZone: [0, 0, 2, 2],
    upPad: [0, 0],
    opSpot: [0, 0],
    core: [0, 1, 0],
    supply: true,
  };
}

const SUPPLY_TYPES = Object.fromEntries(SUPPLY_ITEMS.map((i) => [`supply_${i}`, supplyType(i)])) as Record<`supply_${SupplyItem}`, MachineTypeDef>;

/** A one-input island hut. */
function hut(id: MachineTypeId, name: string, input: ItemId, output: ItemId, time: number, w = 3.6, d = 3.2): MachineTypeDef {
  return { id, name, inputs: [{ item: input, amount: 1 }], output: { item: output, amount: 1 }, time, height: 4.0, ...std(w, d) };
}
/** An island hut with two or three inputs on a long pallet row. */
function bigHut(id: MachineTypeId, name: string, inputs: ItemId[], output: ItemId, time: number): MachineTypeDef {
  const three = inputs.length > 2;
  return {
    id,
    name,
    inputs: inputs.map((item) => ({ item, amount: 1 })),
    output: { item: output, amount: 1 },
    time,
    height: 4.4,
    ...std(4.6, 3.6),
    inZone: three ? [-1.6, 3.1, 3.6, 2] : [-1.4, 3.1, 3.2, 2],
    outZone: three ? [2.6, 3.1, 2, 2] : [2.4, 3.1, 2, 2],
    upPad: [3.6, -0.2],
  };
}

type IslandMachineId = "i_juicer" | "i_icepop" | "i_dryer" | "i_press" | "i_smoothie" | "i_grill" | "i_sugarmill" | "i_candy" | "i_cocoadryer" | "i_chocolate" | "i_roaster" | "i_gelato" | "i_pearlshop" | "i_jeweler";

const ISLAND_TYPES: Record<IslandMachineId, MachineTypeDef> = {
  i_juicer: hut("i_juicer", "Соковыжималка", "pineapple", "ajuice", 1.2, 3.2, 3.2),
  i_icepop: hut("i_icepop", "Ледник", "ajuice", "icepop", 1.6, 3.6, 3.0),
  i_dryer: hut("i_dryer", "Сушилка", "banana", "chips", 1.6, 3.6, 3.0),
  i_press: hut("i_press", "Кокосовый пресс", "coconut", "cmilk", 1.8),
  i_smoothie: bigHut("i_smoothie", "Смузи-бар", ["banana", "cmilk"], "smoothie", 2.6),
  i_grill: hut("i_grill", "Гриль на пляже", "fish", "grillfish", 2.2),
  i_sugarmill: hut("i_sugarmill", "Сахарная мельница", "cane", "sugar", 2.2),
  i_candy: bigHut("i_candy", "Конфетная", ["sugar", "cmilk"], "candy", 2.8),
  i_cocoadryer: hut("i_cocoadryer", "Сушка какао", "cocoa", "cocoabeans", 2.4),
  i_chocolate: bigHut("i_chocolate", "Шоколадная", ["cocoabeans", "sugar", "cmilk"], "chocolate", 3.0),
  i_roaster: hut("i_roaster", "Обжарка", "coffee", "roasted", 2.6),
  i_gelato: bigHut("i_gelato", "Джелатерия", ["vanilla", "cmilk", "sugar"], "gelato", 3.2),
  i_pearlshop: hut("i_pearlshop", "Жемчужная мастерская", "oyster", "pearl", 2.8),
  i_jeweler: hut("i_jeweler", "Ювелирная", "pearl", "necklace", 3.2),
};

export const MACHINE_TYPES: Record<MachineTypeId, MachineTypeDef> = {
  ...SUPPLY_TYPES,
  ...ISLAND_TYPES,
  c_coffee: {
    id: "c_coffee",
    name: "Кофемашина",
    inputs: [{ item: "milk", amount: 1 }],
    output: { item: "latte", amount: 1 },
    time: 1.6,
    height: 3.0,
    ...std(3.2, 2.8),
  },
  c_sandwich: {
    id: "c_sandwich",
    name: "Бутербродная",
    inputs: [
      { item: "bread", amount: 1 },
      { item: "cheese", amount: 1 },
    ],
    output: { item: "sandwich", amount: 1 },
    time: 2.0,
    height: 3.2,
    ...wide(4.4, 3.2),
  },
  c_oven: {
    id: "c_oven",
    name: "Печь для пиццы",
    inputs: [
      { item: "flour", amount: 1 },
      { item: "sauce", amount: 1 },
      { item: "cheese", amount: 1 },
    ],
    output: { item: "pizza", amount: 1 },
    time: 2.6,
    height: 3.8,
    ...wide(4.6, 3.4),
    inZone: [-1.6, 3.0, 3.6, 2],
    outZone: [2.6, 3.0, 2, 2],
  },
  c_grill: {
    id: "c_grill",
    name: "Гриль шефа",
    inputs: [
      { item: "smokedfish", amount: 1 },
      { item: "sauce", amount: 1 },
    ],
    output: { item: "fishdish", amount: 1 },
    time: 2.8,
    height: 3.4,
    ...wide(4.4, 3.2),
  },
  c_pastry: {
    id: "c_pastry",
    name: "Кондитерский цех",
    inputs: [
      { item: "flour", amount: 1 },
      { item: "egg", amount: 1 },
    ],
    output: { item: "eclair", amount: 1 },
    time: 2.2,
    height: 3.4,
    ...wide(4.4, 3.2),
  },
  c_honeycake: {
    id: "c_honeycake",
    name: "Медовый цех",
    inputs: [
      { item: "cake", amount: 1 },
      { item: "honey", amount: 1 },
    ],
    output: { item: "medovik", amount: 1 },
    time: 3.0,
    height: 3.4,
    ...wide(4.4, 3.2),
  },
  c_tailor: {
    id: "c_tailor",
    name: "Ателье",
    inputs: [
      { item: "sweater", amount: 1 },
      { item: "yarn", amount: 1 },
    ],
    output: { item: "coat", amount: 1 },
    time: 3.2,
    height: 3.6,
    ...wide(4.4, 3.2),
  },
  c_packer: {
    id: "c_packer",
    name: "Упаковочная",
    inputs: [
      { item: "jam", amount: 1 },
      { item: "lantern", amount: 1 },
    ],
    output: { item: "giftbox", amount: 1 },
    time: 3.2,
    height: 3.4,
    ...wide(4.4, 3.2),
  },
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

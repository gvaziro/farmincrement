import type { ItemId } from "./items";

export type CropId = "wheat" | "corn" | "grass" | "tomato" | "apple" | "flowers" | "fish";

export interface CropDef {
  id: CropId;
  name: string;
  item: ItemId;
  /** Seconds for a plant to regrow (or for a tree/spot to grow one fruit/fish). */
  growTime: number;
  /**
   * "plant": one item per plant, harvested by walking over it.
   * "tree":  several fruits that regrow one by one.
   * "water": fishing spots in a pond — like a tree, but caught from the shore
   *          with extra reach (WATER_REACH), and workers stand on a set point.
   */
  kind: "plant" | "tree" | "water";
  /** Fruits per tree / fish per spot. */
  fruits?: number;
  /** Grid spacing, metres. */
  spacing: number;
  /** Soil / ground colour under the plot. */
  soil: string;
}

export const CROPS: Record<CropId, CropDef> = {
  wheat: { id: "wheat", name: "Пшеница", item: "wheat", growTime: 5, kind: "plant", spacing: 1.0, soil: "#a8703f" },
  corn: { id: "corn", name: "Кукуруза", item: "corn", growTime: 6, kind: "plant", spacing: 1.05, soil: "#9c6438" },
  grass: { id: "grass", name: "Луг", item: "grass", growTime: 4, kind: "plant", spacing: 1.0, soil: "#5aa83f" },
  tomato: { id: "tomato", name: "Помидоры", item: "tomato", growTime: 6, kind: "plant", spacing: 1.05, soil: "#93603a" },
  apple: { id: "apple", name: "Яблони", item: "apple", growTime: 3, kind: "tree", fruits: 3, spacing: 2.4, soil: "#6cbf4e" },
  flowers: { id: "flowers", name: "Цветы", item: "flower", growTime: 4, kind: "plant", spacing: 1.0, soil: "#6fbf52" },
  fish: { id: "fish", name: "Рыба", item: "fish", growTime: 4, kind: "water", fruits: 2, spacing: 1.9, soil: "#4fb4e0" },
};

/** Extra catch radius for fishing spots: you fish from the shore, not in the water. */
export const WATER_REACH = 1.5;

/** Fruit positions on a tree canopy, local to the tree (before its yaw). */
export const TREE_FRUIT_SLOTS: readonly (readonly [number, number, number])[] = [
  [0.75, 1.95, 0.45],
  [-0.55, 2.15, 0.6],
  [0.2, 1.6, 0.85],
];

/** Every tree gets a stable random yaw from its seed. */
export const treeYaw = (seed: number) => seed * Math.PI * 2;

/** World position of fruit slot `k` on a tree at (x, z). */
export function fruitSlotWorld(x: number, z: number, seed: number, k: number) {
  const s = TREE_FRUIT_SLOTS[k % TREE_FRUIT_SLOTS.length];
  const yaw = treeYaw(seed);
  const c = Math.cos(yaw);
  const sn = Math.sin(yaw);
  return { x: x + s[0] * c + s[2] * sn, y: s[1], z: z - s[0] * sn + s[2] * c };
}

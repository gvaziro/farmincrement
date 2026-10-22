/**
 * Where items sit: slots of a carried stack and of ground piles. Shared by the
 * engine (flight start points) and the renderers (instance matrices).
 */
import type { Rect } from "../core/math";
import { ITEMS, type ItemId } from "../data/items";
import type { Machine } from "./types";

export const STACK_BASE_Y = 0.66;
export const STACK_BACK = 0.4;

/** Column layout behind the back, in local space (x right, z forward). */
const COLUMN_SETS: readonly (readonly [number, number])[][] = [
  [[0, 0]],
  [
    [-0.27, 0],
    [0.27, 0],
  ],
  [
    [-0.27, 0],
    [0.27, 0],
    [0, -0.5],
  ],
  [
    [-0.27, 0],
    [0.27, 0],
    [-0.27, -0.5],
    [0.27, -0.5],
  ],
  [
    [-0.54, 0],
    [0, 0],
    [0.54, 0],
    [-0.27, -0.5],
    [0.27, -0.5],
  ],
  [
    [-0.54, 0],
    [0, 0],
    [0.54, 0],
    [-0.54, -0.5],
    [0, -0.5],
    [0.54, -0.5],
  ],
];

/** Towers stay readable: at most ~14 items per column, up to 6 columns. */
export const stackColumnCount = (capacity: number) => Math.min(COLUMN_SETS.length, Math.max(1, Math.ceil(capacity / 14)));

/**
 * Local positions of every item in the stack: out[i*3..i*3+2] = x, y(bottom), z.
 * Items are dealt round-robin into columns so towers grow evenly.
 */
export function layoutStack(stack: readonly ItemId[], capacity: number, out: Float32Array, count = stack.length) {
  const set = COLUMN_SETS[stackColumnCount(capacity) - 1];
  const heights = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    const c = i % set.length;
    const h = ITEMS[stack[i]].height;
    out[i * 3] = set[c][0];
    out[i * 3 + 1] = STACK_BASE_Y + heights[c];
    out[i * 3 + 2] = -STACK_BACK + set[c][1];
    heights[c] += h;
  }
}

const tmp = new Float32Array(3 * 160);

/** Local position of one slot (bottom of the item). */
export function stackSlotLocal(stack: readonly ItemId[], capacity: number, slot: number) {
  const n = Math.min(slot + 1, stack.length, 160);
  layoutStack(stack, capacity, tmp, n);
  const i = Math.max(0, n - 1);
  return { x: tmp[i * 3], y: tmp[i * 3 + 1], z: tmp[i * 3 + 2] };
}

/** Rotate a local offset by `facing` and add the actor position. */
export function localToWorld(ax: number, az: number, facing: number, lx: number, lz: number) {
  const c = Math.cos(facing);
  const s = Math.sin(facing);
  return { x: ax + lx * c + lz * s, z: az - lx * s + lz * c };
}

// ── ground piles ────────────────────────────────────────────────────────
export const PILE_SPACING = 0.58;

/** World position (bottom-centre) of slot `i` in a pile laid out on `r`. */
export function pileSlot(r: Rect, i: number, itemHeight: number) {
  const cols = Math.max(1, Math.min(3, Math.floor((r.hw * 2) / PILE_SPACING)));
  const rows = Math.max(1, Math.min(3, Math.floor((r.hd * 2) / PILE_SPACING)));
  const perLayer = cols * rows;
  const layer = Math.floor(i / perLayer);
  const k = i % perLayer;
  const col = k % cols;
  const row = Math.floor(k / cols);
  return {
    x: r.x + (col - (cols - 1) / 2) * PILE_SPACING,
    y: 0.04 + layer * itemHeight,
    z: r.z + (row - (rows - 1) / 2) * PILE_SPACING,
  };
}

/** Sub-rectangle of a machine's input zone reserved for one input item. */
export function inputRect(m: Machine, item: ItemId): Rect {
  const inputs = m.type.inputs;
  if (inputs.length === 1) return m.inRect;
  const idx = Math.max(
    0,
    inputs.findIndex((i) => i.item === item),
  );
  const w = (m.inRect.hw * 2) / inputs.length;
  return {
    x: m.inRect.x - m.inRect.hw + w * (idx + 0.5),
    z: m.inRect.z,
    hw: w / 2,
    hd: m.inRect.hd,
  };
}

export const inputSlot = (m: Machine, item: ItemId, slot: number) =>
  pileSlot(inputRect(m, item), slot, ITEMS[item].height);
export const outputSlot = (m: Machine, slot: number) => pileSlot(m.outRect, slot, ITEMS[m.type.output.item].height);

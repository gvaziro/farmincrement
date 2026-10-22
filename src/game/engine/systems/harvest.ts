import { WATER_REACH, fruitSlotWorld, type CropDef, type CropId } from "../../data/crops";
import type { Game } from "../Game";
import type { Actor, Plant } from "../types";

const TREE_RADIUS = 0.8;

/** Trees and fishing spots hold several fruits/fish that regrow one by one. */
export const bearsFruit = (crop: CropDef) => crop.kind !== "plant";

/** Whether a plant/tree/spot has something to collect right now. */
export const isRipe = (crop: CropDef, p: Plant) => (bearsFruit(crop) ? p.fruits > 0 : p.growth >= 1);

/** Extra reach on top of the actor's own radius for this crop. */
const reachBonus = (crop: CropDef) => (crop.kind === "tree" ? TREE_RADIUS : crop.kind === "water" ? WATER_REACH : 0);

/** Grow plants and fruits. */
export function updateFields(game: Game, dt: number) {
  for (const f of game.state.fields) {
    f.spawnT += dt;
    const grow = f.crop.growTime;
    const fruit = bearsFruit(f.crop);
    const maxFruits = f.crop.fruits ?? 0;
    for (const p of f.plants) {
      p.pop += dt;
      if (fruit) {
        if (p.fruits < maxFruits) {
          p.timer += dt;
          if (p.timer >= grow * (0.85 + p.seed * 0.3)) {
            p.timer = 0;
            p.fruits++;
            p.pop = 0;
          }
        }
      } else if (p.growth < 1) {
        p.growth += dt / (grow * (0.85 + p.seed * 0.3));
        if (p.growth >= 1) {
          p.growth = 1;
          p.pop = 0;
        }
      }
    }
  }
}

/**
 * Collect every ripe plant within reach. `crops` limits what a worker may take;
 * the player takes anything.
 */
export function harvestAround(game: Game, a: Actor & { reach: number }, crops: ReadonlySet<CropId> | null) {
  const st = game.state;
  const isPlayer = a.id === "player";
  const r = a.reach;
  for (const f of st.fields) {
    if (crops && !crops.has(f.def.crop)) continue;
    if (f.spawnT < 0.7) continue;
    const bonus = reachBonus(f.crop);
    if (Math.abs(a.x - f.rect.x) > f.rect.hw + r + bonus + 0.5 || Math.abs(a.z - f.rect.z) > f.rect.hd + r + bonus + 0.5) continue;
    const fruit = bearsFruit(f.crop);
    const water = f.crop.kind === "water";
    const rr = r + bonus;
    const rr2 = rr * rr;
    for (const p of f.plants) {
      if (!isRipe(f.crop, p)) continue;
      const dx = p.x - a.x;
      const dz = p.z - a.z;
      if (dx * dx + dz * dz > rr2) continue;
      if (a.stack.length >= a.capacity) {
        if (a.fullT > 0.6) game.emit({ type: "full", actor: a.id });
        a.fullT = 0;
        return;
      }
      const item = f.crop.item;
      if (fruit) {
        while (p.fruits > 0 && a.stack.length < a.capacity) {
          p.fruits--;
          p.timer = 0;
          if (water) {
            // A fish leaps out of the water towards the stack.
            game.giveToActor(a, item, p.x, 0.1, p.z, 0.5);
          } else {
            const s = fruitSlotWorld(p.x, p.z, p.seed, p.fruits);
            game.giveToActor(a, item, s.x, s.y, s.z);
          }
        }
        p.pop = 0;
      } else {
        p.growth = 0;
        p.pop = 0;
        game.giveToActor(a, item, p.x, 0.45, p.z);
      }
      st.stats.harvested++;
      game.emit({ type: "harvest", item, x: p.x, z: p.z, player: isPlayer });
    }
  }
}

import { WATER_REACH, fruitSlotWorld, type CropDef, type CropId } from "../../data/crops";
import { NIGHT_FISHING_BOOST, isNight } from "../daycycle";
import { AUTUMN_BONUS_EVERY, seasonGrowth } from "../seasons";
import { weatherGrowth } from "../weather";
import { WINTER_GROWTH } from "../../data/challenges";
import { SOIL_PER_LEVEL } from "../../data/legacy";
import { effectivePerk, hasChallenge } from "../challenges";
import type { Game } from "../Game";
import type { Actor, Plant } from "../types";
import { rollFind } from "./album";

const TREE_RADIUS = 0.8;

/** Trees and fishing spots hold several fruits/fish that regrow one by one. */
export const bearsFruit = (crop: CropDef) => crop.kind !== "plant";

/** Whether a plant/tree/spot has something to collect right now. */
export const isRipe = (crop: CropDef, p: Plant) => (bearsFruit(crop) ? p.fruits > 0 : p.growth >= 1);

/** Extra reach on top of the actor's own radius for this crop. */
export const reachBonus = (crop: CropDef) => (crop.kind === "tree" ? TREE_RADIUS : crop.kind === "water" ? WATER_REACH : 0);

/** Grow plants and fruits. */
export function updateFields(game: Game, dt: number) {
  const st = game.state;
  const night = isNight(st.dayClock);
  const raining = st.weather === "rain";
  // Legacy "fertile soil": plants and orchards grow faster (fish do not care);
  // "Вечная зима" makes them slow.
  const soil = (1 + effectivePerk(st, "soil") * SOIL_PER_LEVEL) * (hasChallenge(st, "winter") ? WINTER_GROWTH : 1);
  for (const f of st.fields) {
    f.spawnT += dt;
    const grow = f.crop.growTime;
    const fruit = bearsFruit(f.crop);
    const maxFruits = f.crop.fruits ?? 0;
    // Fish bite better at night; spring and rain make plants grow faster.
    const boost =
      (night && f.crop.kind === "water" ? NIGHT_FISHING_BOOST : 1) * seasonGrowth(st.season, f.crop) * weatherGrowth(raining, f.crop) * (f.crop.kind === "water" ? 1 : soil);
    for (const p of f.plants) {
      p.pop += dt;
      if (fruit) {
        if (p.fruits < maxFruits) {
          p.timer += dt * boost;
          if (p.timer >= grow * (0.85 + p.seed * 0.3)) {
            p.timer = 0;
            p.fruits++;
            p.pop = 0;
          }
        }
      } else if (p.growth < 1) {
        p.growth += (dt * boost) / (grow * (0.85 + p.seed * 0.3));
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
 * the player takes anything — except a golden plant, which is picked up by
 * walking close to it (systems/surprises.ts), full hands or not.
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
    const g = st.surprises.golden;
    const golden = g && g.field === f.id ? f.plants[g.plant] : null;
    for (const p of f.plants) {
      if (!isRipe(f.crop, p) || p === golden) continue;
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
          if (water && isNight(st.dayClock)) st.stats.nightFish++;
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
      if (st.weather === "rain") st.stats.rainHarvest++;
      game.emit({ type: "harvest", item, x: p.x, z: p.z, player: isPlayer });
      if (isPlayer) rollFind(game, f.def.zone, p.x, p.z);
      // Autumn: every few harvests bring one more.
      if (st.season === "autumn" && st.stats.harvested % AUTUMN_BONUS_EVERY === 0 && a.stack.length < a.capacity) {
        game.giveToActor(a, item, p.x, 0.6, p.z, 0.42);
        st.stats.bonusHarvest++;
        game.emit({ type: "bonusHarvest", item, x: p.x, z: p.z, player: isPlayer });
      }
    }
  }
}

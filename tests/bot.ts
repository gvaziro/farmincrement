/**
 * A greedy headless player for balance testing. It drives the real engine
 * through `game.input` exactly like a human would: it walks, harvests, carries,
 * sells and steps on pads. It buys the cheapest progression pad it can
 * afford and sprinkles in upgrades that are cheap relative to the next goal.
 */
import { ITEMS, isSellable, type ItemId } from "@/game/data/items";
import { CROPS } from "@/game/data/crops";
import { MACHINE_TYPES } from "@/game/data/machines";
import { FARMHOUSE, MARKET } from "@/game/data/layout";
import { PLAYER_STATS, WORKER_STATS, machineCapacity, type PlayerStatId, type WorkerStatId } from "@/game/data/balance";
import { PERK_IDS, type PerkId } from "@/game/data/legacy";
import { Game } from "@/game/engine/Game";
import { bearsFruit, isRipe } from "@/game/engine/systems/harvest";
import type { Field, Machine, PadState, PathPoint } from "@/game/engine/types";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";

type Task =
  | { kind: "pad"; pad: PadState; level?: number | null }
  | { kind: "stat"; id: PlayerStatId | WorkerStatId; worker: boolean }
  | { kind: "harvest"; field: Field }
  | { kind: "deliver"; zoneId: string; x: number; z: number }
  | { kind: "pickup"; machine: Machine }
  | { kind: "idle"; until: number };

/** How much the bot values a level of each legacy upgrade. */
const PERK_VALUE: Record<PerkId, number> = {
  fame: 3,
  treasury: 2.5,
  lands: 2.5,
  workshop: 1.5,
  soil: 1.5,
  crew: 1.2,
  hands: 1,
  fair: 0.6,
  holiday: 0.1,
};

export interface LogEntry {
  t: number;
  what: string;
  cost: number;
}

export class Bot {
  readonly g: Game;
  task: Task | null = null;
  path: PathPoint[] = [];
  pathIdx = 0;
  goal: { x: number; z: number } | null = null;
  taskTime = 0;
  log: LogEntry[] = [];
  private seenPurchases = 0;

  constructor(game = new Game()) {
    this.g = game;
  }

  get st() {
    return this.g.state;
  }

  /**
   * Hand the farm over to the next generation and spend the stars like a
   * sensible player: the best usefulness per star first (prices and a head
   * start matter most; offline income means nothing to a bot). Returns what
   * it bought.
   */
  nextGeneration(): PerkId[] {
    if (!this.g.prestige()) throw new Error("no statue yet");
    this.task = null;
    this.path = [];
    this.pathIdx = 0;
    this.goal = null;
    this.log = [];
    this.g.drainEvents();
    const bought: PerkId[] = [];
    for (;;) {
      let best: PerkId | null = null;
      let bestScore = 0;
      for (const id of PERK_IDS) {
        const c = this.g.perkCost(id);
        if (c === null || c > this.st.prestige.stars) continue;
        const score = PERK_VALUE[id] / c;
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (!best) break;
      this.g.buyPerk(best);
      bought.push(best);
    }
    this.g.drainEvents();
    return bought;
  }

  run(seconds: number, dt = 1 / 20, stop?: () => boolean) {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      this.step(dt);
      if (stop?.()) return true;
    }
    return false;
  }

  step(dt: number) {
    this.taskTime += dt;
    if (!this.task || this.taskDone()) this.pick();
    this.act();
    // Like a player, blow the foreman's whistle whenever it is ready.
    if (this.st.workers.length >= 2 && this.g.canWhistle()) this.g.whistle();
    const before = this.st.stats.purchases;
    this.g.tick(dt);
    for (const e of this.g.drainEvents()) {
      if (e.type === "purchase") this.record(e.label, e.pad);
      if (e.type === "levelUp") this.record(`${e.pad} → ур.${e.level}`, e.pad);
    }
    void before;
  }

  private record(what: string, padId: string) {
    const pad = this.g.pad(padId);
    this.log.push({ t: this.st.time, what, cost: pad?.def.cost ?? 0 });
    this.seenPurchases++;
  }

  // ── decisions ─────────────────────────────────────────────────────────
  private nextGoalCost() {
    let best = Infinity;
    for (const p of this.st.pads) {
      if (!p.visible || p.def.repeatable) continue;
      best = Math.min(best, (this.g.padCost(p) ?? Infinity) - p.paid);
    }
    return best;
  }

  private pick() {
    this.task = null;
    this.taskTime = 0;
    this.goal = null;
    const money = this.st.money;
    const p = this.st.player;

    // 1. Cheapest affordable progression pad.
    let bestPad: PadState | null = null;
    let bestCost = Infinity;
    for (const pad of this.st.pads) {
      if (!pad.visible || pad.def.repeatable) continue;
      const c = (this.g.padCost(pad) ?? Infinity) - pad.paid;
      if (c <= money && c < bestCost) {
        bestCost = c;
        bestPad = pad;
      }
    }
    if (bestPad) return this.setTask({ kind: "pad", pad: bestPad, level: this.g.padLevel(bestPad) });

    // 2. Cheap upgrades relative to the next goal.
    const budget = Math.min(money, this.nextGoalCost() * 0.35);
    let up: Task | null = null;
    let upCost = Infinity;
    for (const pad of this.st.pads) {
      if (!pad.visible || !pad.def.repeatable) continue;
      const c = (this.g.padCost(pad) ?? Infinity) - pad.paid;
      if (c <= budget && c < upCost) {
        upCost = c;
        up = { kind: "pad", pad, level: this.g.padLevel(pad) };
      }
    }
    for (const id of Object.keys(PLAYER_STATS) as PlayerStatId[]) {
      const c = this.g.playerStatCost(id);
      if (c !== null && c <= budget && c < upCost) {
        upCost = c;
        up = { kind: "stat", id, worker: false };
      }
    }
    if (this.st.workers.length > 0) {
      for (const id of Object.keys(WORKER_STATS) as WorkerStatId[]) {
        const c = this.g.workerStatCost(id);
        if (c !== null && c <= budget && c < upCost) {
          upCost = c;
          up = { kind: "stat", id, worker: true };
        }
      }
    }
    if (up) return this.setTask(up);

    // 3. Work.
    if (p.stack.length > 0) {
      const d = this.deliveryFor(p.stack);
      if (d) return this.setTask(d);
    }
    const job = this.bestJob();
    if (job) return this.setTask(job);
    this.setTask({ kind: "idle", until: this.st.time + 1 });
  }

  private setTask(t: Task) {
    this.task = t;
    this.taskTime = 0;
    let x = 0;
    let z = 0;
    switch (t.kind) {
      case "pad":
        x = t.pad.def.x;
        z = t.pad.def.z;
        break;
      case "stat":
        x = FARMHOUSE.door.x;
        z = FARMHOUSE.door.z;
        break;
      case "deliver":
        x = t.x;
        z = t.z;
        break;
      case "pickup":
        x = t.machine.outRect.x;
        z = t.machine.outRect.z;
        break;
      case "harvest":
        return;
      case "idle":
        this.goal = null;
        return;
    }
    this.moveTo(x, z);
  }

  private moveTo(x: number, z: number) {
    const p = this.st.player;
    this.goal = { x, z };
    this.path = this.g.nav.findPath(p.x, p.z, x, z) ?? [{ x, z }];
    this.pathIdx = 0;
  }

  /** Where to bring what we carry. */
  private deliveryFor(stack: ItemId[]): Task | null {
    const counts = new Map<ItemId, number>();
    for (const it of stack) counts.set(it, (counts.get(it) ?? 0) + 1);
    const item = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // Prefer processing into something more valuable.
    let best: Machine | null = null;
    let bestScore = -Infinity;
    for (const m of this.st.machines) {
      if (!m.type.inputs.some((i) => i.item === item)) continue;
      // A full machine is still a valid target for raw goods — we wait there —
      // but only if every machine that takes them is full.
      const full = (m.inputs[item] ?? 0) >= machineCapacity(m.level) - 2;
      if (full && isSellable(item)) continue;
      const gain = ITEMS[m.type.output.item].price - ITEMS[item].price;
      const dist = Math.hypot(m.inRect.x - this.st.player.x, m.inRect.z - this.st.player.z);
      const score = gain * 10 - dist - (full ? 1e12 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    if (best && (!isSellable(item) || ITEMS[best.type.output.item].price > ITEMS[item].price)) {
      return { kind: "deliver", zoneId: `in:${best.id}`, x: best.inRect.x, z: best.inRect.z };
    }
    if (isSellable(item)) return { kind: "deliver", zoneId: "market", x: MARKET.sell.x, z: MARKET.sell.z };
    return null;
  }

  private bestJob(): Task | null {
    const p = this.st.player;
    let best: Task | null = null;
    let bestScore = -Infinity;
    for (const m of this.st.machines) {
      const n = m.output - m.incomingOut;
      if (n < Math.min(4, p.capacity)) continue;
      const value = Math.min(n, p.capacity) * Math.max(1, ITEMS[m.type.output.item].price);
      const dist = Math.hypot(m.outRect.x - p.x, m.outRect.z - p.z);
      const score = value / (6 + dist);
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "pickup", machine: m };
      }
    }
    for (const f of this.st.fields) {
      const item = CROPS[f.def.crop].item;
      // Any machine that takes this crop and still has room.
      const targets = this.st.machines.filter((m) => m.type.inputs.some((i) => i.item === item) && (m.inputs[item] ?? 0) <= machineCapacity(m.level) * 0.6);
      if (targets.length === 0) continue;
      const ripe = f.plants.reduce((s, pl) => s + (bearsFruit(f.crop) ? pl.fruits : pl.growth >= 1 ? 1 : 0), 0);
      if (ripe < 3) continue;
      const out = Math.max(...targets.map((m) => ITEMS[MACHINE_TYPES[m.type.id].output.item].price));
      const value = Math.min(ripe, p.capacity) * Math.max(1, out);
      const dist = Math.hypot(f.rect.x - p.x, f.rect.z - p.z);
      const score = value / (10 + dist);
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "harvest", field: f };
      }
    }
    return best;
  }

  private taskDone(): boolean {
    const t = this.task!;
    const p = this.st.player;
    if (this.taskTime > 40) return true;
    switch (t.kind) {
      case "pad": {
        if (t.pad.done || !t.pad.visible) return true;
        if (t.pad.def.repeatable && this.g.padLevel(t.pad) !== t.level) return true;
        const cost = this.g.padCost(t.pad) ?? 0;
        return p.zoneId === `pad:${t.pad.id}` && this.st.money < 0.01 && t.pad.paid < cost;
      }
      case "stat":
        return this.taskTime > 0.1 && p.zoneId === "farmhouse";
      case "deliver": {
        if (p.zoneId !== t.zoneId) return false;
        return p.stack.length === 0 || (this.taskTime > 1.5 && p.transferCd === 0 && p.zoneTime > 0.6);
      }
      case "pickup":
        return p.zoneId === `out:${t.machine.id}` && (p.stack.length >= p.capacity || t.machine.output - t.machine.incomingOut <= 0);
      case "harvest": {
        if (p.stack.length >= p.capacity) return true;
        const any = t.field.plants.some((pl) => isRipe(t.field.crop, pl));
        return !any;
      }
      case "idle":
        return this.st.time >= t.until;
    }
  }

  private act() {
    const t = this.task;
    const p = this.st.player;
    const g = this.g;
    if (!t) return;
    if (t.kind === "stat" && p.zoneId === "farmhouse") {
      if (t.worker) g.buyWorkerStat(t.id as WorkerStatId);
      else g.buyPlayerStat(t.id as PlayerStatId);
    }
    if (t.kind === "harvest") {
      // Walk to where the nearest ripe plant (or fishing spot) can be reached.
      let best: { x: number; z: number } | null = null;
      let bd = Infinity;
      for (const pl of t.field.plants) {
        if (!isRipe(t.field.crop, pl)) continue;
        const d = Math.hypot(pl.sx - p.x, pl.sz - p.z);
        if (d < bd) {
          bd = d;
          best = { x: pl.sx, z: pl.sz };
        }
      }
      if (best && (!this.goal || Math.hypot(this.goal.x - best.x, this.goal.z - best.z) > 0.1)) this.moveTo(best.x, best.z);
    }
    this.follow();
  }

  private follow() {
    const g = this.g;
    const p = this.st.player;
    if (!this.goal) {
      g.input.x = 0;
      g.input.z = 0;
      return;
    }
    while (this.pathIdx < this.path.length) {
      const w = this.path[this.pathIdx];
      if (Math.hypot(w.x - p.x, w.z - p.z) < 0.2) this.pathIdx++;
      else break;
    }
    if (this.pathIdx >= this.path.length) {
      g.input.x = 0;
      g.input.z = 0;
      return;
    }
    const w = this.path[this.pathIdx];
    const dx = w.x - p.x;
    const dz = w.z - p.z;
    const d = Math.hypot(dx, dz);
    const k = this.pathIdx === this.path.length - 1 ? Math.min(1, d / 0.5) : 1;
    g.input.x = (dx / d) * k;
    g.input.z = (dz / d) * k;
  }
}

/** Fresh game that skips the tutorial gate (the bot plays it anyway). */
export function botGame() {
  const g = new Game();
  return g;
}

export { TUTORIAL_DONE };

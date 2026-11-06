/**
 * A headless player for the city: it walks through `game.input` like a human.
 * It buys what it can afford, serves the till, picks up the money and hauls
 * goods wherever nobody has been hired to do it yet.
 */
import { WORKER_STATS, type PlayerStatId, type WorkerStatId } from "@/game/data/balance";
import type { ItemId } from "@/game/data/items";
import { Game } from "@/game/engine/Game";
import { TUTORIAL_DONE } from "@/game/engine/tutorial";
import type { Machine, PadState, ShelfState, ShopState } from "@/game/engine/types";

type Task =
  | { kind: "pad"; pad: PadState; level: number | null }
  | { kind: "bin" }
  | { kind: "till"; shop: ShopState }
  | { kind: "cash"; shop: ShopState }
  | { kind: "fetch"; from: Machine; to: Drop }
  | { kind: "drop"; to: Drop }
  | { kind: "idle"; t: number };

type Drop = { shelf: ShelfState } | { machine: Machine };

const dropItem = (d: Drop, m?: Machine): ItemId[] => ("shelf" in d ? [d.shelf.def.item] : m ? m.type.inputs.map((i) => i.item) : d.machine.type.inputs.map((i) => i.item));

export class CityBot {
  task: Task | null = null;
  log: { t: number; what: string }[] = [];
  private repath = 0;
  private path: { x: number; z: number }[] = [];
  private pi = 0;
  private goal = { x: 0, z: 0 };
  private taskT = 0;
  /** Tasks that ran into the time limit, for the report. */
  stuck = 0;

  constructor(readonly g: Game) {}

  get st() {
    return this.g.state;
  }
  get city() {
    return this.st.city!;
  }

  run(seconds: number, dt: number, stop: () => boolean) {
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      this.step(dt);
      if (stop()) return true;
    }
    return false;
  }

  step(dt: number) {
    this.taskT += dt;
    if (this.task && this.taskT > 25 && this.task.kind !== "till") {
      this.stuck++;
      this.task = null;
    }
    if (!this.task || this.done()) {
      this.task = this.pick();
      this.taskT = 0;
    }
    this.act(dt);
    if (this.st.workers.length >= 2 && this.g.canWhistle()) this.g.whistle();
    this.g.tick(dt);
    for (const e of this.g.drainEvents()) {
      if (e.type === "purchase") this.log.push({ t: this.st.dayClock, what: e.label });
    }
  }

  // ── decisions ───────────────────────────────────────────────────────
  private nextGoal() {
    let best = Infinity;
    for (const p of this.st.pads) {
      if (!p.visible || (p.def.repeatable && p.def.effect.type !== "towerFloor")) continue;
      best = Math.min(best, (this.g.padCost(p) ?? Infinity) - p.paid);
    }
    return best;
  }

  private carriesTo(id: string, kind: "shelf" | "machine", item?: ItemId) {
    return this.st.workers.some((w) => {
      const j = w.def.job;
      if (j.kind !== "carrier") return false;
      if (kind === "shelf") return j.target.kind === "shelf" && j.target.id === id;
      if (j.target.kind !== "machine" || j.target.id !== id) return false;
      return !item || this.g.machine(j.source)?.type.output.item === item;
    });
  }

  private pick(): Task {
    const st = this.st;
    if (st.tutorial < TUTORIAL_DONE) return this.tutorial();
    const goalCost = this.nextGoal();

    // The cheapest thing on the list that can be paid for right now.
    let best: PadState | null = null;
    let bestCost = Infinity;
    for (const p of st.pads) {
      if (!p.visible) continue;
      const cost = (this.g.padCost(p) ?? Infinity) - p.paid;
      if (cost > st.money) continue;
      // Upgrades only when they are small change next to the next goal: the goal comes first.
      if (p.def.repeatable && p.def.effect.type !== "towerFloor" && cost > goalCost * 0.08) continue;
      if (cost < bestCost) {
        bestCost = cost;
        best = p;
      }
    }
    if (best) return { kind: "pad", pad: best, level: this.g.padLevel(best) };
    this.buyStats(goalCost);

    // Money lying around is the quickest way to the next purchase.
    let richest: ShopState | null = null;
    for (const s of this.city.shops) {
      if (this.hasCollector(s) || s.bundles === 0) continue;
      if (!richest || s.cash > richest.cash) richest = s;
    }
    if (richest && richest.cash > Math.min(goalCost * 0.15, st.money + 30)) return { kind: "cash", shop: richest };

    // A line at a till with nobody behind it.
    let longest: ShopState | null = null;
    for (const s of this.city.shops) {
      if (s.cashier || s.queue.length === 0) continue;
      if (!longest || s.queue.length > longest.queue.length) longest = s;
    }
    if (longest) return { kind: "till", shop: longest };

    const carried = st.player.stack[0];
    if (carried) {
      const d = this.dropFor(carried);
      if (d) return { kind: "drop", to: d };
      // Nobody wants this, and it is in the way.
      if (st.player.stack.length >= st.player.capacity) return { kind: "bin" };
    }

    const job = this.haulJob();
    if (job) return job;
    if (richest) return { kind: "cash", shop: richest };
    return { kind: "idle", t: 1 };
  }

  private tutorial(): Task {
    const st = this.st;
    const shop = this.city.shops[0];
    const shelf = shop.shelves[0];
    switch (st.tutorial) {
      case 0:
        return { kind: "fetch", from: st.machines[0], to: { shelf } };
      case 1:
        return { kind: "drop", to: { shelf } };
      case 2:
        return { kind: "till", shop };
      case 3:
        return { kind: "cash", shop };
      default: {
        const pad = st.pads.find((p) => p.visible && !p.def.repeatable);
        return pad ? { kind: "pad", pad, level: null } : { kind: "idle", t: 1 };
      }
    }
  }

  private buyStats(goalCost: number) {
    const st = this.st;
    for (const id of ["capacity", "speed"] as PlayerStatId[]) {
      const c = this.g.playerStatCost(id);
      if (c !== null && st.money >= c && c < goalCost * 0.1) this.g.buyPlayerStat(id);
    }
    if (st.workers.length === 0) return;
    for (const id of Object.keys(WORKER_STATS) as WorkerStatId[]) {
      const c = this.g.workerStatCost(id);
      if (c !== null && st.money >= c && c < goalCost * 0.1) this.g.buyWorkerStat(id);
    }
  }

  private hasCollector(s: ShopState) {
    return this.st.workers.some((w) => w.def.job.kind === "collector" && w.def.job.shop === s.id);
  }

  private shelfNeeding(item: ItemId) {
    for (const s of this.city.shops) {
      const shelf = s.shelves.find((x) => x.def.item === item && x.count < 8);
      if (shelf && !this.carriesTo(shelf.id, "shelf")) return shelf;
    }
    return null;
  }

  private dropFor(item: ItemId): Drop | null {
    const shelf = this.shelfNeeding(item);
    if (shelf) return { shelf };
    for (const m of this.st.machines) {
      if (m.type.inputs.some((i) => i.item === item) && (m.inputs[item] ?? 0) < 20) return { machine: m };
    }
    return null;
  }

  /** Whatever nobody hauls yet: the emptiest counter or kitchen with goods nearby. */
  private haulJob(): Task | null {
    const st = this.st;
    for (const s of this.city.shops) {
      for (const shelf of s.shelves) {
        if (shelf.count >= 6 || this.carriesTo(shelf.id, "shelf")) continue;
        const from = this.sourceOf(shelf.def.item, s);
        if (from) return { kind: "fetch", from, to: { shelf } };
      }
    }
    for (const m of st.machines) {
      for (const inp of m.type.inputs) {
        if ((m.inputs[inp.item] ?? 0) >= 8 || this.carriesTo(m.id, "machine", inp.item)) continue;
        const from = st.machines.find((x) => x.def.zone === m.def.zone && x.type.output.item === inp.item && x.output - x.incomingOut > 0);
        if (from) return { kind: "fetch", from, to: { machine: m } };
      }
    }
    return null;
  }

  private sourceOf(item: ItemId, s: ShopState) {
    return this.st.machines.find((m) => m.def.zone === s.def.zone && m.type.output.item === item && m.output - m.incomingOut > 0);
  }

  // ── execution ───────────────────────────────────────────────────────
  private done(): boolean {
    const t = this.task!;
    const st = this.st;
    const p = st.player;
    switch (t.kind) {
      case "pad":
        return t.pad.done || !t.pad.visible || st.money + t.pad.paid < (this.g.padCost(t.pad) ?? Infinity) - 0.01 || (!!t.pad.def.repeatable && this.g.padLevel(t.pad) !== t.level);
      case "bin":
        return p.stack.length === 0;
      case "till":
        return t.shop.cashier || t.shop.queue.length === 0;
      case "cash":
        return t.shop.bundles === 0;
      case "fetch":
        return p.stack.length >= p.capacity || (t.from.output - t.from.incomingOut <= 0 && p.zoneId === `out:${t.from.id}`);
      case "drop":
        return p.stack.length === 0 || ("shelf" in t.to ? !p.stack.includes(t.to.shelf.def.item) || t.to.shelf.count >= 16 : !p.stack.some((i) => dropItem(t.to).includes(i)));
      case "idle":
        return (t.t -= 1 / 15) <= 0;
    }
  }

  private act(dt: number) {
    const t = this.task!;
    switch (t.kind) {
      case "pad":
        return this.walk(t.pad.def.x, t.pad.def.z, dt);
      case "till":
        return this.walk(t.shop.def.till.x, t.shop.def.till.z, dt);
      case "cash":
        return this.walk(t.shop.def.cash.x, t.shop.def.cash.z, dt);
      case "fetch": {
        const p = this.st.player;
        if (p.stack.length > 0 && p.stack.length >= p.capacity) return;
        // Then straight to the target.
        return this.walk(t.from.outRect.x, t.from.outRect.z, dt, () => {
          this.task = { kind: "drop", to: t.to };
        });
      }
      case "drop": {
        if ("shelf" in t.to) return this.walk(t.to.shelf.def.staff.x, t.to.shelf.def.staff.z, dt);
        return this.walk(t.to.machine.inRect.x, t.to.machine.inRect.z, dt);
      }
      case "bin": {
        const b = this.city.shops[0].def.bin;
        return this.walk(b.x, b.z, dt);
      }
      case "idle": {
        // Never stand on a pad: it would quietly take all the money.
        const p = this.st.player;
        if (p.zoneId?.startsWith("pad:")) {
          const t0 = this.city.shops[0].def.till;
          return this.walk(t0.x, t0.z, dt);
        }
        this.g.input.x = 0;
        this.g.input.z = 0;
      }
    }
  }

  private walk(x: number, z: number, dt: number, arrived?: () => void) {
    const p = this.st.player;
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) {
      this.g.input.x = 0;
      this.g.input.z = 0;
      if (arrived && (p.stack.length >= p.capacity || p.zoneTime > 0.6)) arrived();
      return;
    }
    this.repath -= dt;
    if (this.repath <= 0 || this.goal.x !== x || this.goal.z !== z || this.pi >= this.path.length) {
      this.path = this.g.nav.findPath(p.x, p.z, x, z) ?? [{ x, z }];
      this.pi = 0;
      this.goal = { x, z };
      this.repath = 1;
    }
    let next = this.path[this.pi];
    if (Math.hypot(next.x - p.x, next.z - p.z) < 0.25 && this.pi < this.path.length - 1) next = this.path[++this.pi];
    const nx = next.x - p.x;
    const nz = next.z - p.z;
    const nd = Math.hypot(nx, nz) || 1;
    const slow = Math.min(1, d / 0.6);
    this.g.input.x = (nx / nd) * slow;
    this.g.input.z = (nz / nd) * slow;
  }
}

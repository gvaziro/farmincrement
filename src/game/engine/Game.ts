/**
 * The simulation. Pure TypeScript: no React, no three.js. Renderers read
 * `game.state` every frame; the UI listens to drained events.
 */
import { PRESTIGE_BONUS_PER_STAR, MACHINE_MAX_LEVEL, MARKET_MAX_LEVEL, PLAYER_STATS, TRUCK_MAX_LEVEL, WORKER_STATS, machineUpgradeCost, marketPriceMult, marketUpgradeCost, starsForEarnings, statCost, truckUpgradeCost, type PlayerStatId, type WorkerStatId } from "../data/balance";
import { ITEMS, type ItemId } from "../data/items";
import { fieldById, machineById, machineUpgradeBase, zoneById, type PadDef } from "../data/layout";
import { isHatId, type HatId } from "../data/hats";
import { unlockedHats, updateAchievements } from "./achievements";
import { inputSlot, localToWorld, outputSlot, stackSlotLocal } from "./anchors";
import { isNight } from "./daycycle";
import { NavGrid } from "./nav";
import { seasonDemand, seasonOf } from "./seasons";
import { currentWeather } from "./weather";
import { truckDockX, truckSlot, updateDepot } from "./systems/depot";
import { harvestAround, updateFields } from "./systems/harvest";
import { depotSlot, updateInteractions } from "./systems/interact";
import { updateMachines } from "./systems/machines";
import { moveActor } from "./systems/movement";
import { updateOrders } from "./systems/orders";
import { updateWorkers } from "./systems/workers";
import { TUTORIAL_DONE, TUTORIAL_PADS_STEP, updateTutorial } from "./tutorial";
import type { Actor, Anchor, FlightItem, GameEvent, GameState, InteractZone, Machine, PadState } from "./types";
import {
  applyStats,
  buildInteractZones,
  buildObstacles,
  createDepot,
  createField,
  createInitialState,
  createMachine,
  createTruck,
  createWorker,
  isLand,
} from "./world";

const MAX_FLIGHTS = 900;

export class Game {
  state: GameState;
  readonly nav = new NavGrid();
  /** Movement intent from keyboard / joystick, magnitude ≤ 1. */
  readonly input = { x: 0, z: 0 };

  private events: GameEvent[] = [];
  private machineMap = new Map<string, Machine>();
  private padMap = new Map<string, PadState>();
  private interactMap = new Map<string, InteractZone>();
  private actorMap = new Map<string, Actor>();

  constructor(state: GameState = createInitialState()) {
    this.state = state;
    this.rebuild();
  }

  // ── lookups ───────────────────────────────────────────────────────────
  machine(id: string) {
    return this.machineMap.get(id);
  }
  pad(id: string) {
    return this.padMap.get(id);
  }
  interactById(id: string) {
    return this.interactMap.get(id);
  }
  actor(id: string) {
    return this.actorMap.get(id);
  }

  emit(e: GameEvent) {
    this.events.push(e);
  }
  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Recompute everything derived from the set of entities. */
  rebuild() {
    const st = this.state;
    this.machineMap = new Map(st.machines.map((m) => [m.id, m]));
    this.padMap = new Map(st.pads.map((p) => [p.id, p]));
    this.actorMap = new Map<string, Actor>([["player", st.player], ...st.workers.map((w) => [w.id, w] as [string, Actor])]);

    const padsAllowed = st.tutorial >= TUTORIAL_PADS_STEP;
    for (const p of st.pads) {
      const was = p.visible;
      if (p.def.repeatable && !p.done) p.done = this.padCost(p) === null;
      p.visible =
        padsAllowed &&
        !p.done &&
        st.zones.has(p.def.zone) &&
        p.def.requires.every((r) => this.padMap.get(r)?.done) &&
        this.padCost(p) !== null;
      if (p.visible && !was) p.appearT = 0;
    }

    st.obstacles = buildObstacles(st);
    st.interact = buildInteractZones(st);
    this.interactMap = new Map(st.interact.map((z) => [z.id, z]));
    this.nav.rebuild((x, z, r) => isLand(st, x, z, r), st.obstacles);
    st.structure++;
  }

  // ── main loop ─────────────────────────────────────────────────────────
  tick(rawDt: number) {
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    const st = this.state;
    st.time += dt;
    st.stats.playTime += dt;
    const wasNight = isNight(st.dayClock);
    st.dayClock += dt;
    if (isNight(st.dayClock) !== wasNight) this.emit({ type: "dayPhase", phase: wasNight ? "dawn" : "night" });
    const season = seasonOf(st.dayClock);
    if (season !== st.season) {
      st.season = season;
      st.stats.seasons++;
      applyStats(st);
      this.emit({ type: "season", season });
    }
    const weather = currentWeather(st.dayClock);
    if (weather !== st.weather) {
      this.emit({ type: "weather", kind: weather, from: st.weather });
      st.weather = weather;
    }

    const p = st.player;
    p.fullT += dt;
    let ix = this.input.x;
    let iz = this.input.z;
    const mag = Math.hypot(ix, iz);
    if (mag > 1) {
      ix /= mag;
      iz /= mag;
    }
    moveActor(this, p, ix * p.speed, iz * p.speed, dt);
    harvestAround(this, p, null);

    updateWorkers(this, dt);
    updateFields(this, dt);
    updateInteractions(this, dt);
    updateMachines(this, dt);
    updateDepot(this, dt);
    updateOrders(this, dt);
    this.updateFlights(dt);
    for (const pad of st.pads) if (pad.visible) pad.appearT += dt;
    updateTutorial(this);
    updateAchievements(this, dt);
    this.updateIncome(dt);
  }

  private updateIncome(dt: number) {
    const ai = this.state.autoIncome;
    ai.window += dt;
    if (ai.window >= 15) {
      const r = ai.acc / ai.window;
      ai.rate = ai.rate === 0 ? r : ai.rate * 0.6 + r * 0.4;
      ai.acc = 0;
      ai.window = 0;
    }
  }

  // ── flights ───────────────────────────────────────────────────────────
  flight(item: FlightItem, fx: number, fy: number, fz: number, to: Anchor, dur: number, arcScale: number, land?: GameEvent) {
    const flights = this.state.flights;
    const dest = this.anchorPos(to);
    const d = Math.hypot(dest.x - fx, dest.z - fz);
    const f = {
      item,
      fx,
      fy,
      fz,
      to,
      t: 0,
      dur: dur * (0.85 + Math.min(d, 12) * 0.03),
      arc: arcScale * (0.5 + d * 0.16),
      spin: (Math.random() - 0.5) * 14,
      land,
    };
    if (flights.length >= MAX_FLIGHTS) this.landFlight(flights.shift()!);
    flights.push(f);
  }

  private updateFlights(dt: number) {
    const flights = this.state.flights;
    let w = 0;
    for (let i = 0; i < flights.length; i++) {
      const f = flights[i];
      f.t += dt / f.dur;
      if (f.t >= 1) this.landFlight(f);
      else flights[w++] = f;
    }
    flights.length = w;
  }

  private landFlight(f: GameState["flights"][number]) {
    const to = f.to;
    switch (to.kind) {
      case "stack": {
        const a = this.actorMap.get(to.actor);
        if (a) a.incoming = Math.max(0, a.incoming - 1);
        break;
      }
      case "pileIn": {
        const m = this.machineMap.get(to.machine);
        if (m) m.incomingIn[to.item] = Math.max(0, (m.incomingIn[to.item] ?? 0) - 1);
        break;
      }
      case "pileOut": {
        const m = this.machineMap.get(to.machine);
        if (m) m.incomingOut = Math.max(0, m.incomingOut - 1);
        break;
      }
      case "depot":
        if (this.state.depot) this.state.depot.incoming = Math.max(0, this.state.depot.incoming - 1);
        break;
      case "truck": {
        const t = this.state.depot?.trucks.find((x) => x.id === to.truck);
        if (t) t.incoming = Math.max(0, t.incoming - 1);
        break;
      }
    }
    if (f.land) this.emit(f.land);
  }

  /** World position of an anchor (without visual lean). */
  anchorPos(a: Anchor): { x: number; y: number; z: number } {
    switch (a.kind) {
      case "stack": {
        const actor = this.actorMap.get(a.actor);
        if (!actor) return { x: 0, y: 0, z: 0 };
        return this.stackSlotWorld(actor, a.slot);
      }
      case "pileIn": {
        const m = this.machineMap.get(a.machine);
        if (!m) return { x: 0, y: 0, z: 0 };
        return inputSlot(m, a.item, a.slot);
      }
      case "pileOut": {
        const m = this.machineMap.get(a.machine);
        if (!m) return { x: 0, y: 0, z: 0 };
        return outputSlot(m, a.slot);
      }
      case "depot":
        return depotSlot(a.slot);
      case "truck": {
        const t = this.state.depot?.trucks.find((x) => x.id === a.truck);
        if (!t) return { x: 0, y: 0, z: 0 };
        return truckSlot(t, a.slot);
      }
      case "actor": {
        const actor = this.actorMap.get(a.actor);
        return actor ? { x: actor.x, y: 1.1, z: actor.z } : { x: 0, y: 0, z: 0 };
      }
      case "point":
        return a;
    }
  }

  stackSlotWorld(a: Actor, slot: number) {
    const l = stackSlotLocal(a.stack, a.capacity, slot);
    const w = localToWorld(a.x, a.z, a.facing, l.x, l.z);
    return { x: w.x, y: l.y, z: w.z };
  }

  /** Push an item onto an actor's stack with a flight from (fx,fy,fz). */
  giveToActor(a: Actor, item: ItemId, fx: number, fy: number, fz: number, dur = 0.36) {
    const slot = a.stack.length;
    a.stack.push(item);
    a.incoming++;
    this.flight(item, fx, fy, fz, { kind: "stack", actor: a.id, slot }, dur, 1.0);
  }

  machineCore(m: Machine) {
    return { x: m.def.x + m.type.core[0], y: m.type.core[1], z: m.def.z + m.type.core[2] };
  }

  // ── economy ───────────────────────────────────────────────────────────
  priceMult() {
    return marketPriceMult(this.state.marketLevel) * (1 + this.state.prestige.stars * PRESTIGE_BONUS_PER_STAR);
  }
  sellValue(item: ItemId) {
    return ITEMS[item].price * this.priceMult() * seasonDemand(this.state.season, item);
  }
  earn(value: number, automated: boolean) {
    const st = this.state;
    st.money += value;
    st.stats.earned += value;
    st.runEarned += value;
    if (automated) st.autoIncome.acc += value;
  }

  /** Current price of a pad, or null if it is maxed out. */
  padCost(p: PadState): number | null {
    const e = p.def.effect;
    switch (e.type) {
      case "upgradeMachine": {
        const m = this.machineMap.get(e.id);
        const level = m?.level ?? 1;
        if (level >= MACHINE_MAX_LEVEL) return null;
        return machineUpgradeCost(machineUpgradeBase(machineById(e.id)), level);
      }
      case "upgradeMarket":
        return this.state.marketLevel >= MARKET_MAX_LEVEL ? null : marketUpgradeCost(this.state.marketLevel);
      case "upgradeTruck": {
        const lvl = this.state.depot?.truckLevel ?? 1;
        return lvl >= TRUCK_MAX_LEVEL ? null : truckUpgradeCost(lvl);
      }
      default:
        return p.def.cost;
    }
  }

  /** Level shown on a repeatable pad (the level you would buy). */
  padLevel(p: PadState): number | null {
    const e = p.def.effect;
    if (e.type === "upgradeMachine") return (this.machineMap.get(e.id)?.level ?? 1) + 1;
    if (e.type === "upgradeMarket") return this.state.marketLevel + 1;
    if (e.type === "upgradeTruck") return (this.state.depot?.truckLevel ?? 1) + 1;
    return null;
  }

  completePad(pad: PadState) {
    const st = this.state;
    const def: PadDef = pad.def;
    const e = def.effect;
    let levelUp: number | null = null;
    switch (e.type) {
      case "machine":
        if (!this.machineMap.has(e.id)) st.machines.push(createMachine(machineById(e.id), true));
        pad.done = true;
        break;
      case "field":
        if (!st.fields.some((f) => f.id === e.id)) st.fields.push(createField(fieldById(e.id), true));
        pad.done = true;
        break;
      case "zone": {
        st.zones.add(e.id);
        const z = zoneById(e.id);
        for (const fid of z.includes) {
          if (!st.fields.some((f) => f.id === fid)) st.fields.push(createField(fieldById(fid), true));
        }
        if (e.id === "depot" && !st.depot) st.depot = createDepot();
        this.emit({ type: "toast", text: `Новая земля: ${z.name}!`, icon: z.icon });
        pad.done = true;
        break;
      }
      case "worker": {
        if (!st.workers.some((w) => w.id === e.worker.id)) {
          st.workers.push(createWorker(e.worker, def.x, def.z));
          applyStats(st);
        }
        pad.done = true;
        break;
      }
      case "upgradeMachine": {
        const m = this.machineMap.get(e.id);
        if (m) {
          m.level++;
          levelUp = m.level;
        }
        pad.paid = 0;
        break;
      }
      case "upgradeMarket":
        st.marketLevel++;
        levelUp = st.marketLevel;
        pad.paid = 0;
        break;
      case "upgradeTruck":
        if (st.depot) {
          st.depot.truckLevel++;
          levelUp = st.depot.truckLevel;
        }
        pad.paid = 0;
        break;
      case "truck":
        if (st.depot) st.depot.trucks.push(createTruck(st.depot.trucks.length));
        pad.done = true;
        break;
      case "statue":
        st.statue = true;
        pad.done = true;
        this.emit({ type: "statue" });
        break;
    }
    st.stats.purchases++;
    if (levelUp !== null) this.emit({ type: "levelUp", pad: pad.id, level: levelUp, x: def.x, z: def.z });
    else this.emit({ type: "purchase", pad: pad.id, kind: def.kind, label: def.label, x: def.x, z: def.z });
    this.rebuild();
  }

  /** Cheapest visible progression pad — the "next goal" hint. */
  goal(): PadState | null {
    let best: PadState | null = null;
    let bestCost = Infinity;
    for (const p of this.state.pads) {
      if (!p.visible || p.def.repeatable) continue;
      const c = this.padCost(p) ?? Infinity;
      if (c < bestCost) {
        bestCost = c;
        best = p;
      }
    }
    return best;
  }

  // ── farmhouse upgrades (UI actions) ───────────────────────────────────
  playerStatCost(id: PlayerStatId) {
    return statCost(PLAYER_STATS[id], this.state.playerLevels[id]);
  }
  workerStatCost(id: WorkerStatId) {
    return statCost(WORKER_STATS[id], this.state.workerLevels[id]);
  }
  buyPlayerStat(id: PlayerStatId) {
    const cost = this.playerStatCost(id);
    if (cost === null || this.state.money < cost) return false;
    this.state.money -= cost;
    this.state.playerLevels[id]++;
    this.state.stats.purchases++;
    applyStats(this.state);
    this.emit({ type: "levelUp", pad: `player_${id}`, level: this.state.playerLevels[id], x: this.state.player.x, z: this.state.player.z });
    return true;
  }
  buyWorkerStat(id: WorkerStatId) {
    const cost = this.workerStatCost(id);
    if (cost === null || this.state.money < cost) return false;
    this.state.money -= cost;
    this.state.workerLevels[id]++;
    this.state.stats.purchases++;
    applyStats(this.state);
    this.emit({ type: "levelUp", pad: `worker_${id}`, level: this.state.workerLevels[id], x: this.state.player.x, z: this.state.player.z });
    return true;
  }

  // ── prestige ──────────────────────────────────────────────────────────
  prestigeStars() {
    return starsForEarnings(this.state.runEarned);
  }
  /**
   * A new generation takes over: the farm starts from scratch, but the stars
   * (a permanent price bonus) and the statistics are inherited.
   */
  prestige() {
    const old = this.state;
    if (!old.statue) return false;
    const next = createInitialState();
    next.prestige = { stars: old.prestige.stars + this.prestigeStars(), generations: old.prestige.generations + 1 };
    next.stats = { ...old.stats };
    next.made = { ...old.made };
    // Trophies and the hat are the family's.
    next.achievements = old.achievements;
    next.hat = old.hat;
    next.tutorial = TUTORIAL_DONE;
    // Keep the counter monotonic so views always notice the swap.
    next.structure = old.structure + 1;
    // The new generation starts on a fresh spring morning.
    next.dayClock = 0;
    this.state = next;
    this.events = [];
    this.rebuild();
    this.emit({ type: "toast", text: "Новое поколение фермеров!", icon: "⭐" });
    return true;
  }

  // ── wardrobe ──────────────────────────────────────────────────────────
  hats(): HatId[] {
    return unlockedHats(this.state.achievements);
  }
  /** Put on a hat (only one that has been earned). */
  wearHat(id: HatId) {
    if (!isHatId(id) || !this.hats().includes(id)) return false;
    this.state.hat = id;
    return true;
  }

  /** Where trucks stop (for renderers). */
  truckDock(index: number) {
    return truckDockX(index);
  }
}

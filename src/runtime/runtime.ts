/**
 * Glue between the engine and the outside world: loading/saving, offline
 * earnings, routing engine events to audio, effects and the HUD store.
 */
import { sfx } from "@/audio/sfx";
import { formatMoney } from "@/game/core/format";
import { ITEMS, type ItemId } from "@/game/data/items";
import { MARKET, ZONE_D, ZONE_W, ZONES, zoneById } from "@/game/data/layout";
import { Game } from "@/game/engine/Game";
import { SAVE_KEY, deserialize, isFutureSave, offlineEarnings, serialize } from "@/game/engine/save";
import { TUTORIAL, tutorialText } from "@/game/engine/tutorial";
import type { GameEvent } from "@/game/engine/types";
import { fx } from "@/render/fx";
import { pushToast, useUI } from "./store";

const SAVE_EVERY = 5;
const UI_EVERY = 0.1;

export class Runtime {
  game: Game;
  private saveTimer = 0;
  private uiTimer = 0;
  private hiddenAt: number | null = null;
  private resetting = false;

  constructor() {
    let savedAt = 0;
    let game: Game | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (isFutureSave(data)) throw new Error("save comes from a newer version of the game");
        game = new Game(deserialize(data));
        savedAt = typeof data.savedAt === "number" ? data.savedAt : 0;
        // Touch everything the first frame needs, so a bad save fails here.
        tutorialText(game);
        game.goal();
      }
    } catch (err) {
      console.warn("Save could not be loaded, starting fresh (a backup was kept)", err);
      backupSave();
      game = null;
      savedAt = 0;
    }
    this.game = game ?? new Game();
    if (savedAt > 0) this.grantOffline((Date.now() - savedAt) / 1000);
    this.syncUI();
  }

  private grantOffline(seconds: number) {
    if (seconds < 60) return;
    const res = offlineEarnings(this.game.state.autoIncome.rate, seconds);
    if (res.money < 1) return;
    this.game.earn(res.money, false);
    useUI.setState({ offline: { money: res.money, seconds: res.seconds } });
  }

  /** Called every frame from the R3F loop. */
  frame(dt: number) {
    this.game.tick(dt);
    for (const e of this.game.drainEvents()) this.handle(e);
    fx.update(dt);
    if (useUI.getState().structure !== this.game.state.structure) {
      useUI.setState({ structure: this.game.state.structure });
    }
    this.uiTimer += dt;
    if (this.uiTimer >= UI_EVERY) {
      this.uiTimer = 0;
      this.syncUI();
    }
    this.saveTimer += dt;
    if (this.saveTimer >= SAVE_EVERY) this.save();
  }

  save() {
    this.saveTimer = 0;
    if (this.resetting) return;
    try {
      // While the tab is hidden the simulation is paused: stamp the moment it
      // stopped, so closing a hidden tab still earns offline income for it.
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(this.game.state, this.hiddenAt ?? Date.now())));
    } catch {
      /* storage full or unavailable */
    }
  }

  /** Tab hidden → remember time; visible again after a while → offline income. */
  visibility(hidden: boolean) {
    if (hidden) {
      this.hiddenAt = Date.now();
      this.save();
    } else if (this.hiddenAt) {
      this.grantOffline((Date.now() - this.hiddenAt) / 1000);
      this.hiddenAt = null;
    }
    sfx.suspend(hidden);
  }

  resetProgress() {
    this.resetting = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  prestige() {
    if (!this.game.prestige()) return;
    fx.reset();
    for (const e of this.game.drainEvents()) this.handle(e);
    this.save();
    this.syncUI();
  }

  syncUI() {
    const g = this.game;
    const st = g.state;
    const tutorial = tutorialText(g);
    let hint: { icon: string; text: string; item?: ItemId } | null = null;
    if (tutorial) hint = { icon: TUTORIAL[st.tutorial].icon, item: TUTORIAL[st.tutorial].item, text: tutorial };
    const goalPad = st.tutorial >= TUTORIAL.length ? g.goal() : null;
    const goal = goalPad ? { label: goalPad.def.label, icon: goalPad.def.icon, cost: g.padCost(goalPad) ?? 0 } : null;
    const ui = useUI.getState();
    const money = Math.floor(st.money);
    const carried = st.player.stack.length;
    const cap = st.player.capacity;
    const changed =
      ui.money !== money ||
      ui.hint?.text !== hint?.text ||
      ui.goal?.label !== goal?.label ||
      ui.goal?.cost !== goal?.cost ||
      ui.stars !== st.prestige.stars ||
      ui.statue !== st.statue ||
      ui.carry[0] !== carried ||
      ui.carry[1] !== cap;
    if (changed || ui.panel) {
      useUI.setState({ money, hint, goal, stars: st.prestige.stars, statue: st.statue, carry: [carried, cap], tick: ui.tick + 1 });
    }
  }

  /** Puffs along every fence that just disappeared around a bought plot. */
  private fenceBurst(padId: string) {
    const pad = this.game.pad(padId);
    if (!pad || pad.def.effect.type !== "zone") return;
    const zone = zoneById(pad.def.effect.id);
    const zones = this.game.state.zones;
    const open = (gx: number, gz: number) => ZONES.some((z) => z.gx === gx && z.gz === gz && z.id !== zone.id && zones.has(z.id));
    const cx = zone.gx * ZONE_W;
    const cz = zone.gz * ZONE_D;
    const sides: [number, number, number, number, boolean][] = [
      [cx - ZONE_W / 2, cz - ZONE_D / 2, cx + ZONE_W / 2, cz - ZONE_D / 2, open(zone.gx, zone.gz - 1)],
      [cx - ZONE_W / 2, cz + ZONE_D / 2, cx + ZONE_W / 2, cz + ZONE_D / 2, open(zone.gx, zone.gz + 1)],
      [cx - ZONE_W / 2, cz - ZONE_D / 2, cx - ZONE_W / 2, cz + ZONE_D / 2, open(zone.gx - 1, zone.gz)],
      [cx + ZONE_W / 2, cz - ZONE_D / 2, cx + ZONE_W / 2, cz + ZONE_D / 2, open(zone.gx + 1, zone.gz)],
    ];
    for (const [x1, z1, x2, z2, shared] of sides) {
      if (!shared) continue;
      const len = Math.hypot(x2 - x1, z2 - z1);
      for (let d = 0; d <= len; d += 1.6) {
        const t = d / len;
        fx.poof(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0.7, "#f3ead8");
      }
    }
    // A forest plot is being cleared: leaves fly everywhere.
    if (zone.wild === "forest") {
      for (let i = 0; i < 40; i++) {
        const x = cx + (Math.random() - 0.5) * (ZONE_W - 2);
        const z = cz + (Math.random() - 0.5) * (ZONE_D - 2);
        fx.burst(x, 1.5 + Math.random() * 1.5, z, i % 3 ? "#4fae3a" : "#7cc24f", 6, 3, 0.1);
      }
    }
  }

  private nearPlayer(x: number, z: number, r = 14) {
    const p = this.game.state.player;
    return Math.abs(p.x - x) < r && Math.abs(p.z - z) < r;
  }

  private handle(e: GameEvent) {
    switch (e.type) {
      case "harvest":
        fx.burst(e.x, 0.4, e.z, ITEMS[e.item].color, e.player ? 5 : 3, 2.4, 0.07);
        if (e.player) sfx.play("pop");
        break;
      case "drop":
        if (e.player) sfx.play("drop");
        break;
      case "pick":
        if (e.player) sfx.play("pick");
        break;
      case "saleLand":
        fx.coins(e.x, e.y, e.z, 3);
        fx.text(`+$${formatMoney(e.value)}`, e.x, e.y + 0.6, e.z, "money");
        if (this.nearPlayer(e.x, e.z)) sfx.play("coin");
        break;
      case "padTick": {
        const pad = this.game.pad(e.pad);
        const cost = pad ? this.game.padCost(pad) : null;
        sfx.play("tick", pad && cost ? pad.paid / cost : 0);
        break;
      }
      case "purchase":
        fx.confetti(e.x, 0.6, e.z);
        fx.poof(e.x, e.z, e.kind === "land" ? 2.2 : 1.4);
        fx.shake = Math.max(fx.shake, 0.35);
        sfx.play("purchase");
        vibrate(e.kind === "land" ? [30, 40, 30] : 25);
        if (e.kind === "land") this.fenceBurst(e.pad);
        if (e.kind === "land") sfx.play("whoosh");
        if (e.kind === "hire") fx.text("Нанят!", e.x, 2.2, e.z, "info");
        break;
      case "levelUp":
        fx.confetti(e.x, 0.8, e.z, 22);
        fx.text(`Ур. ${e.level}`, e.x, 2.0, e.z, "level");
        sfx.play("level");
        vibrate(15);
        break;
      case "full":
        if (e.actor === "player") {
          const p = this.game.state.player;
          fx.text("МАКС", p.x, 2.4 + Math.min(p.stack.length, 30) * 0.12, p.z, "max");
          sfx.play("full");
        }
        break;
      case "produce":
        break;
      case "trashed":
        fx.burst(e.x, 0.8, e.z, ITEMS[e.item].color, 4, 1.8, 0.07);
        fx.dust(e.x, e.z);
        break;
      case "zone":
        useUI.setState({ panel: e.kind === "farmhouse" ? "farmhouse" : null });
        break;
      case "toast":
        pushToast(e.text, e.icon);
        break;
      case "truckSold":
        fx.coins(e.x, 1.6, e.z, 10);
        fx.text(`+$${formatMoney(e.value)}`, e.x, 3, e.z, "big");
        if (this.nearPlayer(e.x, e.z, 20)) sfx.play("cash");
        break;
      case "tutorial":
        sfx.play("ding");
        if (e.step >= TUTORIAL.length) pushToast("Отлично! Теперь развивай ферму", "🎉");
        break;
      case "order":
        if (e.state === "new") {
          pushToast("Новый заказ на рынке!", "📋");
          sfx.play("ding");
        } else {
          fx.confetti(MARKET.x, 3.2, MARKET.z, 40);
          fx.text(`Заказ! +$${formatMoney(e.reward ?? 0)}`, MARKET.x, 4.4, MARKET.z, "big");
          sfx.play("cash");
          sfx.play("purchase");
          vibrate([20, 30, 20]);
        }
        break;
      case "statue": {
        const p = this.game.state.player;
        for (let i = 0; i < 4; i++) fx.confetti(p.x + (i - 1.5) * 2, 1, p.z, 60);
        fx.shake = 1;
        pushToast("Империя построена! Загляни в дом фермера", "🏆");
        break;
      }
    }
  }
}

/** Keep an unreadable (or newer-version) save instead of overwriting it. */
function backupSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) localStorage.setItem(`${SAVE_KEY}/backup-${Date.now()}`, raw);
  } catch {
    /* storage unavailable */
  }
}

/** Short haptic tick on phones (ignored where unsupported). */
function vibrate(pattern: number | number[]) {
  if (!useUI.getState().settings.sound) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not allowed without a gesture — fine */
  }
}

let runtime: Runtime | null = null;

export function getRuntime() {
  if (!runtime) runtime = new Runtime();
  return runtime;
}

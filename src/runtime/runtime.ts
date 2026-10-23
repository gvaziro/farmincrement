/**
 * Glue between the engine and the outside world: loading/saving, offline
 * earnings, routing engine events to audio, effects and the HUD store.
 */
import { sfx } from "@/audio/sfx";
import { formatMoney } from "@/game/core/format";
import { ITEMS, type ItemId } from "@/game/data/items";
import { MARKET, ZONE_D, ZONE_W, ZONES, zoneById } from "@/game/data/layout";
import { dayNumber, dayPhase, nightFactor, timeOfDay } from "@/game/engine/daycycle";
import { Game } from "@/game/engine/Game";
import { HATS } from "@/game/data/hats";
import { achievementById } from "@/game/engine/achievements";
import { SEASONS } from "@/game/engine/seasons";
import { WEATHER_NAMES, rainbowAt, weatherAt } from "@/game/engine/weather";
import { SAVE_KEY, deserialize, isFutureSave, offlineEarnings, serialize, type SaveData } from "@/game/engine/save";
import { encodeSave } from "@/game/engine/saveCode";
import { TUTORIAL, tutorialText } from "@/game/engine/tutorial";
import type { GameEvent } from "@/game/engine/types";
import { fx } from "@/render/fx";
import { NEWS_VERSION } from "@/ui/news";
import { addBackup, migrateLegacyBackups, type Backup, type BackupReason } from "./backups";
import { pushToast, updateSettings, useUI } from "./store";
import { LOCK_BEAT, LOCK_KEY, TabLock, tabId } from "./tabLock";

const SAVE_EVERY = 5;
const UI_EVERY = 0.1;
/** An automatic backup every this many seconds of play. */
const BACKUP_EVERY = 600;

export class Runtime {
  game: Game;
  private saveTimer = 0;
  private uiTimer = 0;
  private backupTimer = 0;
  private hiddenAt: number | null = null;
  /** Set right before a reload that replaced the save: nothing may write it again. */
  private reloading = false;
  private readonly lock: TabLock | null;
  /** Another tab owns the farm: this one neither simulates nor saves. */
  private passive = false;
  private channel: BroadcastChannel | null = null;
  /** When the save was last written (ms), for the settings screen. */
  lastSaveAt = 0;
  /** The save as it was loaded — kept as a "when the game started" backup. */
  private loadedRaw: string | null = null;

  constructor() {
    let savedAt = 0;
    let game: Game | null = null;
    let lock: TabLock | null = null;
    try {
      migrateLegacyBackups(localStorage);
      lock = new TabLock(tabId(), localStorage);
      this.passive = !lock.acquire();
    } catch {
      /* no storage: nothing to lock or back up */
    }
    this.lock = lock;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (isFutureSave(data)) throw new Error("save comes from a newer version of the game");
        game = new Game(deserialize(data));
        savedAt = typeof data.savedAt === "number" ? data.savedAt : 0;
        // Touch everything the first frame needs, so a bad save fails here.
        tutorialText(game);
        game.goal();
        this.loadedRaw = raw;
      }
    } catch (err) {
      console.warn("Save could not be loaded, starting fresh (a backup was kept)", err);
      // Keep the unreadable (or newer-version) save instead of overwriting it.
      if (raw) this.keep("broken", raw);
      game = null;
      savedAt = 0;
    }
    this.game = game ?? new Game();
    this.savedAt = savedAt;
  }

  private savedAt = 0;
  private started = false;

  /**
   * Push the initial state to the HUD, pay offline income, start watching
   * the other tabs. Called from an effect (not during render), once.
   */
  start() {
    if (this.started) return;
    this.started = true;
    this.watchTabs();
    if (this.passive) {
      useUI.setState({ tabBlocked: "other" });
      sfx.suspend(true);
    } else {
      if (this.loadedRaw) this.keep("start", this.loadedRaw);
      if (this.savedAt > 0) this.grantOffline((Date.now() - this.savedAt) / 1000);
    }
    // Returning players get a "what's new"; new ones have nothing to compare with.
    if (useUI.getState().settings.seenNews < NEWS_VERSION) {
      if (this.loadedRaw) useUI.setState({ news: true });
      else updateSettings({ seenNews: NEWS_VERSION });
    }
    this.syncUI();
  }

  // ── one tab at a time ─────────────────────────────────────────────────
  private watchTabs() {
    const lock = this.lock;
    if (!lock) return;
    setInterval(() => {
      // A missing lock (storage cleared) is simply taken back.
      if (!this.passive && !lock.beat() && !lock.acquire()) this.becomePassive("taken");
    }, LOCK_BEAT);
    window.addEventListener("storage", (e) => {
      // Only another tab *taking* the lock matters; one closing (releasing it) does not.
      if (e.key === LOCK_KEY && !this.passive && lock.heldElsewhere()) this.becomePassive("taken");
    });
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("tiny-farm-empire");
      // Another tab is about to take over: hand it the freshest progress.
      this.channel.onmessage = (e) => {
        if (e.data !== "save-now" || this.passive) return;
        this.save();
        this.becomePassive("taken");
      };
    }
  }

  private becomePassive(reason: "other" | "taken") {
    if (this.passive) return;
    this.passive = true;
    useUI.setState({ tabBlocked: reason, panel: null, settingsOpen: false });
    sfx.suspend(true);
  }

  /** "Play here": ask the active tab to save, take the lock, reload with its progress. */
  takeOver() {
    this.channel?.postMessage("save-now");
    setTimeout(() => {
      this.lock?.acquire(true);
      this.reloading = true;
      window.location.reload();
    }, 400);
  }

  /** The page is going away (closed, reloaded, sent to the back-forward cache). */
  unload() {
    this.save();
    this.lock?.release();
  }

  /** Coming back from the back-forward cache: someone may have taken over meanwhile. */
  pageShow(persisted: boolean) {
    if (!persisted || this.passive || !this.lock) return;
    if (!this.lock.acquire()) this.becomePassive("taken");
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
    // The farm lives in another tab: show it frozen, change nothing.
    if (this.passive) return;
    this.game.tick(dt);
    for (const e of this.game.drainEvents()) this.handle(e);
    fx.update(dt);
    const ui = useUI.getState();
    const st = this.game.state;
    const visual = ui.settings.seasons;
    const w = weatherAt(st.dayClock);
    sfx.ambient(
      dt,
      ui.settings.dayNight ? nightFactor(timeOfDay(st.dayClock)) : 0,
      visual ? st.season : "summer",
      visual ? st.weather : "clear",
      visual && w.kind === "rain" ? w.k : 0,
    );
    if (ui.structure !== this.game.state.structure) {
      useUI.setState({ structure: this.game.state.structure });
    }
    this.uiTimer += dt;
    if (this.uiTimer >= UI_EVERY) {
      this.uiTimer = 0;
      this.syncUI();
    }
    this.saveTimer += dt;
    if (this.saveTimer >= SAVE_EVERY) this.save();
    this.backupTimer += dt;
    if (this.backupTimer >= BACKUP_EVERY) {
      this.backupTimer = 0;
      this.backup("auto");
    }
  }

  /** Write the save. Only the tab that owns the farm does; returns whether it did. */
  save() {
    this.saveTimer = 0;
    if (this.reloading || this.passive) return false;
    if (this.lock && !this.lock.owns() && !this.lock.acquire()) {
      this.becomePassive("taken");
      return false;
    }
    try {
      // While the tab is hidden the simulation is paused: stamp the moment it
      // stopped, so closing a hidden tab still earns offline income for it.
      localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(this.game.state, this.hiddenAt ?? Date.now())));
      this.lastSaveAt = Date.now();
      return true;
    } catch {
      /* storage full or unavailable */
      return false;
    }
  }

  /** Tab hidden → remember time; visible again after a while → offline income. */
  visibility(hidden: boolean) {
    if (hidden) {
      this.hiddenAt = Date.now();
      this.save();
    } else {
      // Asleep in the background, the lock may have gone to another tab.
      if (!this.passive && this.lock && !this.lock.owns() && !this.lock.acquire()) this.becomePassive("taken");
      if (this.hiddenAt && !this.passive) this.grantOffline((Date.now() - this.hiddenAt) / 1000);
      this.hiddenAt = null;
    }
    sfx.suspend(hidden || this.passive);
  }

  // ── backups, export, import ───────────────────────────────────────────
  private keep(reason: BackupReason, raw: string) {
    try {
      addBackup(localStorage, reason, raw);
    } catch {
      /* storage unavailable */
    }
  }

  /** Back up the farm as it is right now. */
  backup(reason: BackupReason) {
    if (this.passive) return;
    this.keep(reason, JSON.stringify(serialize(this.game.state)));
  }

  /** The save as a one-line code (to paste in another browser). */
  exportCode() {
    return encodeSave(serialize(this.game.state));
  }

  /** The save as pretty JSON (for a file). */
  exportJson() {
    return JSON.stringify(serialize(this.game.state), null, 1);
  }

  /** Replace the farm with `data` (the current one is backed up first) and reload. */
  importSave(data: SaveData) {
    this.backup("import");
    // No offline income for the time the save spent in a file.
    this.replaceSave(JSON.stringify({ ...data, savedAt: Date.now() }));
  }

  /** Go back to a backup (the current farm is backed up first) and reload. */
  restoreBackup(b: Backup) {
    this.backup("restore");
    let raw = b.raw;
    try {
      raw = JSON.stringify({ ...JSON.parse(b.raw), savedAt: Date.now() });
    } catch {
      /* keep it as it is: the loader will deal with it */
    }
    this.replaceSave(raw);
  }

  private replaceSave(raw: string) {
    try {
      localStorage.setItem(SAVE_KEY, raw);
    } catch {
      pushToast("Не получилось записать сохранение: память браузера заполнена", "⚠️");
      return;
    }
    this.reloading = true;
    window.location.reload();
  }

  resetProgress() {
    this.backup("reset");
    this.reloading = true;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  prestige() {
    this.backup("prestige");
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
    const day = dayNumber(st.dayClock);
    const phase = dayPhase(timeOfDay(st.dayClock));
    const season = st.season;
    const weather = st.weather;
    const rainbow = rainbowAt(st.dayClock) > 0.3;
    const changed =
      ui.money !== money ||
      ui.hint?.text !== hint?.text ||
      ui.goal?.label !== goal?.label ||
      ui.goal?.cost !== goal?.cost ||
      ui.stars !== st.prestige.stars ||
      ui.statue !== st.statue ||
      ui.carry[0] !== carried ||
      ui.carry[1] !== cap ||
      ui.clock.day !== day ||
      ui.clock.phase !== phase ||
      ui.clock.season !== season ||
      ui.clock.weather !== weather ||
      ui.clock.rainbow !== rainbow ||
      ui.hat !== st.hat ||
      ui.trophies !== st.achievements.size;
    if (changed || ui.panel) {
      useUI.setState({ money, hint, goal, stars: st.prestige.stars, statue: st.statue, carry: [carried, cap], clock: { day, phase, season, weather, rainbow }, hat: st.hat, trophies: st.achievements.size, tick: ui.tick + 1 });
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
        } else if (e.state === "fair") {
          pushToast("Ярмарка! Сезонный заказ — награда ×2", "🎪");
          sfx.play("season");
        } else if (e.state === "expired") {
          pushToast("Ярмарка закончилась — до следующего сезона!", "🎪");
        } else {
          fx.confetti(MARKET.x, 3.2, MARKET.z, e.fair ? 90 : 40);
          fx.text(`${e.fair ? "Ярмарка" : "Заказ"}! +${formatMoney(e.reward ?? 0)}`, MARKET.x, 4.4, MARKET.z, "big");
          sfx.play("cash");
          sfx.play("purchase");
          vibrate([20, 30, 20]);
        }
        break;
      case "dayPhase":
        // Only worth a toast once the pond is there to take advantage of it.
        if (e.phase === "night" && this.game.state.zones.has("pond")) {
          pushToast("Ночь: рыба клюёт вдвое чаще!", "🎣");
        }
        break;
      case "season": {
        const def = SEASONS[e.season];
        pushToast(`${def.arrival}: ${def.perk}`, def.icon);
        pushToast(`Сезонный спрос ×1.5: ${def.demand.map((i) => ITEMS[i].name.toLowerCase()).join(", ")}`, "📈");
        const p = this.game.state.player;
        fx.confetti(p.x, 1.2, p.z, 50, SEASON_CONFETTI[e.season]);
        sfx.play("season");
        break;
      }
      case "weather":
        if (e.kind === "rain") pushToast("Дождь! Посадки растут в 1.5 раза быстрее", WEATHER_NAMES.rain.icon);
        else if (e.kind === "snow") pushToast("Снегопад — красота!", WEATHER_NAMES.snow.icon);
        else if (e.kind === "fog") pushToast("Утренний туман", WEATHER_NAMES.fog.icon);
        else if (e.from === "rain" && (this.game.state.season === "spring" || this.game.state.season === "summer")) pushToast("После дождя — радуга!", "🌈");
        break;
      case "achievement": {
        const a = achievementById(e.id);
        if (!a) break;
        pushToast(`Достижение: ${a.name}`, a.icon);
        if (a.hat) pushToast(`Новая шляпа — ${HATS[a.hat].name}! Надень её в доме фермера`, HATS[a.hat].icon);
        const p = this.game.state.player;
        fx.confetti(p.x, 1.6, p.z, 36, ["#ffd23f", "#ffcc33", "#fff1a8", "#ff9f1c"]);
        sfx.play("level");
        break;
      }
      case "bonusHarvest":
        if (e.player || this.nearPlayer(e.x, e.z, 8)) fx.text("+1", e.x, 1.4, e.z, "level");
        if (e.player) sfx.play("pick");
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

/** Confetti colours of each season's arrival. */
const SEASON_CONFETTI = {
  spring: ["#ffb7c5", "#ffffff", "#ff8fb1", "#b8f08a"],
  summer: ["#ffd23f", "#7be35d", "#3fa7ff", "#ff9f1c"],
  autumn: ["#ff9f1c", "#e8413c", "#ffd23f", "#b5651d"],
  winter: ["#ffffff", "#cfe8ff", "#9fd2ff", "#e9f6ff"],
} as const;

/** Short haptic tick on phones (ignored where unsupported). */
function vibrate(pattern: number | number[]) {
  if (!useUI.getState().settings.vibration) return;
  // Browsers reject (and log) vibration before the first tap; desktops can't vibrate.
  const nav = navigator as Navigator & { userActivation?: { hasBeenActive: boolean } };
  if (!nav.userActivation?.hasBeenActive || !window.matchMedia?.("(pointer: coarse)").matches) return;
  try {
    nav.vibrate?.(pattern);
  } catch {
    /* not allowed — fine */
  }
}

let runtime: Runtime | null = null;

export function getRuntime() {
  if (!runtime) runtime = new Runtime();
  return runtime;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, formatMoney } from "@/game/core/format";
import { ITEMS, type ItemId } from "@/game/data/items";
import { dayNumber } from "@/game/engine/daycycle";
import { DAYS_PER_SEASON, SEASONS, nextSeason, seasonDay, seasonTimeLeft, yearNumber } from "@/game/engine/seasons";
import { WEATHER_NAMES, weatherOfDay, weatherStartsIn } from "@/game/engine/weather";
import { itemIconUrl, useItemIconsVersion } from "@/render/itemIcons";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { FarmhousePanel } from "./FarmhousePanel";
import { TabBlockedModal, WhatsNewModal } from "./Notices";
import { SettingsModal } from "./SettingsModal";

export function Hud({ runtime }: { runtime: Runtime }) {
  return (
    <div className="hud">
      <TopBar runtime={runtime} />
      <Hint />
      <Toasts />
      <ControlsHint runtime={runtime} />
      <FarmhousePanel runtime={runtime} />
      <OfflineModal />
      <WhatsNewModal />
      <SettingsModal runtime={runtime} />
      <TabBlockedModal runtime={runtime} />
    </div>
  );
}

function TopBar({ runtime }: { runtime: Runtime }) {
  const money = useUI((s) => s.money);
  const stars = useUI((s) => s.stars);
  const [shown, setShown] = useState(money);
  const [bump, setBump] = useState(0);
  const prev = useRef(money);
  const shownRef = useRef(money);

  // Count smoothly towards the real value (time-based, always lands exactly).
  useEffect(() => {
    if (money > prev.current) setBump((b) => b + 1);
    prev.current = money;
    const from = shownRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 350);
      const v = k >= 1 ? money : from + (money - from) * (1 - Math.pow(1 - k, 3));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [money]);

  return (
    <div className="topbar">
      <div key={bump} className="money money--bump">
        <span className="money__coin">$</span>
        <span className="money__value">{formatMoney(shown)}</span>
      </div>
      <Carry />
      <DayClock runtime={runtime} />
      {stars > 0 && (
        <div className="stars" title="Звёзды наследия — их тратят в доме фермера, вкладка «Наследие»">
          ⭐ {stars}
        </div>
      )}
      <button className="icon-btn topbar__settings" aria-label="Настройки" onClick={() => useUI.setState({ settingsOpen: true })}>
        ⚙️
      </button>
    </div>
  );
}

const PHASE_ICON = { dawn: "🌅", day: "☀️", sunset: "🌇", night: "🌙" } as const;
const PHASE_NAME = { dawn: "Рассвет", day: "День", sunset: "Закат", night: "Ночь" } as const;

/** Season and time of day, top-left. Tap for the season card. */
function DayClock({ runtime }: { runtime: Runtime }) {
  const phase = useUI((s) => s.clock.phase);
  const season = useUI((s) => s.clock.season);
  const weather = useUI((s) => s.clock.weather);
  const rainbow = useUI((s) => s.clock.rainbow);
  const [open, setOpen] = useState(false);
  const def = SEASONS[season];
  const sky = rainbow ? "🌈" : weather !== "clear" ? WEATHER_NAMES[weather].icon : null;
  return (
    <div className="clock-wrap">
      <button
        key={`${season}${phase}`}
        className={`clock clock--${phase} clock--${season}`}
        title={`${def.name} · ${PHASE_NAME[phase]}${weather !== "clear" ? ` · ${WEATHER_NAMES[weather].name}` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="clock__icon">{def.icon}</span>
        <span className="clock__name">{def.name}</span>
        <span className="clock__phase">{PHASE_ICON[phase]}</span>
        {sky && <span className="clock__phase">{sky}</span>}
      </button>
      {open && <SeasonCard runtime={runtime} onClose={() => setOpen(false)} />}
    </div>
  );
}

/** What this season gives, what sells better and how long it lasts. */
function SeasonCard({ runtime, onClose }: { runtime: Runtime; onClose: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.(".clock-wrap")) onClose();
    };
    window.addEventListener("pointerdown", close);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointerdown", close);
    };
  }, [onClose]);
  const clock = runtime.game.state.dayClock;
  const def = SEASONS[runtime.game.state.season];
  const next = SEASONS[nextSeason(def.id)];
  const left = Math.max(60, seasonTimeLeft(clock));
  const now = runtime.game.state.weather;
  const today = weatherOfDay(dayNumber(clock));
  const soon = weatherStartsIn(clock);
  const sky =
    now !== "clear"
      ? `${WEATHER_NAMES[now].name}${now === "rain" ? " — посадки растут ×1.5" : ""}`
      : soon !== null
        ? `Сегодня ещё: ${WEATHER_NAMES[today.kind].name.toLowerCase()}, через ${formatDuration(soon)}`
        : null;
  return (
    <div className={`season-card season-card--${def.id}`} onClick={onClose}>
      <div className="season-card__head">
        <span className="season-card__icon">{def.icon}</span>
        <div>
          <b>{def.name}</b>
          <span>
            день {seasonDay(clock)} из {DAYS_PER_SEASON} · год {yearNumber(clock)}
          </span>
        </div>
      </div>
      <div className="season-card__row">
        <span>🎁</span>
        <span>{def.perk[0].toUpperCase() + def.perk.slice(1)}</span>
      </div>
      <div className="season-card__row">
        <span>📈</span>
        <span>Спрос ×1.5:</span>
        <span className="season-card__goods">
          {def.demand.map((item) => (
            <ItemIcon key={item} item={item} fallback={ITEMS[item].icon} size={26} />
          ))}
        </span>
      </div>
      {sky && (
        <div className="season-card__row">
          <span>{WEATHER_NAMES[now !== "clear" ? now : today.kind].icon}</span>
          <span>{sky}</span>
        </div>
      )}
      <div className="season-card__foot">
        До {next.genitive} {next.icon} — {formatDuration(left)}
      </div>
    </div>
  );
}

function Carry() {
  const [n, cap] = useUI((s) => s.carry);
  const full = n >= cap;
  return (
    <div className={`carry ${full ? "carry--full" : ""}`} title="Сколько несёшь">
      <span className="carry__icon">🎒</span>
      <span>
        {n}/{cap}
      </span>
    </div>
  );
}

function Hint() {
  const hint = useUI((s) => s.hint);
  const goal = useUI((s) => s.goal);
  const money = useUI((s) => s.money);
  if (hint) {
    return (
      <div key={hint.text} className="hint hint--tutorial">
        <ItemIcon item={hint.item} fallback={hint.icon} />
        <span>{hint.text}</span>
      </div>
    );
  }
  if (!goal) return null;
  const p = Math.min(1, money / Math.max(1, goal.cost));
  return (
    <div className={`hint hint--goal ${p >= 1 ? "hint--ready" : ""}`}>
      <span className="hint__icon">{goal.icon}</span>
      <span className="hint__label">
        {p >= 1 ? "Можно купить: " : "Цель: "}
        <b>{goal.label}</b>
      </span>
      <span className="hint__bar">
        <span style={{ width: `${p * 100}%` }} />
      </span>
      <span className="hint__cost">${formatMoney(goal.cost)}</span>
    </div>
  );
}

/** Rendered 3D item icon, or the emoji until icons are ready. */
function ItemIcon({ item, fallback, size = 30 }: { item?: ItemId; fallback: string; size?: number }) {
  useItemIconsVersion();
  const url = item ? itemIconUrl(item) : undefined;
  if (!url) return <span className="hint__icon">{fallback}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- data URL rendered at runtime
  return <img className="hint__img" src={url} alt={item ? ITEMS[item].name : ""} title={item ? ITEMS[item].name : undefined} width={size} height={size} style={{ width: size, height: size }} draggable={false} />;
}

function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast__icon">{t.icon}</span>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function ControlsHint({ runtime }: { runtime: Runtime }) {
  const [visible, setVisible] = useState(() => runtime.game.state.stats.playTime < 20);
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      const p = runtime.game.state.player;
      if (Math.hypot(p.x + 2.6, p.z - 1.4) > 3) setVisible(false);
    }, 300);
    return () => clearInterval(id);
  }, [visible, runtime]);
  if (!visible) return null;
  const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  return (
    <div className="controls-hint">
      <div className="controls-hint__hand">{touch ? "👆" : "⌨️"}</div>
      {touch ? "Зажми экран и веди пальцем, чтобы бежать" : "WASD / стрелки — бег · или зажми мышь и тяни"}
    </div>
  );
}

function OfflineModal() {
  const offline = useUI((s) => s.offline);
  if (!offline) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal modal--offline">
        <div className="modal__emoji">🌙</div>
        <h2>Пока тебя не было…</h2>
        <p>Работники трудились {formatDuration(offline.seconds)} и заработали</p>
        <div className="modal__money">${formatMoney(offline.money)}</div>
        <button className="btn btn--primary" onClick={() => useUI.setState({ offline: null })}>
          Забрать
        </button>
      </div>
    </div>
  );
}

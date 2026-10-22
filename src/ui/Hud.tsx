"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, formatMoney } from "@/game/core/format";
import type { ItemId } from "@/game/data/items";
import { itemIconUrl, useItemIconsVersion } from "@/render/itemIcons";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";
import { FarmhousePanel } from "./FarmhousePanel";
import { SettingsModal } from "./SettingsModal";

export function Hud({ runtime }: { runtime: Runtime }) {
  return (
    <div className="hud">
      <TopBar />
      <Hint />
      <Toasts />
      <ControlsHint runtime={runtime} />
      <FarmhousePanel runtime={runtime} />
      <OfflineModal />
      <SettingsModal runtime={runtime} />
    </div>
  );
}

function TopBar() {
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
      {stars > 0 && (
        <div className="stars" title="Звёзды сезонов: +10% к ценам за каждую">
          ⭐ {stars}
        </div>
      )}
      <button className="icon-btn topbar__settings" aria-label="Настройки" onClick={() => useUI.setState({ settingsOpen: true })}>
        ⚙️
      </button>
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
function ItemIcon({ item, fallback }: { item?: ItemId; fallback: string }) {
  useItemIconsVersion();
  const url = item ? itemIconUrl(item) : undefined;
  if (!url) return <span className="hint__icon">{fallback}</span>;
  // eslint-disable-next-line @next/next/no-img-element -- data URL rendered at runtime
  return <img className="hint__img" src={url} alt="" width={30} height={30} draggable={false} />;
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

"use client";

import { useState } from "react";
import { formatDuration, formatMoney } from "@/game/core/format";
import type { Runtime } from "@/runtime/runtime";
import { updateSettings, useUI, type Quality, type Settings } from "@/runtime/store";
import { canFullscreen, toggleFullscreen } from "./fullscreen";
import { SaveTab } from "./SaveTab";

const QUALITY: { id: Quality; name: string }[] = [
  { id: "high", name: "Высокое" },
  { id: "medium", name: "Среднее" },
  { id: "low", name: "Низкое" },
];

type Tab = "game" | "save" | "stats";

export function SettingsModal({ runtime }: { runtime: Runtime }) {
  const open = useUI((s) => s.settingsOpen);
  const [tab, setTab] = useState<Tab>("game");
  if (!open) return null;
  const close = () => useUI.setState({ settingsOpen: false });
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--settings" onPointerDown={(e) => e.stopPropagation()}>
        <button className="icon-btn modal__close" aria-label="Закрыть" onClick={close}>
          ✕
        </button>
        <h2>Настройки</h2>
        <div className="tabs tabs--settings">
          {(
            [
              ["game", "Игра"],
              ["save", "Сохранение"],
              ["stats", "Статистика"],
            ] as const
          ).map(([id, name]) => (
            <button key={id} className={`tab ${tab === id ? "tab--on" : ""}`} onClick={() => setTab(id)}>
              {name}
            </button>
          ))}
        </div>
        {tab === "game" && <GameTab />}
        {tab === "save" && <SaveTab runtime={runtime} />}
        {tab === "stats" && <StatsTab runtime={runtime} />}
      </div>
    </div>
  );
}

function GameTab() {
  const settings = useUI((s) => s.settings);
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const set = (patch: Partial<Settings>) => updateSettings(patch);
  return (
    <>
      <div className="setting">
        <span>🔊 Звуки</span>
        <Toggle on={settings.sound} onChange={(v) => set({ sound: v })} />
      </div>
      {settings.sound && <Volume value={settings.soundVolume} onChange={(v) => set({ soundVolume: v })} />}
      <div className="setting">
        <span>🎵 Музыка</span>
        <Toggle on={settings.music} onChange={(v) => set({ music: v })} />
      </div>
      {settings.music && <Volume value={settings.musicVolume} onChange={(v) => set({ musicVolume: v })} />}
      {touch && (
        <div className="setting">
          <span>📳 Вибрация</span>
          <Toggle on={settings.vibration} onChange={(v) => set({ vibration: v })} />
        </div>
      )}
      <div className="setting">
        <span>🎥 Тряска камеры</span>
        <Toggle on={settings.shake} onChange={(v) => set({ shake: v })} />
      </div>
      <div className="setting">
        <span>🌗 Смена дня и ночи</span>
        <Toggle on={settings.dayNight} onChange={(v) => set({ dayNight: v })} />
      </div>
      <div className="setting">
        <span>🍂 Времена года и погода</span>
        <Toggle on={settings.seasons} onChange={(v) => set({ seasons: v })} />
      </div>
      <div className="setting setting--column">
        <span>🖥️ Графика</span>
        <div className="segmented">
          {QUALITY.map((q) => (
            <button key={q.id} className={settings.quality === q.id ? "seg seg--on" : "seg"} onClick={() => set({ quality: q.id })}>
              {q.name}
            </button>
          ))}
        </div>
      </div>
      {canFullscreen() && (
        <button className="btn btn--wide" onClick={toggleFullscreen}>
          ⛶ Полный экран
        </button>
      )}
      {!touch && (
        <p className="keys">
          <kbd>WASD</kbd> бег · <kbd>+</kbd>
          <kbd>−</kbd> масштаб · <kbd>M</kbd> звук · <kbd>F</kbd> полный экран · <kbd>Esc</kbd> закрыть окно
        </p>
      )}
    </>
  );
}

function Volume({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="setting setting--volume">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        aria-label="Громкость"
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
      <span className="volume__value">{Math.round(value * 100)}%</span>
    </div>
  );
}

function StatsTab({ runtime }: { runtime: Runtime }) {
  useUI((s) => s.tick);
  const st = runtime.game.state;
  return (
    <div className="stats">
      <div>
        <span>Заработано</span>
        <b>${formatMoney(st.stats.earned)}</b>
      </div>
      <div>
        <span>Собрано урожая</span>
        <b>{formatMoney(st.stats.harvested)}</b>
      </div>
      <div>
        <span>Произведено</span>
        <b>{formatMoney(st.stats.produced)}</b>
      </div>
      <div>
        <span>Продано</span>
        <b>{formatMoney(st.stats.sold)}</b>
      </div>
      <div>
        <span>Покупок</span>
        <b>{st.stats.purchases}</b>
      </div>
      <div>
        <span>Заказов</span>
        <b>{st.stats.orders}</b>
      </div>
      <div>
        <span>В игре</span>
        <b>{formatDuration(st.stats.playTime)}</b>
      </div>
      <div>
        <span>Сезонов прожито</span>
        <b>{st.stats.seasons}</b>
      </div>
      {st.prestige.generations > 0 && (
        <div>
          <span>Поколений</span>
          <b>{st.prestige.generations}</b>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={`toggle ${on ? "toggle--on" : ""}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="toggle__knob" />
    </button>
  );
}

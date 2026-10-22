"use client";

import { useState } from "react";
import { formatDuration, formatMoney } from "@/game/core/format";
import type { Runtime } from "@/runtime/runtime";
import { updateSettings, useUI, type Quality } from "@/runtime/store";

const QUALITY: { id: Quality; name: string }[] = [
  { id: "high", name: "Высокое" },
  { id: "medium", name: "Среднее" },
  { id: "low", name: "Низкое" },
];

export function SettingsModal({ runtime }: { runtime: Runtime }) {
  const open = useUI((s) => s.settingsOpen);
  const settings = useUI((s) => s.settings);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!open) return null;
  const close = () => {
    setConfirmReset(false);
    useUI.setState({ settingsOpen: false });
  };
  const st = runtime.game.state;
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--settings" onPointerDown={(e) => e.stopPropagation()}>
        <button className="icon-btn modal__close" aria-label="Закрыть" onClick={close}>
          ✕
        </button>
        <h2>Настройки</h2>
        <div className="setting">
          <span>🔊 Звуки</span>
          <Toggle on={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
        </div>
        <div className="setting">
          <span>🎵 Музыка</span>
          <Toggle on={settings.music} onChange={(v) => updateSettings({ music: v })} />
        </div>
        <div className="setting setting--column">
          <span>🖥️ Графика</span>
          <div className="segmented">
            {QUALITY.map((q) => (
              <button key={q.id} className={settings.quality === q.id ? "seg seg--on" : "seg"} onClick={() => updateSettings({ quality: q.id })}>
                {q.name}
              </button>
            ))}
          </div>
        </div>

        <h3>Статистика</h3>
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
            <span>В игре</span>
            <b>{formatDuration(st.stats.playTime)}</b>
          </div>
          {st.prestige.seasons > 0 && (
            <div>
              <span>Сезонов</span>
              <b>{st.prestige.seasons}</b>
            </div>
          )}
        </div>

        <div className="danger-zone">
          {confirmReset ? (
            <>
              <span>Удалить весь прогресс?</span>
              <button className="btn btn--danger" onClick={() => runtime.resetProgress()}>
                Да, сбросить
              </button>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                Отмена
              </button>
            </>
          ) : (
            <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
              Сбросить прогресс
            </button>
          )}
        </div>
      </div>
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

"use client";

import { useState } from "react";
import { sfx } from "@/audio/sfx";
import { formatDuration, formatMoney } from "@/game/core/format";
import { HATS, HAT_IDS } from "@/game/data/hats";
import { ACHIEVEMENTS, type AchievementDef } from "@/game/engine/achievements";
import type { Game } from "@/game/engine/Game";
import { PLAYER_STATS, WORKER_STATS, statMaxLevel, statValue, type LevelledStat, type PlayerStatId, type WorkerStatId } from "@/game/data/balance";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";

type Tab = "farmer" | "workers" | "trophies" | "legacy";

export function FarmhousePanel({ runtime }: { runtime: Runtime }) {
  const panel = useUI((s) => s.panel);
  useUI((s) => s.tick);
  const [tab, setTab] = useState<Tab>("farmer");
  if (panel !== "farmhouse") return null;

  const g = runtime.game;
  const st = g.state;
  const hasWorkers = st.workers.length > 0;
  const canLegacy = st.statue;
  const current: Tab = tab === "workers" && !hasWorkers ? "farmer" : tab === "legacy" && !canLegacy ? "farmer" : tab;

  return (
    <div className="panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel__head">
        <span className="panel__title">🏡 Дом фермера</span>
        <div className="tabs">
          <button className={`tab ${current === "farmer" ? "tab--on" : ""}`} onClick={() => setTab("farmer")}>
            Фермер
          </button>
          {hasWorkers && (
            <button className={`tab ${current === "workers" ? "tab--on" : ""}`} onClick={() => setTab("workers")}>
              Работники
            </button>
          )}
          <button className={`tab ${current === "trophies" ? "tab--on" : ""}`} onClick={() => setTab("trophies")}>
            Трофеи 🏆
          </button>
          {canLegacy && (
            <button className={`tab ${current === "legacy" ? "tab--on" : ""}`} onClick={() => setTab("legacy")}>
              Наследие ⭐
            </button>
          )}
        </div>
      </div>
      <div className="panel__body">
        {current === "farmer" &&
          (Object.keys(PLAYER_STATS) as PlayerStatId[]).map((id) => (
            <StatCard
              key={id}
              stat={PLAYER_STATS[id]}
              level={st.playerLevels[id]}
              cost={g.playerStatCost(id)}
              money={st.money}
              onBuy={() => {
                if (g.buyPlayerStat(id)) sfx.play("level");
              }}
            />
          ))}
        {current === "workers" &&
          (Object.keys(WORKER_STATS) as WorkerStatId[]).map((id) => (
            <StatCard
              key={id}
              stat={WORKER_STATS[id]}
              level={st.workerLevels[id]}
              cost={g.workerStatCost(id)}
              money={st.money}
              onBuy={() => {
                if (g.buyWorkerStat(id)) sfx.play("level");
              }}
            />
          ))}
        {current === "trophies" && <Trophies runtime={runtime} />}
        {current === "legacy" && <LegacyCard runtime={runtime} />}
      </div>
    </div>
  );
}

function StatCard({ stat, level, cost, money, onBuy }: { stat: LevelledStat; level: number; cost: number | null; money: number; onBuy: () => void }) {
  const max = statMaxLevel(stat);
  const now = statValue(stat, level);
  const next = cost !== null ? statValue(stat, level + 1) : null;
  const affordable = cost !== null && money >= cost;
  return (
    <div className="card">
      <div className="card__icon">{stat.icon}</div>
      <div className="card__info">
        <div className="card__name">{stat.name}</div>
        <div className="card__value">
          {now} {stat.unit}
          {next !== null && (
            <>
              {" "}
              → <b>{next}</b> {stat.unit}
            </>
          )}
        </div>
        <div className="card__pips">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={i < level ? "pip pip--on" : "pip"} />
          ))}
        </div>
      </div>
      {cost === null ? (
        <div className="card__max">МАКС</div>
      ) : (
        <button className={`btn btn--buy ${affordable ? "" : "btn--off"}`} disabled={!affordable} onClick={onBuy}>
          ${formatMoney(cost)}
        </button>
      )}
    </div>
  );
}

/** The wardrobe (hats earned by achievements) and the list of achievements. */
function Trophies({ runtime }: { runtime: Runtime }) {
  const g = runtime.game;
  const st = g.state;
  const hats = g.hats();
  return (
    <div className="trophies">
      <div className="wardrobe">
        {HAT_IDS.map((id) => {
          const owned = hats.includes(id);
          const by = ACHIEVEMENTS.find((a) => a.hat === id);
          return (
            <button
              key={id}
              className={`hat ${st.hat === id ? "hat--on" : ""} ${owned ? "" : "hat--locked"}`}
              disabled={!owned}
              title={owned ? HATS[id].name : `Достижение «${by?.name}»`}
              onClick={() => {
                if (g.wearHat(id)) {
                  sfx.play("pick");
                  runtime.syncUI();
                }
              }}
            >
              <span className="hat__icon">{owned ? HATS[id].icon : "🔒"}</span>
              <span className="hat__name">{owned ? HATS[id].name : `«${by?.name}»`}</span>
            </button>
          );
        })}
      </div>
      <div className="ach-head">
        Достижения: <b>{st.achievements.size}</b> из {ACHIEVEMENTS.length}
      </div>
      {ACHIEVEMENTS.map((a) => (
        <AchievementRow key={a.id} a={a} game={g} />
      ))}
    </div>
  );
}

function AchievementRow({ a, game }: { a: AchievementDef; game: Game }) {
  const done = game.state.achievements.has(a.id);
  const v = Math.min(a.goal, a.value(game));
  const fmt = (n: number) => (a.unit === "money" ? `${formatMoney(n)}` : a.unit === "time" ? formatDuration(n) : formatMoney(Math.floor(n)));
  return (
    <div className={`ach ${done ? "ach--done" : ""}`}>
      <span className="ach__icon">{a.icon}</span>
      <div className="ach__info">
        <div className="ach__name">
          {a.name}
          {a.hat && (
            <span className="ach__hat" title={`Награда: ${HATS[a.hat].name}`}>
              {HATS[a.hat].icon}
            </span>
          )}
        </div>
        <div className="ach__desc">{a.desc}</div>
        {!done && (
          <div className="ach__bar">
            <span style={{ width: `${(v / a.goal) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="ach__value">{done ? "✓" : `${fmt(v)} / ${fmt(a.goal)}`}</div>
    </div>
  );
}

/** Prestige: hand the farm over to the next generation for stars. */
function LegacyCard({ runtime }: { runtime: Runtime }) {
  const [confirm, setConfirm] = useState(false);
  const g = runtime.game;
  const stars = g.prestigeStars();
  return (
    <div className="card card--season">
      <div className="card__icon">⭐</div>
      <div className="card__info">
        <div className="card__name">Новое поколение</div>
        <div className="card__value">
          Передай ферму детям: всё начнётся заново, а наследство — <b>{stars}</b> ⭐, это <b>+{stars * 10}%</b> к ценам навсегда.
        </div>
      </div>
      {confirm ? (
        <button className="btn btn--danger" onClick={() => runtime.prestige()}>
          Точно!
        </button>
      ) : (
        <button className="btn btn--buy" disabled={stars < 1} onClick={() => setConfirm(true)}>
          Начать
        </button>
      )}
    </div>
  );
}

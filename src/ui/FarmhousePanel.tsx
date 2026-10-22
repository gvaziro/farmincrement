"use client";

import { useState } from "react";
import { sfx } from "@/audio/sfx";
import { formatMoney } from "@/game/core/format";
import { PLAYER_STATS, WORKER_STATS, statMaxLevel, statValue, type LevelledStat, type PlayerStatId, type WorkerStatId } from "@/game/data/balance";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";

type Tab = "farmer" | "workers" | "season";

export function FarmhousePanel({ runtime }: { runtime: Runtime }) {
  const panel = useUI((s) => s.panel);
  useUI((s) => s.tick);
  const [tab, setTab] = useState<Tab>("farmer");
  if (panel !== "farmhouse") return null;

  const g = runtime.game;
  const st = g.state;
  const hasWorkers = st.workers.length > 0;
  const canSeason = st.statue;
  const current: Tab = tab === "workers" && !hasWorkers ? "farmer" : tab === "season" && !canSeason ? "farmer" : tab;

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
          {canSeason && (
            <button className={`tab ${current === "season" ? "tab--on" : ""}`} onClick={() => setTab("season")}>
              Сезон ⭐
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
        {current === "season" && <SeasonCard runtime={runtime} />}
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

function SeasonCard({ runtime }: { runtime: Runtime }) {
  const [confirm, setConfirm] = useState(false);
  const g = runtime.game;
  const stars = g.prestigeStars();
  return (
    <div className="card card--season">
      <div className="card__icon">⭐</div>
      <div className="card__info">
        <div className="card__name">Новый сезон</div>
        <div className="card__value">
          Начни ферму заново и получи <b>{stars}</b> ⭐ — это <b>+{stars * 10}%</b> к ценам навсегда.
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

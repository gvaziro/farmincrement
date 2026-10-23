"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration, formatMoney } from "@/game/core/format";
import { saveSummary, type SaveData, type SaveSummary } from "@/game/engine/save";
import { decodeSave } from "@/game/engine/saveCode";
import { BACKUP_REASONS, listBackups, type Backup } from "@/runtime/backups";
import type { Runtime } from "@/runtime/runtime";

const when = (ms: number) =>
  new Date(ms).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function ago(ms: number) {
  if (!ms) return "ещё не было";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return "только что";
  if (s < 60) return `${s} с назад`;
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
  return when(ms);
}

/** "$1.2M · 7 участков · поколение 2 · 3 ч в игре" */
function SummaryLine({ s }: { s: SaveSummary }) {
  return (
    <span className="save-summary">
      ${formatMoney(s.money)} · участков: {s.zones}
      {s.generations > 0 ? ` · поколение ${s.generations + 1}` : ""}
      {s.playTime > 0 ? ` · ${formatDuration(s.playTime)} в игре` : ""}
    </span>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileName = () => `tiny-farm-empire-${new Date().toISOString().slice(0, 10)}.json`;

/** Settings → "Сохранение": save now, move the farm, restore a backup, reset. */
export function SaveTab({ runtime }: { runtime: Runtime }) {
  const [, force] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const copyCode = async () => {
    const c = await runtime.exportCode();
    try {
      await navigator.clipboard.writeText(c);
      setCode(null);
      setNote(`Код скопирован (${c.length} символов). В другом браузере: Настройки → Сохранение → Загрузить.`);
    } catch {
      // No clipboard access: show the code to copy by hand.
      setCode(c);
      setNote("Не получилось скопировать автоматически — выдели код ниже и скопируй.");
    }
  };

  return (
    <div className="save-tab">
      <div className="save-row">
        <div>
          <b>Автосохранение</b>
          <span className="save-muted">каждые 5 секунд · последнее: {ago(runtime.lastSaveAt)}</span>
        </div>
        <button
          className="btn"
          onClick={() => setNote(runtime.save() ? "Сохранено ✓" : "Сейчас сохранить нельзя: ферма открыта в другой вкладке")}
        >
          💾 Сохранить
        </button>
      </div>

      <h3>Перенести ферму</h3>
      <p className="save-muted">Код или файл переносят прогресс в другой браузер или на другое устройство.</p>
      <div className="save-buttons">
        <button className="btn" onClick={() => void copyCode()}>
          📋 Скопировать код
        </button>
        <button
          className="btn"
          onClick={() => {
            download(fileName(), runtime.exportJson());
            setNote("Файл сохранён — его можно загрузить здесь же, кнопкой «Загрузить».");
          }}
        >
          ⬇️ Скачать файл
        </button>
        <button className={`btn ${importing ? "btn--on" : ""}`} onClick={() => setImporting((v) => !v)}>
          ⬆️ Загрузить
        </button>
      </div>
      {note && <div className="save-note">{note}</div>}
      {code && <textarea className="save-code" readOnly value={code} onFocus={(e) => e.currentTarget.select()} rows={4} />}
      {importing && <ImportBox runtime={runtime} />}

      <Backups runtime={runtime} />
      <ResetButton runtime={runtime} />
    </div>
  );
}

/** Paste a code or pick a file, see what is inside, then load it. */
function ImportBox({ runtime }: { runtime: Runtime }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ data: SaveData; summary: SaveSummary } | { error: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  /** Decode as the player types; only the latest check may show its result. */
  const check = (value: string) => {
    setText(value);
    const n = ++seq.current;
    if (!value.trim()) {
      setResult(null);
      return;
    }
    void decodeSave(value).then((r) => {
      if (n !== seq.current) return;
      setResult(r.ok ? { data: r.data, summary: saveSummary(r.data)! } : { error: r.error });
    });
  };

  return (
    <div className="import-box">
      <textarea
        className="save-code"
        placeholder="Вставь код сохранения (начинается с TFE…)"
        value={text}
        onChange={(e) => check(e.target.value)}
        rows={3}
      />
      <input
        ref={file}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) check(await f.text());
        }}
      />
      <button className="btn btn--ghost" onClick={() => file.current?.click()}>
        📂 Выбрать файл
      </button>
      {result && "error" in result && <div className="save-error">{result.error}</div>}
      {result && "data" in result && (
        <div className="import-preview">
          <div>
            <b>Сохранение от {result.summary.savedAt ? when(result.summary.savedAt) : "неизвестной даты"}</b>
            <SummaryLine s={result.summary} />
          </div>
          <p className="save-muted">Текущая ферма не пропадёт — она попадёт в резервные копии.</p>
          <button className="btn btn--primary" onClick={() => runtime.importSave(result.data)}>
            Загрузить эту ферму
          </button>
        </div>
      )}
    </div>
  );
}

function Backups({ runtime }: { runtime: Runtime }) {
  const [confirm, setConfirm] = useState<number | null>(null);
  let list: Backup[] = [];
  try {
    list = listBackups(localStorage);
  } catch {
    /* storage unavailable */
  }
  return (
    <>
      <h3>Резервные копии</h3>
      {list.length === 0 && <p className="save-muted">Пока нет — они появятся сами: при запуске и каждые 10 минут игры.</p>}
      <div className="backups">
        {list.map((b) => {
          let summary: SaveSummary | null = null;
          try {
            summary = saveSummary(JSON.parse(b.raw));
          } catch {
            /* unreadable */
          }
          return (
            <div key={b.id} className="backup">
              <div className="backup__info">
                <b>{when(b.at)}</b>
                <span className="save-muted">{BACKUP_REASONS[b.reason]}</span>
                {summary && <SummaryLine s={summary} />}
              </div>
              {b.reason === "broken" || !summary ? (
                <button className="btn btn--ghost" onClick={() => download(`tiny-farm-empire-broken-${b.at}.json`, b.raw)}>
                  ⬇️
                </button>
              ) : confirm === b.id ? (
                <button className="btn btn--danger" onClick={() => runtime.restoreBackup(b)}>
                  Точно?
                </button>
              ) : (
                <button className="btn" onClick={() => setConfirm(b.id)}>
                  Вернуть
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ResetButton({ runtime }: { runtime: Runtime }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="danger-zone">
      {confirm ? (
        <>
          <span>Начать ферму с нуля? Копия останется в резервных.</span>
          <button className="btn btn--danger" onClick={() => runtime.resetProgress()}>
            Да, сбросить
          </button>
          <button className="btn" onClick={() => setConfirm(false)}>
            Отмена
          </button>
        </>
      ) : (
        <button className="btn btn--ghost" onClick={() => setConfirm(true)}>
          Сбросить прогресс
        </button>
      )}
    </div>
  );
}

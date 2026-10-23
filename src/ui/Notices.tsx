"use client";

import type { Runtime } from "@/runtime/runtime";
import { updateSettings, useUI } from "@/runtime/store";
import { NEWS_VERSION, unseenNews } from "./news";

/** The farm is open in another tab: this one waits until the player chooses. */
export function TabBlockedModal({ runtime }: { runtime: Runtime }) {
  const blocked = useUI((s) => s.tabBlocked);
  if (!blocked) return null;
  return (
    <div className="modal-backdrop modal-backdrop--solid">
      <div className="modal">
        <div className="modal__emoji">{blocked === "other" ? "🚜" : "👋"}</div>
        <h2>{blocked === "other" ? "Ферма уже открыта" : "Игра продолжилась в другой вкладке"}</h2>
        <p>
          {blocked === "other"
            ? "Она открыта в другой вкладке. Сохраняет только одна вкладка — чтобы прогресс не затирал сам себя."
            : "Здесь игра остановлена и больше не сохраняется, чтобы не затереть прогресс."}
        </p>
        <button className="btn btn--primary" onClick={() => runtime.takeOver()}>
          {blocked === "other" ? "Играть здесь" : "Вернуться сюда"}
        </button>
      </div>
    </div>
  );
}

/** For returning players: what changed since they last played. */
export function WhatsNewModal() {
  const show = useUI((s) => s.news);
  const offline = useUI((s) => s.offline);
  const blocked = useUI((s) => s.tabBlocked);
  const seen = useUI((s) => s.settings.seenNews);
  const items = unseenNews(seen);
  // One window at a time: "while you were away" comes first.
  if (!show || offline || blocked || items.length === 0) return null;
  const close = () => {
    updateSettings({ seenNews: NEWS_VERSION });
    useUI.setState({ news: false });
  };
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--news" onPointerDown={(e) => e.stopPropagation()}>
        <div className="modal__emoji">🎉</div>
        <h2>Что нового на ферме</h2>
        <ul className="news">
          {items.map((n) => (
            <li key={n.text}>
              <span className="news__icon">{n.icon}</span>
              <span>{n.text}</span>
            </li>
          ))}
        </ul>
        <button className="btn btn--primary" onClick={close}>
          Отлично!
        </button>
      </div>
    </div>
  );
}

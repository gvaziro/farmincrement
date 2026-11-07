"use client";

import { formatMoney } from "@/game/core/format";
import { SHOPS, TOWER_FLOORS, shopMaxCustomers } from "@/game/data/city";
import { ISLAND_ZONES } from "@/game/data/island";
import type { WorldId } from "@/game/data/worlds";
import { customerRate, farmPenny } from "@/game/engine/systems/city";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";

/** The farm's penny is often less than a dollar: show the cents. */
const pennyText = (v: number) => (v < 10 ? v.toFixed(2).replace(/\.?0+$/, "") : formatMoney(v));

/** How you get to each world and what it is called. */
export const WORLD_TRIP: Record<WorldId, { icon: string; go: string; name: string; ride: string; vehicle: string }> = {
  farm: { icon: "🚜", go: "На ферму", name: "Ферма", ride: "Едем на ферму…", vehicle: "🚌" },
  city: { icon: "🏙️", go: "В город", name: "Город", ride: "Едем в город…", vehicle: "🚌" },
  island: { icon: "🏝️", go: "На остров", name: "Остров", ride: "Летим на остров…", vehicle: "🛩️" },
};

/** The stop (or the seaplane's jetty): every world the family can go to. */
export function BusPanel({ runtime }: { runtime: Runtime }) {
  const panel = useUI((s) => s.panel);
  useUI((s) => s.tick);
  if (panel !== "bus") return null;
  const g = runtime.game;
  const here = g.state.world;
  const dests = g.destinations();
  const title = here === "island" ? "🛩️ Гидроплан" : "🚌 Остановка";
  return (
    <div className="panel bus" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel__head">
        <span className="panel__title">{title}</span>
      </div>
      <div className="panel__body bus__body">
        {dests.map((d) => (
          <Destination key={d} runtime={runtime} to={d} />
        ))}
      </div>
    </div>
  );
}

function Destination({ runtime, to }: { runtime: Runtime; to: WorldId }) {
  const g = runtime.game;
  const known = g.worldState(to);
  const trip = WORLD_TRIP[to];
  const rows: { icon: string; text: string }[] = [];
  let story: string | null = null;
  if (!known && to === "city") {
    story = "Ферма выстроена, статуя блестит, управляющий справится и без тебя. А в городе никто не пробовал твоего хлеба. Самое время начать новое дело!";
    rows.push({ icon: "🏡", text: `Ферма останется твоей и будет присылать копеечку: $${pennyText(farmPenny(g.farm))} в секунду` });
    rows.push({ icon: "💼", text: "В городе свой счёт и своё дело: начинаешь с маленькой лавки" });
    rows.push({ icon: "🚐", text: "Фургон будет возить товар с фермы, а вернуться можно в любой момент" });
  } else if (!known && to === "island") {
    story = "Башня достроена, и с её крыши видно море. Говорят, на тёплых островах растут ананасы, бананы и какао, а лодки увозят урожай на большую землю. Гидроплан ждёт!";
    rows.push({ icon: "🌴", text: "Новая ферма на архипелаге: острова соединены мостиками" });
    rows.push({ icon: "💸", text: `Свой счёт с нуля; ферма и город будут присылать $${pennyText(g.pennyFor("island"))} в секунду` });
    rows.push({ icon: "📣", text: "Каждый остров поднимает цены на ферме и в городе" });
  } else if (known && to === "farm") {
    rows.push({ icon: "🏡", text: `На счету фермы: $${formatMoney(Math.floor(known.money))}` });
    rows.push({ icon: "⏳", text: "Пока тебя нет, она работает сама: выручку получишь по приезде" });
  } else if (known && to === "city") {
    rows.push({ icon: "💼", text: `На городском счету: $${formatMoney(Math.floor(known.money))}` });
    rows.push({ icon: "🏪", text: `Заведений: ${known.city!.shops.length} из ${SHOPS.length}${known.city!.floors > 0 ? `, этажей Башни: ${known.city!.floors} из ${TOWER_FLOORS}` : ""}` });
  } else if (known && to === "island") {
    rows.push({ icon: "🌴", text: `На счету острова: $${formatMoney(Math.floor(known.money))}` });
    rows.push({ icon: "🏝️", text: `Островов: ${known.zones.size} из ${ISLAND_ZONES.length}${known.statue ? ", Маяк горит" : ""}` });
  }
  return (
    <div className="trip">
      <div className="trip__head">
        <span className="trip__icon">{trip.icon}</span>
        <b>{trip.name}</b>
      </div>
      {story && <p className="bus__story">{story}</p>}
      {rows.map((r) => (
        <div key={r.text} className="bus__row">
          <span className="bus__icon">{r.icon}</span>
          <span>{r.text}</span>
        </div>
      ))}
      <button className="btn btn--primary bus__go" onClick={() => runtime.travel(to)}>
        {trip.go}
      </button>
    </div>
  );
}

/** The ride itself: covers the swap of the worlds. */
export function TravelOverlay() {
  const travel = useUI((s) => s.travel);
  if (!travel) return null;
  const trip = WORLD_TRIP[travel];
  return (
    <div className={`travel travel--${travel}`} aria-live="polite">
      <div className="travel__road">
        <span className="travel__bus">{trip.vehicle}</span>
      </div>
      <div className="travel__text">{trip.ride}</div>
    </div>
  );
}

const CHAPTERS: Partial<Record<WorldId, { num: string; emoji: string; title: string; text: string }>> = {
  city: {
    num: "Глава II",
    emoji: "🏙️",
    title: "Город",
    text: "Первый фургон с фермы уже здесь. Лавка маленькая, зато своя: выложи товар на прилавок, встань за кассу и забери выручку со стола. Лавка вырастет в кафе, кафе в сеть, а сеть в Башню.",
  },
  island: {
    num: "Глава III",
    emoji: "🏝️",
    title: "Остров",
    text: "Тёплый песок, шум прибоя и грядка ананасов. Собери урожай, отожми сок и продай его на пляжном рынке. Острова соединяются мостиками, лодки увозят товар на большую землю, а в конце пути зажжётся Маяк.",
  },
};

/** The chapter's title card, the first time you arrive. */
export function ChapterModal() {
  const chapter = useUI((s) => s.chapter);
  const travel = useUI((s) => s.travel);
  const c = chapter ? CHAPTERS[chapter] : undefined;
  if (!c || travel) return null;
  const close = () => useUI.setState({ chapter: null });
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--chapter" onPointerDown={(e) => e.stopPropagation()}>
        <div className="chapter__num">{c.num}</div>
        <div className="modal__emoji">{c.emoji}</div>
        <h2>{c.title}</h2>
        <p>{c.text}</p>
        <button className="btn btn--primary" onClick={close}>
          За дело!
        </button>
      </div>
    </div>
  );
}

const ENDINGS: Partial<Record<WorldId, { num: string; emoji: string; title: string; text: string }>> = {
  city: {
    num: "Глава II пройдена",
    emoji: "🏆",
    title: "Хозяин города",
    text: "Башня достроена! С её крыши видно и лавку, с которой всё началось, и дорогу на родную ферму. А ещё — море: на остановку теперь прилетает гидроплан.",
  },
  island: {
    num: "Глава III пройдена",
    emoji: "🗼",
    title: "Огни Маяка",
    text: "Маяк зажёгся над гаванью! Лодки находят дорогу домой даже ночью, а слава островов разошлась по всей семье: ферма и город продают дороже.",
  },
};

/** The end of a chapter. */
export function ChapterDoneModal() {
  const done = useUI((s) => s.chapterDone);
  const c = done ? ENDINGS[done.world] : undefined;
  if (!done || !c) return null;
  const close = () => useUI.setState({ chapterDone: null });
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--chapter" onPointerDown={(e) => e.stopPropagation()}>
        <div className="chapter__num">{c.num}</div>
        <div className="modal__emoji">{c.emoji}</div>
        <h2>{c.title}</h2>
        <p>{c.text}</p>
        <div className="modal__money">+{done.stars} ⭐</div>
        <button className="btn btn--primary" onClick={close}>
          Здорово!
        </button>
      </div>
    </div>
  );
}

/** "Дело": how each business is doing, in the owner's office. */
export function BusinessTab({ runtime }: { runtime: Runtime }) {
  const g = runtime.game;
  const st = g.state;
  const city = st.city;
  if (!city) return null;
  return (
    <div className="business">
      <div className="business__head">
        <span>
          Обслужено покупателей: <b>{formatMoney(st.stats.served)}</b>
        </span>
        <span>
          С фермы: <b>${pennyText(st.penny.rate)}/с</b>
        </span>
      </div>
      {city.shops.map((s) => (
        <div key={s.id} className="business__row">
          <span className="business__icon">{s.def.icon}</span>
          <div className="business__info">
            <b>{s.def.name}</b>
            <span>
              ремонт {s.level} · реклама {s.ads} · фургон {s.van.level} · {(customerRate(st, s) * 60).toFixed(0)} гостей в минуту · до {shopMaxCustomers(s.ads, s.tables.length)} одновременно
            </span>
          </div>
          {s.cash > 0 && <span className="business__cash">${formatMoney(Math.floor(s.cash))}</span>}
        </div>
      ))}
    </div>
  );
}

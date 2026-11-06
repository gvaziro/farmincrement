"use client";

import { formatMoney } from "@/game/core/format";

/** The farm's penny is often less than a dollar: show the cents. */
const pennyText = (v: number) => (v < 10 ? v.toFixed(2).replace(/\.?0+$/, "") : formatMoney(v));
import { SHOPS, TOWER_FLOORS, shopMaxCustomers } from "@/game/data/city";
import { customerRate, farmPenny } from "@/game/engine/systems/city";
import type { Runtime } from "@/runtime/runtime";
import { useUI } from "@/runtime/store";

/** The bus stop: leave for the other world, on both sides of the road. */
export function BusPanel({ runtime }: { runtime: Runtime }) {
  const panel = useUI((s) => s.panel);
  useUI((s) => s.tick);
  if (panel !== "bus") return null;
  const g = runtime.game;
  const inCity = g.state.world === "city";
  const city = g.city;
  const farm = g.farm;
  const penny = farmPenny(farm);
  return (
    <div className="panel bus" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel__head">
        <span className="panel__title">🚌 {inCity ? "Автобус на ферму" : "Автобус в город"}</span>
      </div>
      <div className="panel__body bus__body">
        {!city && (
          <>
            <p className="bus__story">Ферма выстроена, статуя блестит, управляющий справится и без тебя. А в городе никто не пробовал твоего хлеба. Самое время начать новое дело!</p>
            <BusRow icon="🏡" text={`Ферма останется твоей и будет присылать копеечку: $${pennyText(penny)} в секунду`} />
            <BusRow icon="💼" text="В городе свой счёт и своё дело: начинаешь с маленькой лавки" />
            <BusRow icon="🚐" text="Фургон будет возить товар с фермы, а вернуться можно в любой момент" />
          </>
        )}
        {city && !inCity && (
          <>
            <BusRow icon="💼" text={`На городском счету: $${formatMoney(Math.floor(city.money))}`} />
            <BusRow icon="🏪" text={`Заведений: ${city.city!.shops.length} из ${SHOPS.length}${city.city!.floors > 0 ? `, этажей Башни: ${city.city!.floors} из ${TOWER_FLOORS}` : ""}`} />
            <BusRow icon="📣" text={`Слава города: цены фермы выше на ${Math.round(g.cityFame() * 100)}%`} />
          </>
        )}
        {city && inCity && (
          <>
            <BusRow icon="🏡" text={`На счету фермы: $${formatMoney(Math.floor(farm.money))}`} />
            <BusRow icon="🚜" text={`Ферма присылает сюда $${pennyText(penny)} в секунду, и чем больше на ней машин, тем больше`} />
            <BusRow icon="⏳" text="Пока тебя нет, она работает сама: выручку получишь по приезде" />
          </>
        )}
        <button className="btn btn--primary bus__go" onClick={() => runtime.travel()}>
          {inCity ? "Поехать на ферму" : "Поехать в город"}
        </button>
      </div>
    </div>
  );
}

function BusRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="bus__row">
      <span className="bus__icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

/** The ride itself: covers the swap of the worlds. */
export function TravelOverlay() {
  const travel = useUI((s) => s.travel);
  if (!travel) return null;
  return (
    <div className={`travel travel--${travel}`} aria-live="polite">
      <div className="travel__road">
        <span className="travel__bus">🚌</span>
      </div>
      <div className="travel__text">{travel === "city" ? "Едем в город…" : "Едем на ферму…"}</div>
    </div>
  );
}

/** The chapter's title card, the first time you step off the bus. */
export function ChapterModal() {
  const chapter = useUI((s) => s.chapter);
  const travel = useUI((s) => s.travel);
  if (!chapter || travel) return null;
  const close = () => useUI.setState({ chapter: false });
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--chapter" onPointerDown={(e) => e.stopPropagation()}>
        <div className="chapter__num">Глава II</div>
        <div className="modal__emoji">🏙️</div>
        <h2>Город</h2>
        <p>Первый фургон с фермы уже здесь. Лавка маленькая, зато своя: выложи товар на прилавок, встань за кассу и забери выручку со стола. Лавка вырастет в кафе, кафе в сеть, а сеть в Башню.</p>
        <button className="btn btn--primary" onClick={close}>
          За дело!
        </button>
      </div>
    </div>
  );
}

/** The top of the tower: the chapter is over. */
export function ChapterDoneModal() {
  const stars = useUI((s) => s.chapterDone);
  if (stars === null) return null;
  const close = () => useUI.setState({ chapterDone: null });
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal modal--chapter" onPointerDown={(e) => e.stopPropagation()}>
        <div className="chapter__num">Глава II пройдена</div>
        <div className="modal__emoji">🏆</div>
        <h2>Хозяин города</h2>
        <p>Башня достроена! С её крыши видно и лавку, с которой всё началось, и дорогу на родную ферму. Семья получает награду, а город работает дальше.</p>
        <div className="modal__money">+{stars} ⭐</div>
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
  const penny = farmPenny(g.farm);
  return (
    <div className="business">
      <div className="business__head">
        <span>
          Обслужено покупателей: <b>{formatMoney(st.stats.served)}</b>
        </span>
        <span>
          С фермы: <b>${pennyText(penny)}/с</b>
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

/**
 * The album of finds: rare little things that turn up while the farmer
 * harvests. Every plot with fields has a set of three; a complete set makes
 * that plot's goods sell for more, forever (the album is the family's).
 */
import { isSellable, type ItemId } from "./items";
import { MACHINES, type ZoneId } from "./layout";
import { MACHINE_TYPES } from "./machines";

export interface FindDef {
  id: string;
  name: string;
  icon: string;
}

export interface FindSet {
  zone: ZoneId;
  finds: readonly [FindDef, FindDef, FindDef];
}

const set = (zone: ZoneId, ...finds: [string, string, string][]): FindSet => ({
  zone,
  finds: finds.map(([id, icon, name]) => ({ id: `${zone}_${id}`, icon, name })) as unknown as FindSet["finds"],
});

export const FIND_SETS: readonly FindSet[] = [
  set("farm", ["clover", "🍀", "Четырёхлистный клевер"], ["key", "🗝️", "Ржавый ключ"], ["marble", "🔮", "Стеклянный шарик"]),
  set("coop", ["egg", "🥚", "Расписное яйцо"], ["cob", "🌽", "Початок-талисман"], ["bow", "🎀", "Бантик несушки"]),
  set("pasture", ["bell", "🔔", "Медный колокольчик"], ["wreath", "🌼", "Ромашковый венок"], ["jug", "🏺", "Глиняный кувшин"]),
  set("orchard", ["apple", "🍏", "Наливное яблочко"], ["caterpillar", "🐛", "Гусеница-путешественница"], ["acorn", "🌰", "Счастливый жёлудь"]),
  set("garden", ["ladybug", "🐞", "Божья коровка"], ["pepper", "🌶️", "Огненный перчик"], ["snail", "🐌", "Садовая улитка"]),
  set("sweets", ["candy", "🍬", "Леденец"], ["spoon", "🥄", "Серебряная ложка"], ["recipe", "📜", "Бабушкин рецепт"]),
  set("pond", ["shell", "🐚", "Ракушка"], ["ring", "💍", "Потерянное кольцо"], ["compass", "🧭", "Старый компас"]),
  set("apiary", ["bee", "🐝", "Золотая пчела"], ["candle", "🕯️", "Восковая свеча"], ["flower", "🌸", "Засушенный цветок"]),
  set("sheep", ["sock", "🧦", "Шерстяной носок"], ["pin", "🧷", "Бабушкина булавка"], ["chime", "🎐", "Колокольчик ветра"]),
  set("berries", ["berry", "🍓", "Ягода-великан"], ["butterfly", "🦋", "Бабочка-лимонница"], ["dew", "💎", "Росинка-алмаз"]),
  set("pumpkins", ["web", "🕸️", "Паутинка"], ["owl", "🦉", "Совиная статуэтка"], ["leaf", "🍁", "Кленовый лист"]),
];

/** A complete set: this much more for the plot's goods. */
export const SET_BONUS = 0.1;
/** Chance that a harvest by the farmer turns up a find. */
export const FIND_CHANCE = 1 / 110;

export const findSetOf = (zone: ZoneId) => FIND_SETS.find((s) => s.zone === zone);
export const findById = (id: string) => {
  for (const s of FIND_SETS) for (const f of s.finds) if (f.id === id) return { set: s, find: f };
  return null;
};
export const ALL_FINDS = FIND_SETS.flatMap((s) => s.finds.map((f) => f.id));

export const setComplete = (album: ReadonlySet<string>, set: FindSet) => set.finds.every((f) => album.has(f.id));

/** Plots whose machines make an item: their sets make it dearer. */
const ITEM_ZONES = new Map<ItemId, ZoneId[]>();
for (const m of MACHINES) {
  const item = MACHINE_TYPES[m.type].output.item;
  const zones = ITEM_ZONES.get(item) ?? [];
  if (!zones.includes(m.zone)) zones.push(m.zone);
  ITEM_ZONES.set(item, zones);
}

/** Price multiplier the album gives an item. */
export function albumMult(album: ReadonlySet<string>, item: ItemId) {
  for (const zone of ITEM_ZONES.get(item) ?? []) {
    const s = findSetOf(zone);
    if (s && setComplete(album, s)) return 1 + SET_BONUS;
  }
  return 1;
}

/** Goods a plot's complete set makes dearer (for the album page). */
export const goodsOf = (zone: ZoneId) => [...ITEM_ZONES].filter(([item, zones]) => isSellable(item) && zones.includes(zone)).map(([item]) => item);

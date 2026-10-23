/**
 * Achievements: milestones across everything the farm does. They are checked
 * a couple of times a second, unlock once and stay unlocked forever (across
 * generations too). Some come with a hat for the farmer.
 */
import type { ItemId } from "../data/items";
import { ZONES } from "../data/layout";
import type { HatId } from "../data/hats";
import { MACHINE_MAX_LEVEL } from "../data/balance";
import type { Game } from "./Game";

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  goal: number;
  /** Current progress towards the goal. */
  value: (g: Game) => number;
  /** How the progress reads: money, time or a plain count. */
  unit?: "money" | "time";
  hat?: HatId;
}

/** Goods of a kind made so far (saved, and kept across generations). */
const made = (g: Game, item: ItemId) => g.state.made[item] ?? 0;

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first_sale", name: "Первая монета", desc: "Продай первый товар", icon: "🪙", goal: 1, value: (g) => g.state.stats.sold },
  { id: "harvest_100", name: "Урожайный", desc: "Собери 100 урожаев", icon: "🌾", goal: 100, value: (g) => g.state.stats.harvested },
  { id: "worker_1", name: "Бригадир", desc: "Найми первого работника", icon: "👷", goal: 1, value: (g) => g.state.workers.length, hat: "cap" },
  { id: "earned_1k", name: "Первая тысяча", desc: "Заработай $1K", icon: "💵", goal: 1_000, value: (g) => g.state.stats.earned, unit: "money" },
  { id: "zones_4", name: "Землевладелец", desc: "Купи три новых участка", icon: "🗺️", goal: 4, value: (g) => g.state.zones.size },
  { id: "orders_10", name: "Надёжный поставщик", desc: "Выполни 10 заказов", icon: "📋", goal: 10, value: (g) => g.state.stats.orders },
  { id: "harvest_1000", name: "Хозяин полей", desc: "Собери 1 000 урожаев", icon: "🚜", goal: 1_000, value: (g) => g.state.stats.harvested },
  { id: "winter", name: "Первая зима", desc: "Доживи до зимы", icon: "❄️", goal: 3, value: (g) => g.state.stats.seasons, hat: "beanie" },
  { id: "fair_1", name: "Ярмарочный день", desc: "Выполни ярмарочный заказ", icon: "🎪", goal: 1, value: (g) => g.state.stats.fairs, hat: "party" },
  { id: "rain", name: "Под дождём", desc: "Собери 100 урожаев в дождь", icon: "🌧️", goal: 100, value: (g) => g.state.stats.rainHarvest },
  { id: "year", name: "Целый год", desc: "Проживи все четыре сезона", icon: "📅", goal: 4, value: (g) => g.state.stats.seasons, hat: "wreath" },
  { id: "truck_2", name: "Логист", desc: "Купи второй грузовик", icon: "🚚", goal: 2, value: (g) => g.state.depot?.trucks.length ?? 0 },
  { id: "workers_25", name: "Работодатель", desc: "25 работников на ферме", icon: "👥", goal: 25, value: (g) => g.state.workers.length },
  { id: "earned_1m", name: "Миллионер", desc: "Заработай $1M", icon: "💰", goal: 1_000_000, value: (g) => g.state.stats.earned, unit: "money", hat: "cowboy" },
  { id: "autumn_bonus", name: "Щедрая осень", desc: "Получи 50 бонусных урожаев осенью", icon: "🍂", goal: 50, value: (g) => g.state.stats.bonusHarvest, hat: "pumpkin" },
  { id: "playtime", name: "Фермер со стажем", desc: "Проведи на ферме 2 часа", icon: "⏱️", goal: 7_200, value: (g) => g.state.stats.playTime, unit: "time" },
  { id: "machine_max", name: "Мастер улучшений", desc: "Прокачай любую машину до 10 уровня", icon: "⚙️", goal: MACHINE_MAX_LEVEL, value: (g) => Math.max(0, ...g.state.machines.map((m) => m.level)) },
  { id: "market_max", name: "Лучший рынок", desc: "Улучши рынок до 10 уровня", icon: "🏪", goal: 10, value: (g) => g.state.marketLevel },
  { id: "night_fish", name: "Ночной рыбак", desc: "Поймай 50 рыб ночью", icon: "🎣", goal: 50, value: (g) => g.state.stats.nightFish, hat: "fisher" },
  { id: "orders_50", name: "Любимец рынка", desc: "Выполни 50 заказов", icon: "⭐", goal: 50, value: (g) => g.state.stats.orders },
  { id: "fairs_4", name: "Ярмарка круглый год", desc: "Выполни 4 ярмарочных заказа", icon: "🎡", goal: 4, value: (g) => g.state.stats.fairs },
  { id: "sweater", name: "Тёплый свитер", desc: "Свяжи первый свитер", icon: "🧥", goal: 1, value: (g) => made(g, "sweater") },
  { id: "icecream_100", name: "Сладкоежка", desc: "Сделай 100 порций мороженого", icon: "🍦", goal: 100, value: (g) => made(g, "icecream") },
  { id: "first_pie", name: "Тыквенный пирог", desc: "Испеки первый тыквенный пирог", icon: "🥧", goal: 1, value: (g) => made(g, "pie"), hat: "chef" },
  { id: "harvest_10000", name: "Житница", desc: "Собери 10 000 урожаев", icon: "🏅", goal: 10_000, value: (g) => g.state.stats.harvested },
  { id: "workers_60", name: "Трудовая империя", desc: "60 работников на ферме", icon: "🏭", goal: 60, value: (g) => g.state.workers.length },
  { id: "zones_all", name: "Вся карта", desc: "Открой все участки", icon: "🌍", goal: ZONES.length, value: (g) => g.state.zones.size },
  { id: "statue", name: "Золотая статуя", desc: "Построй Золотую статую", icon: "🏆", goal: 1, value: (g) => (g.state.statue ? 1 : 0), hat: "crown" },
  { id: "earned_1b", name: "Миллиардер", desc: "Заработай $1B", icon: "💎", goal: 1_000_000_000, value: (g) => g.state.stats.earned, unit: "money", hat: "tophat" },
  { id: "generation", name: "Новое поколение", desc: "Передай ферму наследникам", icon: "👨‍👩‍👧", goal: 1, value: (g) => g.state.prestige.generations },
  { id: "stars_10", name: "Звёздная семья", desc: "Накопи 10 звёзд наследия", icon: "🌟", goal: 10, value: (g) => g.state.prestige.stars },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find((a) => a.id === id);

/** Hats the farmer may wear: the straw hat plus every hat earned. */
export function unlockedHats(unlocked: ReadonlySet<string>): HatId[] {
  const hats: HatId[] = ["straw"];
  for (const a of ACHIEVEMENTS) if (a.hat && unlocked.has(a.id)) hats.push(a.hat);
  return hats;
}

const CHECK_EVERY = 0.5;

/** Unlock everything that has reached its goal (throttled). */
export function updateAchievements(game: Game, dt: number) {
  const st = game.state;
  st.achievementTimer -= dt;
  if (st.achievementTimer > 0) return;
  st.achievementTimer = CHECK_EVERY;
  for (const a of ACHIEVEMENTS) {
    if (st.achievements.has(a.id) || a.value(game) < a.goal) continue;
    st.achievements.add(a.id);
    game.emit({ type: "achievement", id: a.id });
  }
}

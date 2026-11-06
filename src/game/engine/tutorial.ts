import type { ItemId } from "../data/items";
import { FIELDS, MARKET } from "../data/layout";
import { CITY_FIRST_PAD } from "../data/city";
import type { Game } from "./Game";

export interface TutorialStep {
  /** Item whose rendered icon the HUD shows instead of the emoji. */
  item?: ItemId;
  text: string;
  icon: string;
}

export const TUTORIAL: readonly TutorialStep[] = [
  { text: "Пробеги по полю — собери пшеницу", icon: "🌾", item: "wheat" },
  { text: "Отнеси пшеницу на мельницу", icon: "🌀", item: "wheat" },
  { text: "Забери готовую муку", icon: "🍚", item: "flour" },
  { text: "Продай муку на рынке", icon: "💰", item: "flour" },
  { text: "Встань на площадку — купи грядку", icon: "🏗️" },
];

/** The city's first steps: the same five, so both worlds share the numbers below. */
export const CITY_TUTORIAL: readonly TutorialStep[] = [
  { text: "Фургон привёз хлеб с фермы — забери его с паллеты", icon: "🍞", item: "bread" },
  { text: "Выложи хлеб на прилавок: встань за ним", icon: "🧺", item: "bread" },
  { text: "Покупатель несёт хлеб на кассу — встань за кассу", icon: "🧾" },
  { text: "Выручка на столе — забери её", icon: "💵" },
  { text: "Встань на площадку — закажи новый товар", icon: "🥚", item: "egg" },
];

/** The steps of the world you are in. */
export const tutorialSteps = (game: Game) => (game.state.world === "city" ? CITY_TUTORIAL : TUTORIAL);

/** Step from which purchase pads become visible. */
export const TUTORIAL_PADS_STEP = 4;
export const TUTORIAL_DONE = TUTORIAL.length;

export function tutorialTarget(game: Game): { x: number; z: number } | null {
  const st = game.state;
  if (st.world === "city") return cityTarget(game);
  const mill = game.machine("mill");
  switch (st.tutorial) {
    case 0: {
      const f = FIELDS[0];
      return { x: f.x, z: f.z };
    }
    case 1:
      return mill ? { x: mill.inRect.x, z: mill.inRect.z } : null;
    case 2:
      return mill ? { x: mill.outRect.x, z: mill.outRect.z } : null;
    case 3:
      return { x: MARKET.sell.x, z: MARKET.sell.z };
    case 4: {
      const pad = game.pad("field_wheat_2");
      return pad ? { x: pad.def.x, z: pad.def.z } : null;
    }
    default:
      return null;
  }
}

/** Dynamic hint text — some steps need a nudge when the player is stuck. */
export function tutorialText(game: Game): string | null {
  const st = game.state;
  if (st.tutorial >= TUTORIAL_DONE) return null;
  if (st.world === "city") return cityText(game);
  const p = st.player;
  if (st.tutorial === 2) {
    const mill = game.machine("mill");
    if (p.stack.length >= p.capacity && !p.stack.includes("flour")) return "Освободи руки: отнеси пшеницу на мельницу";
    if (mill && mill.output === 0) return "Мельница мелет муку — подожди у выхода";
  }
  return TUTORIAL[st.tutorial].text;
}

// ── the city ────────────────────────────────────────────────────────────
function cityTarget(game: Game) {
  const st = game.state;
  const shop = st.city!.shops[0];
  const pallet = st.machines[0];
  switch (st.tutorial) {
    case 0:
      return { x: pallet.outRect.x, z: pallet.outRect.z };
    case 1:
      return { x: shop.shelves[0].def.staff.x, z: shop.shelves[0].def.staff.z };
    case 2:
      return { x: shop.def.till.x, z: shop.def.till.z };
    case 3:
      return { x: shop.def.cash.x, z: shop.def.cash.z };
    case 4: {
      const pad = game.pad(CITY_FIRST_PAD);
      return pad ? { x: pad.def.x, z: pad.def.z } : null;
    }
    default:
      return null;
  }
}

function cityText(game: Game) {
  const st = game.state;
  if (st.tutorial === 2 && st.city!.shops[0].queue.length === 0) return "Покупатель выбирает хлеб — иди к кассе и жди его там";
  return CITY_TUTORIAL[st.tutorial].text;
}

function cityStepDone(game: Game) {
  const st = game.state;
  const shop = st.city!.shops[0];
  switch (st.tutorial) {
    case 0:
      return st.player.stack.length >= Math.min(4, st.player.capacity);
    case 1:
      return shop.shelves[0].count > 0;
    case 2:
      return st.stats.served > 0;
    case 3:
      return st.stats.earned > 0 && shop.bundles === 0;
    case 4:
      return st.stats.purchases > 0;
    default:
      return false;
  }
}

export function updateTutorial(game: Game) {
  const st = game.state;
  if (st.tutorial >= TUTORIAL_DONE) return;
  const p = st.player;
  let done = false;
  if (st.world === "city") done = cityStepDone(game);
  else switch (st.tutorial) {
    case 0:
      done = p.stack.filter((i) => i === "wheat").length >= Math.min(6, p.capacity);
      break;
    case 1: {
      const mill = game.machine("mill");
      done = !!mill && ((mill.inputs.wheat ?? 0) > 0 || mill.working || mill.output > 0);
      break;
    }
    case 2:
      done = p.stack.includes("flour");
      break;
    case 3:
      done = st.stats.sold > 0;
      break;
    case 4:
      done = st.stats.purchases > 0;
      break;
  }
  if (done) {
    st.tutorial++;
    game.emit({ type: "tutorial", step: st.tutorial });
    if (st.tutorial === TUTORIAL_PADS_STEP) game.rebuild();
  }
}

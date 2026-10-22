import type { ItemId } from "../data/items";
import { FIELDS, MARKET } from "../data/layout";
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

/** Step from which purchase pads become visible. */
export const TUTORIAL_PADS_STEP = 4;
export const TUTORIAL_DONE = TUTORIAL.length;

export function tutorialTarget(game: Game): { x: number; z: number } | null {
  const st = game.state;
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
  const p = st.player;
  if (st.tutorial === 2) {
    const mill = game.machine("mill");
    if (p.stack.length >= p.capacity && !p.stack.includes("flour")) return "Освободи руки: отнеси пшеницу на мельницу";
    if (mill && mill.output === 0) return "Мельница мелет муку — подожди у выхода";
  }
  return TUTORIAL[st.tutorial].text;
}

export function updateTutorial(game: Game) {
  const st = game.state;
  if (st.tutorial >= TUTORIAL_DONE) return;
  const p = st.player;
  let done = false;
  switch (st.tutorial) {
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

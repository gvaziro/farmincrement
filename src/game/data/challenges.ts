/**
 * Challenges for a new generation: chosen (or not) when the farm is handed
 * over. They make the run harder and multiply the stars it earns. Unlike
 * everything else in the game they do take something away — that is why
 * they are voluntary. The multipliers come from the bot: `npm run
 * balance:challenges` plays a generation with each one.
 */
export const CHALLENGE_IDS = ["diy", "stingy", "winter", "pricey", "fresh"] as const;
export type ChallengeId = (typeof CHALLENGE_IDS)[number];

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  icon: string;
  /** What it does, as shown on the hand-over card. */
  desc: string;
  /** Stars multiplier for the generation that takes it on. */
  stars: number;
}

/** "Своими руками": hiring workers costs this much more. */
export const DIY_HIRE_MULT = 2;
/** "Скупой рынок": the market and the trucks pay this share. */
export const STINGY_MARKET = 0.6;
/** "Вечная зима": plants and orchards grow this fast (fish do not mind the cold)… */
export const WINTER_GROWTH = 0.5;
/**
 * …and the machines freeze: this speed instead of winter's bonus (a winter
 * all year long with the bonus turned out *faster* than a normal year).
 */
export const WINTER_MACHINES = 0.75;
/** "Дорогая земля": plots cost this much more. */
export const PRICEY_LAND_MULT = 3;

export const CHALLENGES: Record<ChallengeId, ChallengeDef> = {
  diy: { id: "diy", name: "Своими руками", icon: "🧑‍🌾", desc: `найм работников в ${DIY_HIRE_MULT} раза дороже`, stars: 1.6 },
  stingy: {
    id: "stingy",
    name: "Скупой рынок",
    icon: "💸",
    desc: `рынок и грузовики платят ${Math.round(STINGY_MARKET * 100)}% цены; заказы, ярмарки и торговец — как обычно`,
    stars: 1.75,
  },
  winter: {
    id: "winter",
    name: "Вечная зима",
    icon: "❄️",
    desc: `весь год зима: снег и зимний спрос, но машины мёрзнут (−${Math.round((1 - WINTER_MACHINES) * 100)}% скорости), а посадки растут в ${Math.round(1 / WINTER_GROWTH)} раза медленнее`,
    stars: 1.3,
  },
  pricey: { id: "pricey", name: "Дорогая земля", icon: "🗺️", desc: `участки в ${PRICEY_LAND_MULT} раза дороже`, stars: 1.4 },
  fresh: { id: "fresh", name: "С чистого листа", icon: "🏚️", desc: "улучшения лавки наследия не действуют", stars: 1.7 },
};

export const isChallengeId = (v: unknown): v is ChallengeId => typeof v === "string" && (CHALLENGE_IDS as readonly string[]).includes(v);

/** Stars multiplier of a set of challenges (they multiply). */
export const challengeStars = (ids: readonly ChallengeId[]) => ids.reduce((m, id) => m * CHALLENGES[id].stars, 1);

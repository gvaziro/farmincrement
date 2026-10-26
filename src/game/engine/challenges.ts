/**
 * What the current generation's challenges change. Small helpers, so the
 * systems read them the same way everywhere.
 */
import type { ChallengeId } from "../data/challenges";
import type { PerkId } from "../data/legacy";
import type { SeasonId } from "./seasons";

interface WithChallenges {
  challenges: readonly ChallengeId[];
}

export const hasChallenge = (st: WithChallenges, id: ChallengeId) => st.challenges.includes(id);

/** "Вечная зима" stops the calendar in winter (undefined: the calendar runs). */
export const frozenSeason = (st: WithChallenges): SeasonId | undefined => (hasChallenge(st, "winter") ? "winter" : undefined);

/** Level of a legacy upgrade that actually works now ("С чистого листа" switches them all off). */
export const effectivePerk = (st: WithChallenges & { legacy: Partial<Record<PerkId, number>> }, id: PerkId) =>
  hasChallenge(st, "fresh") ? 0 : (st.legacy[id] ?? 0);

/**
 * Tuning of the little events "in between" (engine/systems/surprises.ts).
 * Like everything else in the game they only ever give. Money rewards are
 * counted in seconds of the farm's automated income, so they fit any stage.
 */

/** Seconds until the first of each event once the tutorial is done. */
export const FIRST_GOLDEN = 100;
export const FIRST_MERCHANT = 240;
export const FIRST_RUNAWAY = 360;

/** Pause between two golden plants: min + random · spread seconds. */
export const GOLDEN_EVERY = { min: 200, spread: 140 } as const;
/** A golden plant fades if nobody picks it in time. */
export const GOLDEN_LIFE = 60;
/** "Gold rush": every sale pays this much more, for this long. */
export const RUSH_MULT = 2;
export const RUSH_TIME = 60;
/** A bag of money: this many seconds of automated income. */
export const GOLDEN_MONEY_SECONDS = 60;
/** Chances of the three rewards (the rest is "bloom": every field ripe at once). */
export const GOLDEN_RUSH_CHANCE = 0.35;
export const GOLDEN_MONEY_CHANCE = 0.4;

export const MERCHANT_EVERY = { min: 300, spread: 180 } as const;
/** How long the merchant waits for his goods. */
export const MERCHANT_WAIT = 150;
/** He pays this times the market price for each item. */
export const MERCHANT_MULT = 2.5;
/** Seconds the cart takes to roll in / out. */
export const MERCHANT_DRIVE = 1.6;

export const RUNAWAY_EVERY = { min: 360, spread: 240 } as const;
/** A runaway gets bored and goes home after this long. */
export const RUNAWAY_LIFE = 90;
/** Catching one: this many seconds of automated income. */
export const RUNAWAY_MONEY_SECONDS = 30;
/** It notices the farmer this close, and is caught this close. */
export const RUNAWAY_SCARE = 4.5;
export const RUNAWAY_CATCH = 0.95;
/** Fleeing speed as a share of the farmer's (so it can always be caught). */
export const RUNAWAY_FLEE = 0.78;
export const RUNAWAY_WANDER_SPEED = 1.3;
/** It wanders this far from its pen. */
export const RUNAWAY_RANGE = 7;
/** The pen an animal gets out of (a machine id). */
export const RUNAWAY_HOMES = { chicken: "coop", cow: "barn", sheep: "sheepfold" } as const;

/** The foreman's whistle: workers run this much faster, for this long; cooldown counts from the blow. */
export const WHISTLE_MULT = 2;
export const WHISTLE_TIME = 30;
export const WHISTLE_COOLDOWN = 180;

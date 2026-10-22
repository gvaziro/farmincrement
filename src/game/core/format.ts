const SUFFIXES = ["", "K", "M", "B", "T", "Qa", "Qi"];

/** 1234 → "1.23K", 15 → "15". Short enough for pads and HUD. */
export function formatMoney(value: number): string {
  const v = Math.floor(value);
  if (v < 1000) return String(v);
  let tier = Math.floor(Math.log10(v) / 3);
  if (tier >= SUFFIXES.length) tier = SUFFIXES.length - 1;
  const scaled = v / Math.pow(1000, tier);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  // Truncate instead of rounding so "999.99K" never shows as "1000K".
  const factor = Math.pow(10, digits);
  const truncated = Math.floor(scaled * factor) / factor;
  let s = truncated.toFixed(digits);
  // Drop trailing zeros of the fraction only ("1.50" → "1.5", but "450" stays).
  if (digits > 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s + SUFFIXES[tier];
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${sec} с`;
  return `${sec} с`;
}

/** Russian plural: plural(5, ["предмет", "предмета", "предметов"]) */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

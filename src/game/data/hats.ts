/** Hats for the farmer: the straw hat to start with, the rest are achievement rewards. */
export const HAT_IDS = ["straw", "cap", "beanie", "wreath", "cowboy", "fisher", "party", "pumpkin", "chef", "crown", "tophat", "explorer"] as const;

export type HatId = (typeof HAT_IDS)[number];

export interface HatDef {
  id: HatId;
  name: string;
  icon: string;
  /** Main colour (the models of the fancier hats have their own palette). */
  color: string;
}

export const HATS: Record<HatId, HatDef> = {
  straw: { id: "straw", name: "Соломенная шляпа", icon: "👒", color: "#f2c94c" },
  cap: { id: "cap", name: "Кепка бригадира", icon: "🧢", color: "#e8413c" },
  beanie: { id: "beanie", name: "Шапка с помпоном", icon: "🧶", color: "#3f8fd9" },
  wreath: { id: "wreath", name: "Венок", icon: "🌼", color: "#4fae3a" },
  cowboy: { id: "cowboy", name: "Ковбойская шляпа", icon: "🤠", color: "#a0612f" },
  fisher: { id: "fisher", name: "Панама рыбака", icon: "🎣", color: "#8a9a5b" },
  party: { id: "party", name: "Праздничный колпак", icon: "🥳", color: "#ff5d8f" },
  pumpkin: { id: "pumpkin", name: "Тыква", icon: "🎃", color: "#f28c28" },
  chef: { id: "chef", name: "Поварской колпак", icon: "👨‍🍳", color: "#ffffff" },
  crown: { id: "crown", name: "Корона", icon: "👑", color: "#ffcc33" },
  tophat: { id: "tophat", name: "Цилиндр", icon: "🎩", color: "#2b2b2b" },
  explorer: { id: "explorer", name: "Пробковый шлем", icon: "🧭", color: "#d9c48f" },
};

export const isHatId = (v: unknown): v is HatId => typeof v === "string" && (HAT_IDS as readonly string[]).includes(v);

export const ITEM_IDS = [
  "wheat",
  "corn",
  "grass",
  "apple",
  "tomato",
  "flour",
  "feed",
  "egg",
  "milk",
  "bread",
  "cheese",
  "juice",
  "sauce",
  "cake",
  "fish",
  "smokedfish",
  "canned",
  "flower",
  "honeycomb",
  "honey",
  "wool",
  "yarn",
  "sweater",
  "strawberry",
  "jam",
  "icecream",
  "pumpkin",
  "pie",
  "lantern",
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Emoji used in HUD / bubbles / pads. */
  icon: string;
  /** Base sell price; 0 = cannot be sold (raw crop or animal feed). */
  price: number;
  /** Height of one item in a stack, metres. */
  height: number;
  /** Main colour, used for particles and UI accents. */
  color: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wheat: { id: "wheat", name: "Пшеница", icon: "🌾", price: 0, height: 0.28, color: "#f2c94c" },
  corn: { id: "corn", name: "Кукуруза", icon: "🌽", price: 0, height: 0.28, color: "#ffd23f" },
  grass: { id: "grass", name: "Сено", icon: "🌿", price: 0, height: 0.3, color: "#8fd14f" },
  apple: { id: "apple", name: "Яблоко", icon: "🍎", price: 0, height: 0.3, color: "#e8413c" },
  tomato: { id: "tomato", name: "Помидор", icon: "🍅", price: 0, height: 0.28, color: "#ff5a36" },
  flour: { id: "flour", name: "Мука", icon: "🍚", price: 2, height: 0.34, color: "#f5efe3" },
  feed: { id: "feed", name: "Корм", icon: "🌰", price: 0, height: 0.34, color: "#b9874a" },
  egg: { id: "egg", name: "Яйца", icon: "🥚", price: 15, height: 0.25, color: "#fff4dc" },
  milk: { id: "milk", name: "Молоко", icon: "🥛", price: 28, height: 0.39, color: "#ffffff" },
  bread: { id: "bread", name: "Хлеб", icon: "🍞", price: 6, height: 0.28, color: "#d9913f" },
  cheese: { id: "cheese", name: "Сыр", icon: "🧀", price: 70, height: 0.25, color: "#ffc93c" },
  juice: { id: "juice", name: "Сок", icon: "🧃", price: 120, height: 0.41, color: "#ff9f1c" },
  sauce: { id: "sauce", name: "Соус", icon: "🥫", price: 300, height: 0.34, color: "#d7263d" },
  cake: { id: "cake", name: "Торт", icon: "🎂", price: 1200, height: 0.35, color: "#ff8fb1" },
  fish: { id: "fish", name: "Рыба", icon: "🐟", price: 0, height: 0.24, color: "#6fa8c8" },
  smokedfish: { id: "smokedfish", name: "Копчёная рыба", icon: "🍣", price: 1500, height: 0.26, color: "#c9772f" },
  canned: { id: "canned", name: "Рыбные консервы", icon: "🐡", price: 4000, height: 0.22, color: "#5aa3d9" },
  flower: { id: "flower", name: "Цветы", icon: "💐", price: 0, height: 0.28, color: "#ff7eb6" },
  honeycomb: { id: "honeycomb", name: "Соты", icon: "🧇", price: 3500, height: 0.2, color: "#f5b62a" },
  honey: { id: "honey", name: "Мёд", icon: "🍯", price: 10000, height: 0.36, color: "#f0a020" },
  wool: { id: "wool", name: "Шерсть", icon: "☁️", price: 0, height: 0.34, color: "#f6f1e4" },
  yarn: { id: "yarn", name: "Пряжа", icon: "🧶", price: 12000, height: 0.33, color: "#e86fa6" },
  sweater: { id: "sweater", name: "Свитер", icon: "🧥", price: 30000, height: 0.2, color: "#d9485f" },
  strawberry: { id: "strawberry", name: "Клубника", icon: "🍓", price: 0, height: 0.24, color: "#e8323c" },
  jam: { id: "jam", name: "Варенье", icon: "🫙", price: 40000, height: 0.34, color: "#c2185b" },
  icecream: { id: "icecream", name: "Мороженое", icon: "🍦", price: 90000, height: 0.36, color: "#ffb3cf" },
  pumpkin: { id: "pumpkin", name: "Тыква", icon: "🎃", price: 0, height: 0.3, color: "#f28c28" },
  pie: { id: "pie", name: "Тыквенный пирог", icon: "🥧", price: 150000, height: 0.18, color: "#e8a040" },
  lantern: { id: "lantern", name: "Фонарь-тыква", icon: "🏮", price: 70000, height: 0.33, color: "#ff7a1a" },
};

export const isSellable = (id: ItemId) => ITEMS[id].price > 0;

/** "What's new" for returning players: each item belongs to an update. */
export const NEWS: readonly { version: number; icon: string; text: string }[] = [
  { version: 1, icon: "🌸", text: "Времена года: у весны, лета, осени и зимы свои бонусы и свой спрос на рынке" },
  { version: 1, icon: "🌧️", text: "Погода: дожди ускоряют урожай, после них — радуга; туманы и снегопады" },
  { version: 1, icon: "🐑", text: "Три новых участка на севере: овчарня, ягодник и тыквенное поле" },
  { version: 1, icon: "🎪", text: "Ярмарка в последний день сезона — награда ×2; праздничные украшения" },
  { version: 1, icon: "🏆", text: "31 достижение и шляпы для фермера — во вкладке «Трофеи» дома фермера" },
  { version: 1, icon: "💾", text: "Сохранение можно перенести кодом или файлом, есть резервные копии" },
  { version: 2, icon: "🏛️", text: "Лавка наследия: звёзды теперь тратятся на семейные улучшения — стартовый капитал, родовые земли, слава и другие" },
  { version: 2, icon: "👨‍👩‍👧", text: "Каждое поколение видно: табличка на доме и своя рубашка у фермера" },
];

/** The newest update with news. */
export const NEWS_VERSION = Math.max(...NEWS.map((n) => n.version));

/** What a player who last saw `seen` has not seen yet. */
export const unseenNews = (seen: number) => NEWS.filter((n) => n.version > seen);

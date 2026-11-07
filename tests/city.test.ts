import { describe, expect, it } from "vitest";
import { CITY_BUS_STOP, CITY_OFFICE, CITY_PADS, CITY_START_MONEY, FARM_BUS_STOP, FLOOR_COSTS, SHELVES, SHOPS, TABLES, TOWER_FLOORS, TOWER_STARS, shopById } from "@/game/data/city";
import { ITEMS } from "@/game/data/items";
import { CITY_MACHINES, ZONE_D, ZONE_W, CITY_ZONES, machineById, zoneRect, type WorkerJob } from "@/game/data/layout";
import { MACHINE_TYPES } from "@/game/data/machines";
import { boxRect } from "@/game/engine/cityWorld";
import { Game } from "@/game/engine/Game";
import { SAVE_VERSION, deserialize, loadGame, serialize, serializeGame } from "@/game/engine/save";
import { collectCash, dropOnShelf, farmPenny } from "@/game/engine/systems/city";
import { TUTORIAL_DONE, tutorialText } from "@/game/engine/tutorial";
import type { GameState } from "@/game/engine/types";
import { run, walkTo } from "./helpers";

/** A family that has built the statue. */
function farmWithStatue() {
  const g = new Game();
  g.state.tutorial = TUTORIAL_DONE;
  g.state.statue = true;
  g.state.bus = true;
  g.rebuild();
  return g;
}

function inCity() {
  const g = farmWithStatue();
  g.travel();
  g.state.tutorial = TUTORIAL_DONE;
  // No outside money unless a test asks for it.
  g.state.penny.rate = 0;
  g.drainEvents();
  g.rebuild();
  return g;
}

const completeAll = (g: Game, ids: string[]) => {
  for (const id of ids) {
    const p = g.pad(id);
    if (!p) throw new Error(`no pad ${id}`);
    g.completePad(p);
  }
};

const overlap = (a: { x: number; z: number; hw: number; hd: number }, b: { x: number; z: number; hw: number; hd: number }) => Math.abs(a.x - b.x) < a.hw + b.hw - 0.01 && Math.abs(a.z - b.z) < a.hd + b.hd - 0.01;

describe("city data", () => {
  it("every pad requires only pads that exist, and everything can be reached", () => {
    const ids = new Set(CITY_PADS.map((p) => p.id));
    expect(ids.size).toBe(CITY_PADS.length);
    const reachable = new Set<string>();
    for (let changed = true; changed; ) {
      changed = false;
      for (const p of CITY_PADS) {
        if (reachable.has(p.id)) continue;
        for (const r of p.requires) expect(ids.has(r), `${p.id} needs ${r}`).toBe(true);
        if (p.requires.every((r) => reachable.has(r))) {
          reachable.add(p.id);
          changed = true;
        }
      }
    }
    expect(reachable.size).toBe(CITY_PADS.length);
  });

  it("every pad lies on its plot and costs something", () => {
    for (const p of CITY_PADS) {
      const z = CITY_ZONES.find((c) => c.id === p.zone)!;
      const r = zoneRect(z);
      expect(Math.abs(p.x - r.x) + p.size / 2, p.id).toBeLessThanOrEqual(ZONE_W / 2 + 0.01);
      expect(Math.abs(p.z - r.z) + p.size / 2, p.id).toBeLessThanOrEqual(ZONE_D / 2 + 0.01);
      expect(p.cost, p.id).toBeGreaterThan(0);
    }
  });

  it("pads on one plot do not overlap each other", () => {
    const hits: string[] = [];
    for (let i = 0; i < CITY_PADS.length; i++) {
      for (let j = i + 1; j < CITY_PADS.length; j++) {
        const a = CITY_PADS[i];
        const b = CITY_PADS[j];
        const ra = { x: a.x, z: a.z, hw: a.size / 2, hd: a.size / 2 };
        const rb = { x: b.x, z: b.z, hw: b.size / 2, hd: b.size / 2 };
        if (overlap(ra, rb)) hits.push(`${a.id} / ${b.id}`);
      }
    }
    expect(hits.join(" | ")).toBe("");
  });

  it("pads stay off what gets built next to them", () => {
    const solid = [
      ...SHOPS.flatMap((s) => [boxRect(s.register), boxRect(s.till), boxRect(s.cash), boxRect(s.bin)]),
      ...SHELVES.map((s) => boxRect(s.staff)),
      ...CITY_MACHINES.filter((m) => !MACHINE_TYPES[m.type].supply).map((m) => {
        const t = MACHINE_TYPES[m.type];
        return { x: m.x, z: m.z, hw: t.size[0] / 2, hd: t.size[1] / 2 };
      }),
      ...CITY_MACHINES.filter((m) => MACHINE_TYPES[m.type].supply).map((m) => ({ x: m.x, z: m.z, hw: 1, hd: 1 })),
      boxRect(CITY_BUS_STOP),
      boxRect(CITY_OFFICE.door),
    ];
    const hits: string[] = [];
    for (const p of CITY_PADS) {
      // A goods or kitchen pad stands right where its own thing appears.
      if (p.id.startsWith("goods_") || p.id.startsWith("build_")) continue;
      const r = { x: p.x, z: p.z, hw: p.size / 2, hd: p.size / 2 };
      for (const s of solid) if (overlap(r, s)) hits.push(`${p.id} at ${p.x},${p.z} hits ${s.x},${s.z}`);
    }
    expect(hits.join(" | ")).toBe("");
  });

  it("a carrier carries what its target takes", () => {
    for (const p of CITY_PADS) {
      if (p.effect.type !== "worker") continue;
      const job: WorkerJob = p.effect.worker.job;
      if (job.kind !== "carrier") continue;
      const source = MACHINE_TYPES[machineById(job.source).type];
      const item = source.output.item;
      if (job.target.kind === "machine") {
        const t = MACHINE_TYPES[machineById(job.target.id).type];
        expect(t.inputs.map((i) => i.item), p.id).toContain(item);
      } else if (job.target.kind === "shelf") {
        const id = job.target.id;
        expect(SHELVES.find((s) => s.id === id)?.item, p.id).toBe(item);
      }
    }
  });

  it("every recipe's goods reach its kitchen", () => {
    for (const m of CITY_MACHINES) {
      const t = MACHINE_TYPES[m.type];
      for (const inp of t.inputs) {
        const delivered = CITY_PADS.some((p) => p.effect.type === "worker" && p.effect.worker.job.kind === "carrier" && p.effect.worker.job.target.kind === "machine" && p.effect.worker.job.target.id === m.id && MACHINE_TYPES[machineById(p.effect.worker.job.source).type].output.item === inp.item);
        expect(delivered, `${m.id} needs ${inp.item}`).toBe(true);
      }
    }
  });

  it("every counter sells something a shelf pad opens", () => {
    for (const s of SHELVES) {
      const opened = s.id === "shelf_lavka_bread" || CITY_PADS.some((p) => p.effect.type === "city" && p.effect.shelves.includes(s.id));
      expect(opened, s.id).toBe(true);
      expect(ITEMS[s.item].price, s.id).toBeGreaterThan(0);
    }
    for (const t of TABLES) expect(CITY_PADS.some((p) => p.effect.type === "city" && p.effect.tables.includes(t.id)), t.id).toBe(true);
  });

  it("every machine and business can be built, and the map is walkable", () => {
    const opened = new Set(CITY_PADS.flatMap((p) => (p.effect.type === "city" ? p.effect.machines : [])));
    opened.add("sup_c_lavka_bread");
    for (const m of CITY_MACHINES) expect(opened.has(m.id), m.id).toBe(true);
    for (const s of SHOPS) {
      if (s.id === "lavka") continue;
      expect(CITY_PADS.some((p) => p.effect.type === "zone" && p.effect.id === s.zone), s.id).toBe(true);
    }
  });
});

describe("the bus", () => {
  it("runs only after the statue", () => {
    const g = new Game();
    expect(g.canTravel()).toBe(false);
    expect(g.travel()).toBeNull();
    expect(g.state.world).toBe("farm");
    expect(g.interactById("bus")).toBeUndefined();
    const s = farmWithStatue();
    expect(s.interactById("bus")).toBeDefined();
    expect(s.canTravel()).toBe(true);
  });

  it("takes you to a new city with its own wallet and back to the same farm", () => {
    const g = farmWithStatue();
    g.state.money = 1_000_000;
    const farm = g.state;
    g.travel();
    expect(g.state.world).toBe("city");
    expect(g.state.money).toBe(CITY_START_MONEY);
    expect(g.sleeping).toBe(farm);
    g.state.money = 500;
    g.travel(undefined, Date.now());
    expect(g.state).toBe(farm);
    expect(g.state.money).toBe(1_000_000);
    expect(g.sleeping?.money).toBe(500);
  });

  it("the farm stands still while you are away", () => {
    const g = farmWithStatue();
    const farm = g.state;
    run(g, 2);
    const clock = farm.dayClock;
    g.travel();
    run(g, 5);
    expect(farm.dayClock).toBe(clock);
    expect(g.state.dayClock).toBeGreaterThan(4);
  });

  it("each world gets offline income for the time apart", () => {
    const g = farmWithStatue();
    g.state.autoIncome.rate = 100;
    const t0 = 1_000_000;
    g.travel(undefined, t0);
    expect(g.travel(undefined, t0 + 30_000)).toBeNull();
    g.travel(undefined, t0 + 30_000);
    const pay = g.travel(undefined, t0 + 30_000 + 3_600_000);
    expect(pay).not.toBeNull();
    expect(pay!.seconds).toBe(3600);
    expect(pay!.money).toBe(Math.floor(100 * 3600 * 0.6));
    expect(g.state.world).toBe("farm");
  });

  it("the farm sends a penny: more machines, more money", () => {
    const g = farmWithStatue();
    const pennyFrom = farmPenny(g.state);
    expect(pennyFrom).toBeGreaterThan(0);
    g.travel();
    expect(g.state.penny.rate).toBe(pennyFrom);
    g.state.tutorial = TUTORIAL_DONE;
    g.state.penny.t = 0.2;
    const before = g.state.money;
    g.state.penny.acc = 5;
    run(g, 0.5);
    expect(g.state.money).toBeGreaterThan(before + 4);
  });

  it("trophies, hat and stars are the family's", () => {
    const g = farmWithStatue();
    g.state.prestige.stars = 7;
    g.state.achievements.add("first_sale");
    g.state.hat = "crown";
    g.travel();
    expect(g.state.prestige.stars).toBe(7);
    expect(g.state.achievements.has("first_sale")).toBe(true);
    expect(g.state.hat).toBe("crown");
  });

  it("a new generation resets the farm and keeps the city", () => {
    const g = farmWithStatue();
    g.state.runEarned = 25_000_000;
    g.travel();
    const city = g.state;
    city.money = 777;
    g.travel();
    expect(g.prestige()).toBe(true);
    expect(g.state.world).toBe("farm");
    expect(g.state.bus).toBe(true);
    expect(g.sleeping).toBe(city);
    expect(g.city?.penny.rate).toBe(farmPenny(g.state));
    g.travel();
    expect(g.state).toBe(city);
    expect(g.state.money).toBe(777);
    expect(g.state.prestige.generations).toBe(1);
  });

  it("the city makes the farm's goods dearer", () => {
    const g = farmWithStatue();
    const plain = g.priceMult();
    g.travel();
    g.travel();
    expect(g.priceMult()).toBeGreaterThan(plain);
  });
});

describe("the bin", () => {
  it("takes what nobody needs", () => {
    const g = inCity();
    const st = g.state;
    const bin = st.city!.shops[0].def.bin;
    st.player.stack = ["bread", "egg"];
    st.player.x = bin.x;
    st.player.z = bin.z;
    run(g, 1);
    expect(st.player.stack.length).toBe(0);
    expect(st.money).toBe(CITY_START_MONEY);
  });
});

describe("arriving and leaving", () => {
  it("you step off the bus beside the stop, so its window does not pop up again", () => {
    const g = farmWithStatue();
    g.travel();
    expect(Math.hypot(g.state.player.x - CITY_BUS_STOP.x, g.state.player.z - CITY_BUS_STOP.z)).toBeGreaterThan(1);
    run(g, 0.3);
    expect(g.state.player.zoneId).not.toBe("bus");
    g.state.player.x = CITY_BUS_STOP.x;
    g.state.player.z = CITY_BUS_STOP.z;
    run(g, 0.3);
    expect(g.state.player.zoneId).toBe("bus");
    g.travel();
    run(g, 0.3);
    expect(g.state.world).toBe("farm");
    expect(g.state.player.zoneId).not.toBe("bus");
  });

  it("nothing stays in the air: counters and piles are right after the trip", () => {
    const g = inCity();
    const st = g.state;
    const pallet = st.machines[0];
    const shelf = st.city!.shops[0].shelves[0];
    st.player.x = pallet.outRect.x;
    st.player.z = pallet.outRect.z;
    run(g, 0.6);
    expect(st.player.incoming).toBeGreaterThan(0);
    g.travel();
    expect(st.player.incoming).toBe(0);
    expect(pallet.incomingOut).toBe(0);
    expect(shelf.incoming).toBe(0);
    expect(st.flights.length).toBe(0);
  });

  it("the customers wait where they were while you are away", () => {
    const g = inCity();
    const shop = g.state.city!.shops[0];
    shop.shelves[0].count = 16;
    run(g, 30);
    const line = shop.queue.length;
    expect(line).toBeGreaterThan(0);
    g.travel();
    run(g, 5);
    g.travel();
    expect(shop.queue.length).toBe(line);
    run(g, 2);
  });

  it("each world counts its own trophies", () => {
    const g = farmWithStatue();
    g.state.stats.served = 100_000;
    run(g, 1);
    expect(g.state.achievements.has("c_first")).toBe(false);
    g.travel();
    g.state.tutorial = TUTORIAL_DONE;
    g.state.stats.served = 1;
    run(g, 1);
    expect(g.state.achievements.has("c_first")).toBe(true);
    // The city's few sales do not count as the farm's.
    expect(g.state.achievements.has("harvest_100")).toBe(false);
  });

  it("the merchant comes to town too, and pays for his goods", () => {
    const g = inCity();
    const st = g.state;
    st.surprises.merchantIn = 0;
    run(g, 2);
    const m = st.surprises.merchant!;
    expect(m).not.toBeNull();
    expect(CITY_ZONES.some((z) => z.id === m.zone)).toBe(true);
    expect(g.interactById("merchant")).toBeDefined();
    expect(g.nav.isFree(m.x, m.z + 1.7)).toBe(true);
  });
});

describe("the first steps in town", () => {
  it("walks the player through the whole loop", () => {
    const g = farmWithStatue();
    g.travel();
    const st = g.state;
    expect(tutorialText(g)).toContain("хлеб");
    expect(g.pad("goods_lavka_egg")?.visible).toBe(false);
    const pallet = st.machines[0];
    expect(walkTo(g, pallet.outRect.x, pallet.outRect.z)).toBe(true);
    run(g, 1.5);
    expect(st.player.stack.length).toBeGreaterThan(3);
    expect(st.tutorial).toBe(1);

    const shop = st.city!.shops[0];
    const shelf = shop.shelves[0];
    expect(walkTo(g, shelf.def.staff.x, shelf.def.staff.z)).toBe(true);
    run(g, 1);
    expect(shelf.count).toBeGreaterThan(0);
    expect(st.tutorial).toBe(2);

    expect(walkTo(g, shop.def.till.x, shop.def.till.z)).toBe(true);
    for (let i = 0; i < 30 && st.stats.served === 0; i++) run(g, 1);
    expect(st.stats.served).toBeGreaterThan(0);
    expect(shop.cash).toBeGreaterThan(0);
    expect(st.tutorial).toBe(3);

    const moneyBefore = st.money;
    expect(walkTo(g, shop.def.cash.x, shop.def.cash.z)).toBe(true);
    run(g, 1.5);
    expect(st.money).toBeGreaterThan(moneyBefore);
    expect(st.tutorial).toBe(4);
    expect(g.pad("goods_lavka_egg")?.visible).toBe(true);
  });
});

describe("customers", () => {
  it("a customer takes goods from the counter, pays at the till, and the money waits on the table", () => {
    const g = inCity();
    const st: GameState = g.state;
    const shop = st.city!.shops[0];
    shop.shelves[0].count = 10;
    shop.spawnT = 0;
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka"]);
    run(g, 40);
    expect(shop.cashier).toBe(true);
    expect(st.stats.served).toBeGreaterThan(0);
    expect(shop.cash).toBeGreaterThan(0);
    expect(shop.shelves[0].count).toBeLessThan(10);
    // Nobody picks it up: it stays on the table.
    expect(st.money).toBe(CITY_START_MONEY);
  });

  it("with nothing on the counters customers come, wait and walk off: no loss", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    shop.shelves[0].count = 0;
    let sad = 0;
    for (let i = 0; i < 60 * 30; i++) {
      g.tick(1 / 30);
      // A stack stays empty: the van only fills the pallet, no carrier yet.
      for (const e of g.drainEvents()) if (e.type === "sad") sad++;
    }
    expect(sad).toBeGreaterThan(0);
    expect(st.stats.served).toBe(0);
    expect(st.money).toBe(CITY_START_MONEY);
  });

  it("nobody is served while the till is empty, and the line waits", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    shop.shelves[0].count = 16;
    run(g, 30);
    expect(st.stats.served).toBe(0);
    expect(shop.queue.length).toBeGreaterThan(0);
    const c = shop.queue[0];
    expect(c.stack.length).toBeGreaterThan(0);
  });

  it("never fills up with more customers than the place holds", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    shop.shelves[0].count = 16;
    run(g, 120);
    const inside = st.city!.customers.filter((c) => c.shop === shop.id && c.cphase !== "none").length;
    expect(inside).toBeLessThanOrEqual(4);
  });

  it("guests at a table leave a tip", () => {
    const g = inCity();
    const st = g.state;
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread", "goods_lavka_milk", "hire_c_l_egg", "hire_coll_lavka", "hire_c_l_milk", "zone_c_cafe", "goods_cafe_juice", "hire_cash_cafe", "table_cafe_0"]);
    const cafe = g.shop("cafe")!;
    cafe.shelves[0].count = 16;
    cafe.spawnT = 0;
    let tips = 0;
    let dish = false;
    for (let i = 0; i < 120 * 30 && tips === 0; i++) {
      g.tick(1 / 30);
      for (const e of g.drainEvents()) if (e.type === "tip") tips++;
      if (cafe.tables[0].seats.some((c) => c?.dish)) dish = true;
    }
    expect(dish).toBe(true);
    expect(tips).toBeGreaterThan(0);
    expect(st.stats.served).toBeGreaterThan(0);
  });
});

describe("the van", () => {
  it("brings goods to the pallets, no more than they hold", () => {
    const g = inCity();
    const st = g.state;
    const pallet = st.machines[0];
    const before = pallet.output;
    run(g, 8);
    expect(pallet.output).toBeGreaterThan(before);
    run(g, 200);
    expect(pallet.output).toBeLessThanOrEqual(24);
  });

  it("a stronger van carries more", () => {
    const g = inCity();
    const shop = g.state.city!.shops[0];
    const pad = g.pad("van_lavka")!;
    const cost1 = g.padCost(pad);
    g.completePad(pad);
    expect(shop.van.level).toBe(2);
    expect(g.padCost(pad)).toBeGreaterThan(cost1!);
    expect(g.padLevel(pad)).toBe(3);
  });

  it("carriers take goods from the pallet to the counter", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread"]);
    run(g, 40);
    expect(shop.shelves[0].count + st.stats.sold).toBeGreaterThan(0);
  });
});

describe("kitchens and hands", () => {
  it("a kitchen turns farm goods into something new", () => {
    const g = inCity();
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread", "goods_lavka_milk", "hire_c_l_egg", "hire_coll_lavka", "hire_c_l_milk", "zone_c_cafe", "goods_cafe_juice", "hire_cash_cafe", "goods_cafe_cheese", "hire_c_c_juice", "hire_c_c_cheese", "build_coffee"]);
    const coffee = g.machine("coffee")!;
    const pallet = g.machine("sup_c_cafe_milk")!;
    expect(pallet).toBeDefined();
    expect(g.shelf("shelf_cafe_latte")).toBeDefined();
    run(g, 2);
    coffee.inputs.milk = 3;
    run(g, 10);
    expect(coffee.output).toBeGreaterThan(0);
  });

  it("the player can stock a counter, and the counter has its limit", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    const shelf = shop.shelves[0];
    st.player.stack = Array.from({ length: 10 }, () => "bread" as const);
    expect(dropOnShelf(g, st.player, shelf, true)).toBe(true);
    expect(shelf.count).toBe(1);
    shelf.count = 24;
    expect(dropOnShelf(g, st.player, shelf, true)).toBe(false);
    shelf.count = 16;
    expect(dropOnShelf(g, st.workers[0] ?? st.player, shelf, false)).toBe(false);
  });

  it("the money table pays out what was earned, every cent", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    shop.cash = 100;
    shop.bundles = 4;
    const before = st.money;
    while (collectCash(g, st.player, shop, true));
    expect(st.money).toBeCloseTo(before + 100, 5);
    expect(shop.bundles).toBe(0);
    expect(shop.cash).toBe(0);
  });

  it("the collector empties the table on his own and it counts as automated", () => {
    const g = inCity();
    const st = g.state;
    const shop = st.city!.shops[0];
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread", "hire_c_l_egg", "hire_coll_lavka"]);
    shop.cash = 60;
    shop.bundles = 3;
    const before = st.money;
    run(g, 20);
    expect(st.money).toBeGreaterThan(before + 50);
  });

  it("delivery pays more than the counter", () => {
    const g = inCity();
    const st = g.state;
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread", "goods_lavka_milk", "hire_c_l_egg", "hire_coll_lavka", "hire_c_l_milk", "zone_c_cafe", "goods_cafe_juice", "hire_cash_cafe", "goods_cafe_cheese", "hire_c_c_juice", "hire_c_c_cheese", "build_coffee", "hire_c_c_milk", "hire_c_c_latte", "hire_coll_cafe", "build_sandwich", "hire_c_c_bread", "hire_c_c_ch2", "hire_c_c_sand", "zone_c_pizza", "goods_pizza_juice"]);
    const pizza = g.shop("pizza")!;
    completeAll(g, ["hire_cash_pizza", "goods_pizza_sauce", "hire_c_p_juice", "hire_c_p_sauce", "build_oven", "hire_c_p_flour", "hire_c_p_sauce2", "hire_c_p_cheese", "hire_c_p_pizza", "hire_coll_pizza", "delivery_pizza"]);
    expect(pizza.delivery).toBe(true);
    expect(g.interactById("delivery:pizza")).toBeDefined();
    const before = st.money;
    st.player.stack = ["pizza"];
    const box = pizza.def.delivery!;
    st.player.x = box.x;
    st.player.z = box.z;
    run(g, 1);
    expect(st.stats.delivered).toBe(1);
    expect(st.money).toBeGreaterThanOrEqual(before + ITEMS.pizza.price * 1.3 * 0.99);
  });
});

describe("the end of the chapter", () => {
  it("the tower grows floor by floor and pays stars at the top", () => {
    const g = inCity();
    const st = g.state;
    st.zones.add("c_tower");
    g.pad("zone_c_tower")!.done = true;
    g.rebuild();
    const pad = g.pad("tower_floor")!;
    expect(pad.visible).toBe(true);
    const stars = st.prestige.stars;
    for (let i = 0; i < TOWER_FLOORS; i++) {
      expect(g.padCost(pad)).toBe(FLOOR_COSTS[i]);
      g.completePad(pad);
      expect(st.city!.floors).toBe(i + 1);
    }
    expect(st.city!.finished).toBe(true);
    expect(st.prestige.stars).toBe(stars + TOWER_STARS);
    expect(pad.visible).toBe(false);
    run(g, 1);
    expect(st.achievements.has("c_tower")).toBe(true);
  });

  it("opening a business pays a little fame in stars", () => {
    const g = inCity();
    const st = g.state;
    const stars = st.prestige.stars;
    g.completePad(g.pad("zone_c_cafe")!);
    expect(st.city!.shops.map((s) => s.id)).toContain("cafe");
    expect(st.prestige.stars).toBe(stars + 2);
  });
});

describe("saves with two worlds", () => {
  function playedCity() {
    const g = inCity();
    const st = g.state;
    st.money = 4321;
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread", "goods_lavka_milk", "hire_c_l_egg", "hire_coll_lavka", "hire_c_l_milk", "zone_c_cafe", "goods_cafe_juice", "hire_cash_cafe", "table_cafe_0"]);
    g.completePad(g.pad("shop_lavka")!);
    g.completePad(g.pad("ads_lavka")!);
    g.completePad(g.pad("van_lavka")!);
    run(g, 3);
    const shop = g.shop("lavka")!;
    shop.shelves[0].count = 7;
    shop.cash = 55;
    shop.bundles = 2;
    return g;
  }

  it("restores the whole city, both when you are in it and when you are not", () => {
    const g = playedCity();
    const data = JSON.parse(JSON.stringify(serializeGame(g)));
    expect(data.v).toBe(SAVE_VERSION);
    expect(data.world).toBe("city");

    for (const world of ["city", "farm"] as const) {
      const raw = world === "city" ? data : JSON.parse(JSON.stringify(serializeGame((g.travel(), g))));
      const h = loadGame(raw);
      expect(h.state.world).toBe(world);
      const city = h.city!;
      expect(city.money).toBeCloseTo(g.city!.money, 0);
      expect(city.city!.shops.map((s) => s.id)).toEqual(["lavka", "cafe"]);
      const lavka = city.city!.shops[0];
      expect(lavka.level).toBe(2);
      expect(lavka.ads).toBe(2);
      expect(lavka.van.level).toBe(2);
      expect(lavka.shelves.map((s) => s.id)).toEqual(expect.arrayContaining(["shelf_lavka_bread", "shelf_lavka_egg", "shelf_lavka_milk"]));
      expect(city.workers.length).toBe(g.city!.workers.length);
      expect(city.city!.shops[1].tables.length).toBe(1);
      expect(city.machines.map((m) => m.id).sort()).toEqual(g.city!.machines.map((m) => m.id).sort());
    }
  });

  it("the game keeps running after a load", () => {
    const g = playedCity();
    const h = loadGame(JSON.parse(JSON.stringify(serializeGame(g))));
    run(h, 30);
    expect(h.state.city!.shops[0].cashier).toBe(true);
    expect(h.state.stats.served).toBeGreaterThanOrEqual(g.state.stats.served);
  });

  it("an old farm-only save loads as before", () => {
    const f = new Game();
    f.state.money = 1234;
    const data = JSON.parse(JSON.stringify(serialize(f.state)));
    data.v = 2;
    const h = loadGame(data);
    expect(h.state.world).toBe("farm");
    expect(h.state.money).toBe(1234);
    expect(h.city).toBeNull();
    expect(h.canTravel()).toBe(false);
  });

  it("an old save past the statue already has the bus", () => {
    const f = new Game();
    f.state.statue = true;
    const data = JSON.parse(JSON.stringify(serialize(f.state)));
    delete data.bus;
    data.v = 2;
    expect(deserialize(data).bus).toBe(true);
    expect(loadGame(data).canTravel()).toBe(true);
  });

  it("broken city data does not break the farm", () => {
    const f = farmWithStatue();
    const data = JSON.parse(JSON.stringify(serialize(f.state)));
    data.city = { money: "nope", zones: ["somewhere"], shops: 7, pads: null };
    data.world = "city";
    const h = loadGame(data);
    expect(h.state.world).toBe("city");
    expect(h.state.city!.shops.map((s) => s.id)).toEqual(["lavka"]);
    run(h, 2);
  });
});

describe("fixed places", () => {
  it("the farm's stop stands on open ground", () => {
    const g = farmWithStatue();
    expect(g.nav.isFree(FARM_BUS_STOP.x, FARM_BUS_STOP.z)).toBe(true);
    const r = boxRect(FARM_BUS_STOP);
    for (const z of g.state.interact) {
      if (z.id === "bus") continue;
      expect(overlap(r, z.rect), z.id).toBe(false);
    }
  });

  it("the city's stop, office and first counter can be reached on foot", () => {
    const g = inCity();
    expect(g.nav.isFree(CITY_BUS_STOP.x, CITY_BUS_STOP.z)).toBe(true);
    expect(g.nav.findPath(CITY_BUS_STOP.x, CITY_BUS_STOP.z, CITY_OFFICE.door.x, CITY_OFFICE.door.z)).not.toBeNull();
    const shop = shopById("lavka");
    expect(walkTo(g, shop.till.x, shop.till.z)).toBe(true);
    expect(walkTo(g, shop.cash.x, shop.cash.z)).toBe(true);
    expect(walkTo(g, CITY_OFFICE.door.x, CITY_OFFICE.door.z)).toBe(true);
  });
});

describe("fixes from the review", () => {
  it("the penny is not counted twice in offline income", () => {
    const g = inCity();
    g.state.penny.rate = 1;
    g.state.penny.t = 0.1;
    run(g, 60);
    // Paid, but not as the businesses' own income.
    expect(g.state.autoIncome.rate).toBe(0);
  });

  it("couriers take only what the business sells", () => {
    const g = inCity();
    const st = g.state;
    completeAll(g, ["goods_lavka_egg", "hire_cash_lavka", "hire_c_l_bread", "goods_lavka_milk", "hire_c_l_egg", "hire_coll_lavka", "hire_c_l_milk", "zone_c_cafe", "goods_cafe_juice", "hire_cash_cafe", "goods_cafe_cheese", "hire_c_c_juice", "hire_c_c_cheese", "build_coffee", "hire_c_c_milk", "hire_c_c_latte", "hire_coll_cafe", "build_sandwich", "hire_c_c_bread", "hire_c_c_ch2", "hire_c_c_sand", "zone_c_pizza", "goods_pizza_juice", "hire_cash_pizza", "goods_pizza_sauce", "hire_c_p_juice", "hire_c_p_sauce", "build_oven", "hire_c_p_flour", "hire_c_p_sauce2", "hire_c_p_cheese", "hire_c_p_pizza", "hire_coll_pizza", "delivery_pizza"]);
    const box = g.shop("pizza")!.def.delivery!;
    st.player.stack = ["bread", "bread", "pizza"];
    st.player.x = box.x;
    st.player.z = box.z;
    run(g, 2);
    expect(st.player.stack).toEqual(["bread", "bread"]);
    expect(st.stats.delivered).toBe(1);
  });

  it("the whistle's rest and a waiting merchant survive a reload in town", () => {
    const g = inCity();
    g.completePad(g.pad("goods_lavka_egg")!);
    g.completePad(g.pad("hire_cash_lavka")!);
    run(g, 2);
    expect(g.whistle()).toBe(true);
    g.state.surprises.merchantIn = 0;
    run(g, 3);
    const m = g.state.surprises.merchant;
    expect(m).not.toBeNull();
    const h = loadGame(JSON.parse(JSON.stringify(serializeGame(g))));
    expect(h.state.surprises.whistleCd).toBeGreaterThan(100);
    expect(h.canWhistle()).toBe(false);
    expect(h.state.surprises.merchant?.item).toBe(m!.item);
  });

  it("goods in customers' hands go back on the counter on a reload", () => {
    const g = inCity();
    const shop = g.state.city!.shops[0];
    shop.shelves[0].count = 10;
    run(g, 40);
    const held = g.state.city!.customers.filter((c) => c.cphase !== "none" && !c.bag).reduce((n, c) => n + c.stack.length, 0);
    expect(held).toBeGreaterThan(0);
    const before = shop.shelves[0].count;
    const h = loadGame(JSON.parse(JSON.stringify(serializeGame(g))));
    expect(h.state.city!.shops[0].shelves[0].count).toBe(before + held);
  });
});

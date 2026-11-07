/** Factories for the city: its state when you first step off the bus. */
import { BLOGGER_FIRST, CITY_PADS, CITY_SPAWN, CITY_START_MACHINES, CITY_START_MONEY, CITY_START_SHELVES, SHOPS, VAN_FAR, shelfById, shopById, vanLoad, type ShelfDef, type ShopDef, type TableDef } from "../data/city";
import { machineById, type ZoneId } from "../data/layout";
import type { CityState, Customer, GameState, ShelfState, ShopState, TableState, Van } from "./types";
import { applyStats, baseActor, createInitialState, createMachine, createPads } from "./world";

export const CUSTOMER_POOL = 84;

export function createCustomer(i: number): Customer {
  return {
    ...baseActor(`cust_${i}`, 0, 0),
    capacity: 6,
    speed: 2.2,
    shop: null,
    cphase: "none",
    scale: 0,
    path: [],
    pathIdx: 0,
    want: [],
    patience: 0,
    t: 0,
    bill: 0,
    bag: false,
    dish: null,
    seat: null,
  };
}

export function createVan(def: ShopDef): Van {
  return { phase: "away", t: 1.5, x: def.bay + VAN_FAR, z: def.roadZ, level: 1, load: vanLoad(1), cd: 0 };
}

export function createShop(def: ShopDef): ShopState {
  return {
    id: def.id,
    def,
    level: 1,
    ads: 1,
    van: createVan(def),
    shelves: [],
    tables: [],
    cash: 0,
    bundles: 0,
    incomingCash: 0,
    queue: [],
    spawnT: 2,
    serveT: 0,
    cashier: false,
    collector: false,
    delivery: false,
    buzz: 0,
    pulse: 0,
  };
}

export const createShelf = (def: ShelfDef, fresh: boolean, count = 0): ShelfState => ({ id: def.id, def, count, incoming: 0, spawnT: fresh ? 0 : 9 });
export const createTable = (def: TableDef, fresh: boolean): TableState => ({ id: def.id, def, seats: [null, null], spawnT: fresh ? 0 : 9 });

/** The business on a plot, if that plot has one. */
export const shopForZone = (zone: ZoneId) => SHOPS.find((s) => s.zone === zone);

export function createCityData(): CityState {
  const lavka = createShop(shopById("lavka"));
  lavka.shelves = CITY_START_SHELVES.map((id) => createShelf(shelfById(id), false));
  return {
    shops: [lavka],
    customers: Array.from({ length: CUSTOMER_POOL }, (_, i) => createCustomer(i)),
    floors: 0,
    finished: false,
    bloggerIn: BLOGGER_FIRST,
    rushHour: false,
  };
}

/** A brand new city: one lavka, one counter, a little money. */
export function createCityState(): GameState {
  const st = createInitialState();
  st.world = "city";
  st.bus = true;
  st.city = createCityData();
  st.money = CITY_START_MONEY;
  st.zones = new Set<ZoneId>(["c_lavka"]);
  st.fields = [];
  st.machines = CITY_START_MACHINES.map((id) => {
    const m = createMachine(machineById(id), false);
    // A few crates already wait on the pavement.
    m.output = 10;
    return m;
  });
  st.pads = createPads(CITY_PADS);
  st.player.x = CITY_SPAWN.x;
  st.player.z = CITY_SPAWN.z;
  st.player.facing = Math.PI;
  // You have carried a thing or two by now.
  st.playerLevels.capacity = 3;
  st.playerLevels.speed = 3;
  st.tutorial = 0;
  // The city has no market board.
  st.orderCooldown = Infinity;
  applyStats(st);
  return st;
}

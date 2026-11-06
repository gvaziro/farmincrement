"use client";

import { useMemo } from "react";
import { CUSTOMER_POOL } from "@/game/engine/city";
import type { Customer } from "@/game/engine/types";
import type { Runtime } from "@/runtime/runtime";
import { Character } from "../Characters";
import { Bag, makeLook } from "../Customers";

/** The city's customers: a pool of characters, one per slot in the engine. */
export function CityCustomers({ runtime }: { runtime: Runtime }) {
  const slots = useMemo(() => Array.from({ length: CUSTOMER_POOL }, (_, i) => ({ i, look: makeLook(i) })), []);
  const get = (i: number): Customer | undefined => runtime.game.state.city?.customers[i];
  return (
    <group>
      {slots.map(({ i, look }) => (
        <Character
          key={i}
          get={() => get(i)}
          look={look}
          scaleOf={() => {
            const c = get(i);
            return c && c.cphase !== "none" ? c.scale : 0;
          }}
          busy={() => get(i)?.cphase === "eat"}
          hand={<Bag has={() => !!get(i)?.bag && get(i)?.cphase !== "none"} />}
        />
      ))}
    </group>
  );
}

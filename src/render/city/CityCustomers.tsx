"use client";

import { useMemo } from "react";
import { CUSTOMER_POOL } from "@/game/engine/city";
import type { Runtime } from "@/runtime/runtime";
import { Crowd } from "../Crowd";
import { makeLook } from "../Customers";

/** The city's customers: one look per pool slot, drawn as part of an instanced crowd. */
export function CityCustomers({ runtime }: { runtime: Runtime }) {
  const looks = useMemo(() => Array.from({ length: CUSTOMER_POOL }, (_, i) => makeLook(i)), []);
  return (
    <Crowd
      runtime={runtime}
      collect={(out) => {
        const list = runtime.game.state.city?.customers;
        if (!list) return;
        list.forEach((c, i) => {
          if (c.cphase === "none") return;
          out.push({ actor: c, look: looks[i % looks.length], scale: c.scale, working: c.cphase === "eat", frame: false, bag: c.bag });
        });
      }}
    />
  );
}

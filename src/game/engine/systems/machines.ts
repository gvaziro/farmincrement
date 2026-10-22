import { OPERATOR_BOOST, machineCapacity, machineSpeedMult } from "../../data/balance";
import { ITEMS } from "../../data/items";
import { inputSlot } from "../anchors";
import type { Game } from "../Game";
import type { Machine } from "../types";

export const machineSpeed = (m: Machine) => machineSpeedMult(m.level) * (m.operator ? OPERATOR_BOOST : 1);
/** Seconds per produced item at the current level. */
export const machineCycle = (m: Machine) => m.type.time / machineSpeed(m);

export function updateMachines(game: Game, dt: number) {
  for (const m of game.state.machines) {
    m.spawnT += dt;
    m.pulse = Math.max(0, m.pulse - dt * 3);
    if (m.spawnT < 0.6) continue;
    let budget = dt;
    // A loop so very fast machines can finish several cycles per frame.
    for (let guard = 0; guard < 4 && budget > 0; guard++) {
      if (!m.working && !tryStart(game, m)) break;
      const need = (1 - m.progress) * machineCycle(m);
      if (budget < need) {
        m.progress += budget / machineCycle(m);
        budget = 0;
      } else {
        budget -= need;
        finish(game, m);
      }
    }
  }
}

function tryStart(game: Game, m: Machine): boolean {
  const cap = machineCapacity(m.level);
  if (m.output + m.type.output.amount > cap) {
    m.idle = "output";
    return false;
  }
  for (const inp of m.type.inputs) {
    // Only consume items that have already landed on the pallet.
    const landed = (m.inputs[inp.item] ?? 0) - (m.incomingIn[inp.item] ?? 0);
    if (landed < inp.amount) {
      m.idle = "input";
      return false;
    }
  }
  const core = game.machineCore(m);
  for (const inp of m.type.inputs) {
    for (let k = 0; k < inp.amount; k++) {
      const n = (m.inputs[inp.item] ?? 0) - 1;
      m.inputs[inp.item] = n;
      const from = inputSlot(m, inp.item, n);
      game.flight(inp.item, from.x, from.y + ITEMS[inp.item].height / 2, from.z, { kind: "point", ...core }, 0.3, 0.9);
    }
  }
  m.working = true;
  m.progress = 0;
  m.idle = null;
  return true;
}

function finish(game: Game, m: Machine) {
  const item = m.type.output.item;
  const core = game.machineCore(m);
  for (let k = 0; k < m.type.output.amount; k++) {
    const slot = m.output;
    m.output++;
    m.incomingOut++;
    game.flight(item, core.x, core.y, core.z, { kind: "pileOut", machine: m.id, slot }, 0.34, 1.0);
  }
  m.produced++;
  m.working = false;
  m.progress = 0;
  m.pulse = 1;
  game.state.stats.produced++;
  game.emit({ type: "produce", machine: m.id, item });
}

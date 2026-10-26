import { OPERATOR_BOOST, machineCapacity, machineSpeedMult } from "../../data/balance";
import { ITEMS } from "../../data/items";
import { inputSlot } from "../anchors";
import type { Game } from "../Game";
import { WINTER_MACHINES } from "../../data/challenges";
import { hasChallenge } from "../challenges";
import { seasonMachineSpeed } from "../seasons";
import type { Machine } from "../types";

/** Speed multiplier from level, operator and the season (`boost`). */
export const machineSpeed = (m: Machine, boost = 1) => machineSpeedMult(m.level) * (m.operator ? OPERATOR_BOOST : 1) * boost;
/** Seconds per produced item at the current level. */
export const machineCycle = (m: Machine, boost = 1) => m.type.time / machineSpeed(m, boost);

export function updateMachines(game: Game, dt: number) {
  // Winter: warm workshops run faster.
  // "Вечная зима": the machines freeze instead of enjoying the winter bonus.
  const boost = hasChallenge(game.state, "winter") ? WINTER_MACHINES : seasonMachineSpeed(game.state.season);
  for (const m of game.state.machines) {
    m.spawnT += dt;
    m.pulse = Math.max(0, m.pulse - dt * 3);
    if (m.spawnT < 0.6) continue;
    let budget = dt;
    // A loop so very fast machines can finish several cycles per frame.
    for (let guard = 0; guard < 4 && budget > 0; guard++) {
      if (!m.working && !tryStart(game, m)) break;
      const cycle = machineCycle(m, boost);
      const need = (1 - m.progress) * cycle;
      if (budget < need) {
        m.progress += budget / cycle;
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
  const made = game.state.made;
  made[item] = (made[item] ?? 0) + m.type.output.amount;
  m.working = false;
  m.progress = 0;
  m.pulse = 1;
  game.state.stats.produced++;
  game.emit({ type: "produce", machine: m.id, item });
}

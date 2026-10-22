/**
 * Navigation grid + A* for workers. The grid covers the whole map; a cell is
 * walkable when it lies on unlocked land and outside every building.
 */
import type { Rect } from "../core/math";
import { MAP_BOUNDS } from "../data/layout";
import type { PathPoint } from "./types";

export const NAV_CELL = 0.5;
const AGENT_RADIUS = 0.4;

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly minX = MAP_BOUNDS.minX;
  readonly minZ = MAP_BOUNDS.minZ;
  private blocked: Uint8Array;
  // A* scratch buffers, reused between searches.
  private g: Float32Array;
  private from: Int32Array;
  private stamp: Uint32Array;
  private closed: Uint32Array;
  private search = 0;
  private heap: Int32Array;
  private heapF: Float32Array;
  private heapSize = 0;

  constructor() {
    this.cols = Math.ceil((MAP_BOUNDS.maxX - MAP_BOUNDS.minX) / NAV_CELL);
    this.rows = Math.ceil((MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) / NAV_CELL);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.heap = new Int32Array(n * 2);
    this.heapF = new Float32Array(n * 2);
  }

  /** Rebuild from the walkability predicate and building footprints. */
  rebuild(isLand: (x: number, z: number, r: number) => boolean, obstacles: readonly Rect[]) {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.minX + (c + 0.5) * NAV_CELL;
        const z = this.minZ + (r + 0.5) * NAV_CELL;
        let b = isLand(x, z, AGENT_RADIUS) ? 0 : 1;
        if (!b) {
          for (const o of obstacles) {
            if (Math.abs(x - o.x) < o.hw + AGENT_RADIUS && Math.abs(z - o.z) < o.hd + AGENT_RADIUS) {
              b = 1;
              break;
            }
          }
        }
        this.blocked[r * this.cols + c] = b;
      }
    }
  }

  cellOf(x: number, z: number) {
    const c = Math.floor((x - this.minX) / NAV_CELL);
    const r = Math.floor((z - this.minZ) / NAV_CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  isFree(x: number, z: number) {
    const i = this.cellOf(x, z);
    return i >= 0 && this.blocked[i] === 0;
  }

  private center(i: number): PathPoint {
    const c = i % this.cols;
    const r = (i - c) / this.cols;
    return { x: this.minX + (c + 0.5) * NAV_CELL, z: this.minZ + (r + 0.5) * NAV_CELL };
  }

  /** Nearest free cell to (x,z) by expanding rings. */
  private nearestFree(x: number, z: number): number {
    const start = this.cellOf(x, z);
    if (start >= 0 && !this.blocked[start]) return start;
    const c0 = Math.floor((x - this.minX) / NAV_CELL);
    const r0 = Math.floor((z - this.minZ) / NAV_CELL);
    for (let rad = 1; rad < 40; rad++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (this.blocked[i]) continue;
          const d = dc * dc + dr * dr;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Straight walkable line between two points (sampled every quarter cell). */
  lineFree(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (NAV_CELL * 0.4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!this.isFree(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  }

  /** A* path from a to b, smoothed. Returns null when unreachable. */
  findPath(ax: number, az: number, bx: number, bz: number): PathPoint[] | null {
    if (this.lineFree(ax, az, bx, bz) && this.isFree(bx, bz)) return [{ x: bx, z: bz }];
    const start = this.nearestFree(ax, az);
    const goal = this.nearestFree(bx, bz);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [{ x: bx, z: bz }];

    const id = ++this.search;
    const cols = this.cols;
    const gc = goal % cols;
    const gr = (goal - gc) / cols;
    const h = (i: number) => {
      const c = i % cols;
      const r = (i - c) / cols;
      const dx = Math.abs(c - gc);
      const dz = Math.abs(r - gr);
      return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * NAV_CELL;
    };

    this.heapSize = 0;
    this.stamp[start] = id;
    this.g[start] = 0;
    this.from[start] = -1;
    this.push(start, h(start));

    let found = false;
    while (this.heapSize > 0) {
      const cur = this.pop();
      if (cur === goal) {
        found = true;
        break;
      }
      if (this.closed[cur] === id) continue;
      this.closed[cur] = id;
      const cc = cur % cols;
      const cr = (cur - cc) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
          const ni = nr * cols + nc;
          if (this.blocked[ni] || this.closed[ni] === id) continue;
          // no corner cutting
          if (dr && dc && (this.blocked[cr * cols + nc] || this.blocked[nr * cols + cc])) continue;
          const ng = this.g[cur] + (dr && dc ? Math.SQRT2 : 1) * NAV_CELL;
          if (this.stamp[ni] !== id || ng < this.g[ni]) {
            this.stamp[ni] = id;
            this.g[ni] = ng;
            this.from[ni] = cur;
            this.push(ni, ng + h(ni));
          }
        }
      }
    }
    if (!found) return null;

    const raw: PathPoint[] = [];
    for (let i = goal; i !== -1 && raw.length < 4000; i = this.from[i]) raw.push(this.center(i));
    raw.reverse();
    raw[raw.length - 1] = { x: bx, z: bz };

    // String-pulling: keep only the points needed for line of sight.
    const out: PathPoint[] = [];
    let anchor = { x: ax, z: az };
    let k = 0;
    while (k < raw.length) {
      let far = k;
      while (far + 1 < raw.length && this.lineFree(anchor.x, anchor.z, raw[far + 1].x, raw[far + 1].z)) far++;
      out.push(raw[far]);
      anchor = raw[far];
      k = far + 1;
    }
    return out;
  }

  private push(i: number, f: number) {
    if (this.heapSize >= this.heap.length) return;
    let n = this.heapSize++;
    this.heap[n] = i;
    this.heapF[n] = f;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (this.heapF[p] <= this.heapF[n]) break;
      this.swap(n, p);
      n = p;
    }
  }

  private pop() {
    const top = this.heap[0];
    const last = --this.heapSize;
    this.heap[0] = this.heap[last];
    this.heapF[0] = this.heapF[last];
    let n = 0;
    for (;;) {
      const l = n * 2 + 1;
      const r = l + 1;
      let m = n;
      if (l < this.heapSize && this.heapF[l] < this.heapF[m]) m = l;
      if (r < this.heapSize && this.heapF[r] < this.heapF[m]) m = r;
      if (m === n) break;
      this.swap(n, m);
      n = m;
    }
    return top;
  }

  private swap(a: number, b: number) {
    const ti = this.heap[a];
    this.heap[a] = this.heap[b];
    this.heap[b] = ti;
    const tf = this.heapF[a];
    this.heapF[a] = this.heapF[b];
    this.heapF[b] = tf;
  }
}

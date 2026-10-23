/**
 * Purely visual effects driven by game events: particles (chaff, confetti,
 * coins, smoke, dust) and floating texts. Lives outside React.
 */
import { Color } from "three";

export type ParticleKind = 0 | 1; // 0 = chunk (box), 1 = puff (blob)

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: Color;
  gravity: number;
  drag: number;
  spin: number;
  kind: ParticleKind;
  grow: number;
}

export type TextKind = "money" | "level" | "max" | "info" | "big";

export interface FloatText {
  id: number;
  text: string;
  x: number;
  y: number;
  z: number;
  t: number;
  dur: number;
  kind: TextKind;
}

const MAX_PARTICLES = 1400;
const CONFETTI = ["#ff5d73", "#ffd23f", "#3fa7ff", "#4fd16b", "#b06cff", "#ff9f1c"];
const tmpColor = new Color();

class Fx {
  particles: Particle[] = [];
  texts: FloatText[] = [];
  /** Camera shake amount, decays over time. */
  shake = 0;
  private textId = 0;
  private pool: Particle[] = [];

  private spawn(kind: ParticleKind, x: number, y: number, z: number, color: string | Color): Particle {
    let p = this.pool.pop();
    if (!p) {
      p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, color: new Color(), gravity: 9, drag: 0, spin: 0, kind: 0, grow: 0 };
    }
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.z = z;
    p.life = 0;
    p.grow = 0;
    if (typeof color === "string") p.color.set(color);
    else p.color.copy(color);
    if (this.particles.length >= MAX_PARTICLES) this.pool.push(this.particles.shift()!);
    this.particles.push(p);
    return p;
  }

  /** Small chunks flying out (harvest chaff, item pops). */
  burst(x: number, y: number, z: number, color: string, count = 6, speed = 2.6, size = 0.09) {
    for (let i = 0; i < count; i++) {
      const p = this.spawn(0, x, y, z, color);
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random() * 0.7);
      p.vx = Math.cos(a) * s * 0.6;
      p.vz = Math.sin(a) * s * 0.6;
      p.vy = s * (0.8 + Math.random() * 0.6);
      p.max = 0.45 + Math.random() * 0.35;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.gravity = 11;
      p.drag = 1.5;
      p.spin = (Math.random() - 0.5) * 18;
    }
  }

  confetti(x: number, y: number, z: number, count = 46, colors: readonly string[] = CONFETTI) {
    for (let i = 0; i < count; i++) {
      const p = this.spawn(0, x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, colors[i % colors.length]);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 4.5;
      p.vx = Math.cos(a) * s * 0.55;
      p.vz = Math.sin(a) * s * 0.55;
      p.vy = 4 + Math.random() * 5;
      p.max = 1.3 + Math.random() * 0.9;
      p.size = 0.09 + Math.random() * 0.07;
      p.gravity = 7;
      p.drag = 2.2;
      p.spin = (Math.random() - 0.5) * 22;
    }
  }

  coins(x: number, y: number, z: number, count = 4) {
    tmpColor.set("#ffcc33");
    for (let i = 0; i < count; i++) {
      const p = this.spawn(0, x, y, z, tmpColor);
      const a = Math.random() * Math.PI * 2;
      const s = 1.6 + Math.random() * 1.6;
      p.vx = Math.cos(a) * s * 0.5;
      p.vz = Math.sin(a) * s * 0.5;
      p.vy = 3 + Math.random() * 2.5;
      p.max = 0.6 + Math.random() * 0.3;
      p.size = 0.13;
      p.gravity = 12;
      p.drag = 1;
      p.spin = (Math.random() - 0.5) * 20;
    }
  }

  smoke(x: number, y: number, z: number, color = "#f4f1ea", size = 0.32) {
    const p = this.spawn(1, x + (Math.random() - 0.5) * 0.15, y, z + (Math.random() - 0.5) * 0.15, color);
    p.vx = 0.25 + Math.random() * 0.2;
    p.vz = (Math.random() - 0.5) * 0.2;
    p.vy = 0.9 + Math.random() * 0.4;
    p.max = 1.6 + Math.random() * 0.6;
    p.size = size;
    p.gravity = 0;
    p.drag = 0.4;
    p.spin = 0;
    p.grow = 1.2;
  }

  dust(x: number, z: number) {
    const p = this.spawn(1, x + (Math.random() - 0.5) * 0.2, 0.08, z + (Math.random() - 0.5) * 0.2, "#e8dcc0");
    p.vx = (Math.random() - 0.5) * 0.5;
    p.vz = (Math.random() - 0.5) * 0.5;
    p.vy = 0.35;
    p.max = 0.45;
    p.size = 0.13;
    p.gravity = 0;
    p.drag = 2;
    p.spin = 0;
    p.grow = 0.6;
  }

  /** A raindrop hitting the ground. */
  splash(x: number, z: number) {
    const p = this.spawn(1, x, 0.06, z, "#cfe3f5");
    p.vx = 0;
    p.vz = 0;
    p.vy = 0.4;
    p.max = 0.28;
    p.size = 0.06;
    p.gravity = 0;
    p.drag = 4;
    p.spin = 0;
    p.grow = 2.2;
  }

  /** Ring of puffs — something appeared / was hired. */
  poof(x: number, z: number, radius = 1.2, color = "#ffffff") {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const p = this.spawn(1, x + Math.cos(a) * radius * 0.4, 0.25, z + Math.sin(a) * radius * 0.4, color);
      p.vx = Math.cos(a) * radius * 1.6;
      p.vz = Math.sin(a) * radius * 1.6;
      p.vy = 0.6 + Math.random() * 0.4;
      p.max = 0.7 + Math.random() * 0.2;
      p.size = 0.35;
      p.gravity = 0;
      p.drag = 3.5;
      p.spin = 0;
      p.grow = 0.5;
    }
  }

  text(text: string, x: number, y: number, z: number, kind: TextKind = "money") {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ id: ++this.textId, text, x, y, z, t: 0, dur: kind === "big" ? 2.4 : kind === "max" ? 0.9 : 1.15, kind });
  }

  update(dt: number) {
    const ps = this.particles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        this.pool.push(p);
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag - p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.03 && p.kind === 0) {
        p.y = 0.03;
        p.vy *= -0.35;
        p.vx *= 0.6;
        p.vz *= 0.6;
      }
      ps[w++] = p;
    }
    ps.length = w;

    const ts = this.texts;
    let k = 0;
    for (let i = 0; i < ts.length; i++) {
      ts[i].t += dt;
      if (ts[i].t < ts[i].dur) ts[k++] = ts[i];
    }
    ts.length = k;
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  reset() {
    this.particles.length = 0;
    this.texts.length = 0;
  }
}

export const fx = new Fx();

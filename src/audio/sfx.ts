/**
 * Synthesised sound effects — no audio files. Every sound is a couple of
 * oscillators / noise bursts with short envelopes. Rate-limited per sound so
 * fast loops (selling 50 items) stay pleasant.
 */
import { Music } from "./music";

type SoundName = "pop" | "drop" | "pick" | "coin" | "tick" | "purchase" | "level" | "full" | "whoosh" | "ding" | "cash";

const MIN_GAP: Record<SoundName, number> = {
  pop: 0.035,
  drop: 0.04,
  pick: 0.04,
  coin: 0.045,
  tick: 0.05,
  purchase: 0.2,
  level: 0.2,
  full: 0.5,
  whoosh: 0.3,
  ding: 0.2,
  cash: 0.15,
};

class Sfx {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last = new Map<SoundName, number>();
  private combo = 0;
  private comboAt = 0;
  readonly music = new Music();
  soundOn = true;
  musicOn = true;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.music.attach(this.ctx);
      this.music.setEnabled(this.musicOn);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setSound(on: boolean) {
    this.soundOn = on;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.music.setEnabled(on);
  }

  suspend(hidden: boolean) {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  play(name: SoundName, intensity = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.soundOn || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const prev = this.last.get(name) ?? -1;
    if (now - prev < MIN_GAP[name]) return;
    this.last.set(name, now);
    switch (name) {
      case "pop": {
        // Pitch climbs while harvesting in a streak.
        if (now - this.comboAt > 0.45) this.combo = 0;
        this.comboAt = now;
        this.combo = Math.min(this.combo + 1, 14);
        const f = 520 * Math.pow(2, (this.combo % 15) / 24) * (0.97 + Math.random() * 0.06);
        this.tone("triangle", f, f * 0.55, 0.08, 0.16 * intensity);
        break;
      }
      case "drop":
        this.tone("triangle", 260, 150, 0.07, 0.16);
        break;
      case "pick":
        this.tone("triangle", 380, 620, 0.07, 0.12);
        break;
      case "coin":
        this.tone("square", 1318, 1318, 0.05, 0.035);
        this.tone("square", 1760, 1760, 0.09, 0.035, 0.045);
        break;
      case "cash":
        this.tone("triangle", 988, 988, 0.06, 0.09);
        this.tone("triangle", 1318, 1318, 0.08, 0.09, 0.06);
        this.tone("triangle", 1976, 1976, 0.14, 0.07, 0.12);
        break;
      case "tick":
        this.tone("square", 900 + intensity * 700, 900 + intensity * 700, 0.025, 0.03);
        break;
      case "purchase": {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, i) => this.tone("triangle", n, n, 0.16, 0.13, i * 0.07));
        this.burst(0.25, 0.08, 2400, 0.28);
        break;
      }
      case "level":
        this.tone("sine", 880, 880, 0.6, 0.12);
        this.tone("sine", 1320, 1320, 0.7, 0.08, 0.08);
        this.tone("sine", 1760, 1760, 0.8, 0.05, 0.16);
        break;
      case "full":
        this.tone("square", 190, 150, 0.14, 0.05);
        break;
      case "whoosh":
        this.burst(0.6, 0.12, 900, 0);
        break;
      case "ding":
        this.tone("sine", 1046.5, 1046.5, 0.45, 0.1);
        this.tone("sine", 1568, 1568, 0.5, 0.05, 0.05);
        break;
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, gain: number, freq: number, delay: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq * 0.4, t);
    filter.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.6);
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfxBus!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}

export const sfx = new Sfx();

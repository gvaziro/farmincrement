/**
 * Synthesised sound effects — no audio files. Every sound is a couple of
 * oscillators / noise bursts with short envelopes. Rate-limited per sound so
 * fast loops (selling 50 items) stay pleasant.
 */
import type { SeasonId } from "@/game/engine/seasons";
import type { WeatherKind } from "@/game/engine/weather";
import { Music } from "./music";

type SoundName =
  | "pop"
  | "drop"
  | "pick"
  | "coin"
  | "tick"
  | "purchase"
  | "level"
  | "full"
  | "whoosh"
  | "ding"
  | "cash"
  | "season"
  | "golden"
  | "find"
  | "bell"
  | "whistle"
  | "cluck"
  | "moo"
  | "baa";

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
  season: 1,
  golden: 0.4,
  find: 0.4,
  bell: 0.6,
  whistle: 0.6,
  cluck: 0.5,
  moo: 0.8,
  baa: 0.7,
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
  private volume = 1;
  /** Silenced on purpose: the tab is hidden or another tab is playing. */
  private held = false;

  /**
   * Called on every user gesture: browsers let sound start only inside one.
   * Does nothing once it plays, or while it is held.
   */
  unlock() {
    if (this.held) return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.55 * this.volume;
      this.sfxBus.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.music.attach(this.ctx);
      this.music.setEnabled(this.musicOn);
    }
    const ctx = this.ctx;
    // "suspended" until a gesture lets it start; iOS also parks it "interrupted"
    // (a call, Siri, the app sent to the background).
    if (ctx.state === "running" || ctx.state === "closed") return;
    ctx.resume().catch(() => {});
    // Older iOS only starts the sound once something plays inside the gesture.
    const blank = ctx.createBufferSource();
    blank.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blank.connect(ctx.destination);
    blank.start();
  }

  setSound(on: boolean) {
    this.soundOn = on;
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    this.music.setEnabled(on);
  }

  /** Volumes 0 … 1 (on top of the on/off switches). */
  setVolume(sound: number, music: number) {
    this.volume = sound;
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(0.55 * sound, this.ctx.currentTime, 0.05);
    this.music.setVolume(music);
  }

  private chirpIn = 0;
  private birdIn = 3;
  private windIn = 2;

  /**
   * Called every frame with the night level (0 … 1) and the season: crickets
   * at night, birds on spring and summer days, wind gusts in winter.
   */
  ambient(dt: number, night: number, season: SeasonId, weather: WeatherKind, rain: number) {
    this.music.setMood(night);
    this.setRain(rain);
    const ctx = this.ctx;
    if (!ctx || !this.soundOn || ctx.state !== "running") return;
    if (night >= 0.6 && season !== "winter") {
      this.chirpIn -= dt;
      if (this.chirpIn <= 0) {
        this.chirpIn = 0.45 + Math.random() * 1.7;
        this.chirp();
      }
    }
    if (night < 0.3 && weather === "clear" && (season === "spring" || season === "summer")) {
      this.birdIn -= dt;
      if (this.birdIn <= 0) {
        this.birdIn = 2.5 + Math.random() * 5;
        this.bird();
      }
    }
    if (season === "winter" || weather === "snow") {
      this.windIn -= dt;
      if (this.windIn <= 0) {
        this.windIn = weather === "snow" ? 2.5 + Math.random() * 3 : 5 + Math.random() * 6;
        this.wind();
      }
    }
  }

  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainLevel = 0;

  /** Steady rain hiss (0 … 1); the source only exists while it rains. */
  private setRain(k: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const target = this.soundOn && ctx.state === "running" && k > 0.02 ? k * 0.1 : 0;
    // Small changes are not worth an automation event — but reaching zero
    // always is: that is what stops the source.
    if (target === this.rainLevel || (target > 0 && Math.abs(target - this.rainLevel) < 0.002)) return;
    this.rainLevel = target;
    if (target > 0 && !this.rainSrc) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 600;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3200;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(hp).connect(lp).connect(g).connect(this.sfxBus!);
      src.start();
      this.rainSrc = src;
      this.rainGain = g;
    }
    if (!this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(target, ctx.currentTime, 0.5);
    if (target === 0) {
      const src = this.rainSrc;
      this.rainSrc = null;
      this.rainGain = null;
      src?.stop(ctx.currentTime + 2.5);
    }
  }

  /** A songbird: two or three quick warbling sweeps. */
  private bird() {
    const ctx = this.ctx!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.sfxBus!);
    const base = 2300 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      const t = ctx.currentTime + 0.02 + i * (0.09 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      const f = base * (0.9 + Math.random() * 0.3);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.028, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(g).connect(pan);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  /** A soft winter gust: slow swell of low-passed noise. */
  private wind() {
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.05;
    const dur = 2.6 + Math.random() * 1.6;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.linearRampToValueAtTime(520 + Math.random() * 300, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(280, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(filter).connect(g).connect(this.sfxBus!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** A cricket: a few quick high pulses, panned randomly. */
  private chirp() {
    const ctx = this.ctx!;
    const t0 = ctx.currentTime + 0.02;
    const f = 4200 + Math.random() * 700;
    const pulses = 2 + Math.floor(Math.random() * 3);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.sfxBus!);
    for (let i = 0; i < pulses; i++) {
      const t = t0 + i * 0.075;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.02, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(g).connect(pan);
      osc.start(t);
      osc.stop(t + 0.07);
    }
  }

  /** Hold the sound while the tab is hidden or blocked by another tab. */
  suspend(hold: boolean) {
    this.held = hold;
    if (!this.ctx) return;
    if (hold) this.ctx.suspend().catch(() => {});
    else this.ctx.resume().catch(() => {});
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
      case "season":
        // A gentle rising chime: a new season has come.
        [659.25, 783.99, 987.77, 1318.5, 1567.98].forEach((n, i) => this.tone("sine", n, n, 0.9, 0.07, i * 0.11));
        this.burst(0.9, 0.04, 5200, 0.3);
        break;
      case "golden":
        // A shimmering run up (softer when the plant just appeared).
        [1318.5, 1568, 1975.5, 2637].forEach((n, i) => this.tone("sine", n, n, 0.38, 0.065 * intensity, i * 0.06));
        this.burst(0.5, 0.035 * intensity, 6400, 0.05);
        break;
      case "find":
        [1046.5, 1318.5, 1568, 2093].forEach((n, i) => this.tone("triangle", n, n, 0.3, 0.08, i * 0.08));
        this.tone("sine", 3136, 3136, 0.7, 0.04, 0.34);
        break;
      case "bell":
        // Ding-ding: the merchant's hand bell.
        for (const d of [0, 0.22]) {
          this.tone("sine", 1760, 1760, 0.7, 0.08, d);
          this.tone("sine", 4400, 4400, 0.35, 0.025, d);
        }
        break;
      case "whistle":
        this.whistleTone(0);
        this.whistleTone(0.3);
        break;
      case "cluck":
        [0, 0.12, 0.21].forEach((d, i) => this.tone("square", 640 - i * 50, 380, 0.07, 0.035, d));
        break;
      case "moo":
        this.voice(210, 150, 0.8, 0.08, 650);
        break;
      case "baa":
        this.voice(440, 390, 0.55, 0.05, 1500, 15);
        break;
    }
  }

  /** A pea whistle: a high sine with a fast trill, sliding up. */
  private whistleTone(delay: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2100, t);
    osc.frequency.linearRampToValueAtTime(2500, t + 0.2);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 38;
    const depth = ctx.createGain();
    depth.gain.value = 90;
    lfo.connect(depth).connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.02);
    g.gain.setValueAtTime(0.06, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g).connect(this.sfxBus!);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.27);
    lfo.stop(t + 0.27);
  }

  /** An animal's voice: a low-passed sawtooth gliding down, bleating if `tremolo` is set. */
  private voice(f0: number, f1: number, dur: number, gain: number, cutoff: number, tremolo = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.06);
    g.gain.setValueAtTime(gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (tremolo) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = tremolo;
      const d = ctx.createGain();
      d.gain.value = gain * 0.6;
      lfo.connect(d).connect(g.gain);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    osc.connect(lp).connect(g).connect(this.sfxBus!);
    osc.start(t);
    osc.stop(t + dur + 0.05);
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

/**
 * Events that may start the sound. On touch screens only the end of a tap
 * counts as a gesture (pointerup / touchend) — pointerdown does not.
 */
const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;

/**
 * Unlock the sound on every user gesture; returns the cleanup. Capture phase,
 * so panels that stop the event can't swallow it.
 */
export function unlockOnGestures(target: EventTarget) {
  const unlock = () => sfx.unlock();
  const capture = { capture: true };
  for (const type of GESTURES) target.addEventListener(type, unlock, capture);
  return () => {
    for (const type of GESTURES) target.removeEventListener(type, unlock, capture);
  };
}

/**
 * Generative cozy background music: soft pads on a I–vi–IV–V loop, a plucky
 * pentatonic melody doing a random walk, a gentle bass and a whisper of hats.
 */
const BPM = 92;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD = 0.3;

const CHORDS = [
  { root: 65.41, tones: [130.81, 164.81, 196.0] }, // C
  { root: 55.0, tones: [110.0, 130.81, 164.81] }, // Am
  { root: 43.65, tones: [87.31, 110.0, 130.81] }, // F
  { root: 49.0, tones: [98.0, 123.47, 146.83] }, // G
];
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
/** Scale indices that sound good on top of each chord. */
const CHORD_TONES = [
  [0, 2, 3, 5, 7, 8],
  [0, 2, 4, 5, 7, 9],
  [0, 4, 5, 9],
  [1, 3, 6, 8],
];

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private step = 0;
  private note = 5;
  private enabled = false;
  private lp: BiquadFilterNode | null = null;
  /** 0 = day, 1 = night: fewer, softer notes at night. */
  private night = 0;
  private volume = 1;

  attach(ctx: AudioContext) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;
    this.lp = lp;
    this.out.connect(lp).connect(ctx.destination);

    // Cheap reverb: convolver with a decaying noise impulse.
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv.buffer = ir;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.wet.connect(conv).connect(this.out);

    const nlen = ctx.sampleRate * 0.2;
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
  }

  /** Night makes the music sparser and darker (lower filter cutoff). */
  setMood(night: number) {
    if (Math.abs(night - this.night) < 0.01) return;
    this.night = night;
    if (this.lp && this.ctx) this.lp.frequency.setTargetAtTime(3200 - night * 1700, this.ctx.currentTime, 0.5);
  }

  /** 0 … 1 */
  setVolume(v: number) {
    if (Math.abs(v - this.volume) < 0.001) return;
    this.volume = v;
    const ctx = this.ctx;
    if (!ctx || !this.out || !this.enabled) return;
    this.out.gain.cancelScheduledValues(ctx.currentTime);
    this.out.gain.setTargetAtTime(0.17 * v, ctx.currentTime, 0.1);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const t = ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(on ? 0.17 * this.volume : 0, t + (on ? 2.5 : 0.6));
    if (on && !this.timer) {
      this.nextTime = t + 0.1;
      this.timer = setInterval(() => this.schedule(), 100);
    } else if (!on && this.timer) {
      const timer = this.timer;
      this.timer = null;
      setTimeout(() => {
        if (!this.enabled) clearInterval(timer);
        else this.timer = timer;
      }, 700);
    }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    if (this.nextTime < ctx.currentTime - 1) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step++;
    }
  }

  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 8);
    const inBar = step % 8;
    const chordIdx = Math.floor(bar / 2) % CHORDS.length;
    const chord = CHORDS[chordIdx];

    if (step % 16 === 0) for (const f of chord.tones) this.pad(f, t, STEP * 16);
    if (inBar === 0 || inBar === 4) this.bass(chord.root * (inBar === 4 ? 1.5 : 1), t);
    if (inBar % 2 === 1) this.hat(t);

    // Melody: breathe every fourth bar, denser on beats.
    if (bar % 4 === 3 && inBar > 2) return;
    const p = (inBar % 2 === 0 ? 0.55 : 0.28) * (1 - 0.45 * this.night);
    if (Math.random() > p) return;
    const good = CHORD_TONES[chordIdx];
    let next = this.note + Math.round((Math.random() - 0.5) * 4);
    next = Math.max(0, Math.min(SCALE.length - 1, next));
    if (inBar === 0 && !good.includes(next)) next = good.reduce((a, b) => (Math.abs(b - next) < Math.abs(a - next) ? b : a));
    this.note = next;
    this.pluck(SCALE[next], t, inBar % 2 === 0 ? 0.55 : 0.3);
  }

  private env(t: number, attack: number, peak: number, release: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    return g;
  }

  private pluck(f: number, t: number, len: number) {
    const ctx = this.ctx!;
    const g = this.env(t, 0.01, 0.22, len + 0.35);
    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.out!);
    g.connect(this.wet!);
    o1.start(t);
    o2.start(t);
    o1.stop(t + len + 0.5);
    o2.stop(t + len + 0.5);
  }

  private pad(f: number, t: number, len: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.8);
    g.gain.setValueAtTime(0.06, t + len - 0.6);
    g.gain.linearRampToValueAtTime(0, t + len + 0.4);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * 2;
      o.detune.value = detune;
      o.connect(g);
      o.start(t);
      o.stop(t + len + 0.5);
    }
    g.connect(this.out!);
    g.connect(this.wet!);
  }

  private bass(f: number, t: number) {
    const ctx = this.ctx!;
    const g = this.env(t, 0.02, 0.28, 0.5);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f * 2;
    o.connect(g).connect(this.out!);
    o.start(t);
    o.stop(t + 0.6);
  }

  private hat(t: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = this.env(t, 0.003, 0.025, 0.05);
    src.connect(hp).connect(g).connect(this.out!);
    src.start(t);
    src.stop(t + 0.08);
  }
}

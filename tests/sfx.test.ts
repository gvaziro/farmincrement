/** Sound on phones: browsers let it start only inside a user gesture. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** True while the browser counts the event being handled as a user gesture. */
let gesture = false;
let contexts: FakeContext[] = [];

const param = () => ({ value: 0, setTargetAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} });
const node = () => ({ gain: param(), frequency: param(), type: "", buffer: null as unknown, connect: <T>(n: T) => n });

/** An AudioContext with the strictest (iOS) rule: it starts only when resumed inside a gesture. */
class FakeContext {
  state = "suspended";
  readonly sampleRate = 8000;
  readonly currentTime = 0;
  readonly destination = node();
  /** Blank samples played to wake the sound, and whether each was inside a gesture. */
  readonly blanks: boolean[] = [];
  constructor() {
    contexts.push(this);
  }
  createGain = node;
  createBiquadFilter = node;
  createConvolver = node;
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    return { ...node(), start: () => this.blanks.push(gesture) };
  }
  async resume() {
    if (gesture) this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
}

/**
 * Fire an event the way a browser treats it. HTML spec: keydown, a mouse's
 * pointerdown, a finger's pointerup and touchend are gestures (and so, in
 * practice, is the click right after) — a finger's pointerdown is not.
 */
function fire(page: EventTarget, type: string, pointer: "mouse" | "touch" = "touch") {
  gesture = type === "keydown" || type === "touchend" || type === "click" || (type === "pointerdown" ? pointer === "mouse" : type === "pointerup" && pointer === "touch");
  page.dispatchEvent(new Event(type));
  gesture = false;
}

/** A fresh sound module listening on a fresh page. */
async function load() {
  vi.resetModules();
  const mod = await import("@/audio/sfx");
  mod.sfx.setMusic(false); // no music timer in tests
  const page = new EventTarget();
  const stop = mod.unlockOnGestures(page);
  return { sfx: mod.sfx, page, stop };
}

beforeEach(() => {
  contexts = [];
  vi.stubGlobal("window", { AudioContext: FakeContext });
});
afterEach(() => vi.unstubAllGlobals());

describe("sound on phones", () => {
  it("starts at the end of a tap — a finger going down is not a gesture yet", async () => {
    const { page } = await load();
    fire(page, "pointerdown");
    expect(contexts[0]?.state).toBe("suspended");
    fire(page, "pointerup");
    expect(contexts[0].state).toBe("running");
    expect(contexts).toHaveLength(1);
  });

  it("starts from any part of a tap's end, whichever the browser counts", async () => {
    for (const type of ["pointerup", "touchend", "click"]) {
      contexts = [];
      const { page } = await load();
      fire(page, type);
      expect(contexts[0]?.state, type).toBe("running");
    }
  });

  it("plays a blank sample inside the gesture: older iOS needs one to start", async () => {
    const { page } = await load();
    fire(page, "touchend");
    expect(contexts[0].blanks).toEqual([true]);
    fire(page, "touchend");
    expect(contexts[0].blanks).toEqual([true]); // already running: nothing more
  });

  it("starts at once from a mouse press or a key", async () => {
    for (const [type, pointer] of [["pointerdown", "mouse"], ["keydown", "mouse"]] as const) {
      contexts = [];
      const { page } = await load();
      fire(page, type, pointer);
      expect(contexts[0]?.state, type).toBe("running");
    }
  });

  it("comes back with the next tap after iOS interrupts it (a call, Siri)", async () => {
    const { page } = await load();
    fire(page, "touchend");
    contexts[0].state = "interrupted";
    fire(page, "touchend");
    expect(contexts[0].state).toBe("running");
  });

  it("goes quiet in a hidden tab and plays again by the next tap at the latest", async () => {
    const { sfx, page } = await load();
    fire(page, "touchend");
    sfx.suspend(true);
    expect(contexts[0].state).toBe("suspended");
    sfx.suspend(false);
    fire(page, "touchend");
    expect(contexts[0].state).toBe("running");
  });

  it("stays silent in a tab another one has taken over, even when tapped", async () => {
    const { sfx, page } = await load();
    sfx.suspend(true);
    fire(page, "touchend");
    expect(contexts).toHaveLength(0);
    sfx.suspend(false);
    fire(page, "touchend");
    sfx.suspend(true);
    fire(page, "touchend");
    expect(contexts[0].state).toBe("suspended");
  });

  it("stops listening on cleanup", async () => {
    const { page, stop } = await load();
    stop();
    fire(page, "touchend");
    expect(contexts).toHaveLength(0);
  });
});

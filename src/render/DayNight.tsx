"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Fog, Object3D, type DirectionalLight, type Group, type HemisphereLight, type InstancedMesh } from "three";
import { LAMPS } from "@/game/data/layout";
import { nightFactor, timeOfDay } from "@/game/engine/daycycle";
import type { Runtime } from "@/runtime/runtime";
import { useUI, type Quality } from "@/runtime/store";
import { input } from "@/ui/input";
import { G, Part } from "./kit";
import { fireflyMat, glowMat, lanternMat, setNight } from "./nightMaterials";
import { seasonVisual } from "./seasonLook";
import { weatherVisual } from "./Weather";
import { StaticBatch } from "./StaticBatch";

/** Lighting at a moment of the day. Interpolated between keyframes. */
interface Key {
  t: number;
  sky: string;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunI: number;
  /** Sun (or moon) offset from the camera target. */
  dir: [number, number, number];
}

const NIGHT: Omit<Key, "t"> = { sky: "#2e3f6e", hemiSky: "#8ea2e0", hemiGround: "#3d5a45", hemi: 1.0, sun: "#a8c0ff", sunI: 0.9, dir: [10, 22, 8] };
const DAY: Omit<Key, "t"> = { sky: "#bfe6ff", hemiSky: "#e9f6ff", hemiGround: "#7dbb5a", hemi: 1.55, sun: "#fff4e0", sunI: 2.35, dir: [4, 25, 11] };

const KEYS: Key[] = [
  { t: 0.0, ...NIGHT },
  { t: 0.03, sky: "#e8a6c0", hemiSky: "#ffd2de", hemiGround: "#6f8a62", hemi: 1.2, sun: "#ffb59a", sunI: 1.5, dir: [16, 13, 6] },
  { t: 0.08, sky: "#ffd9b3", hemiSky: "#fff0dc", hemiGround: "#86b05e", hemi: 1.45, sun: "#ffe2c0", sunI: 2.1, dir: [13, 18, 9] },
  { t: 0.16, ...DAY },
  { t: 0.62, ...DAY, dir: [-9, 24, 11] },
  { t: 0.72, sky: "#ffe0a8", hemiSky: "#fff0d0", hemiGround: "#96b45a", hemi: 1.5, sun: "#ffd08a", sunI: 2.25, dir: [-14, 17, 9] },
  { t: 0.79, sky: "#ffa77a", hemiSky: "#ffc9b0", hemiGround: "#8a8a55", hemi: 1.3, sun: "#ff9a5a", sunI: 1.75, dir: [-17, 13, 6] },
  { t: 0.84, sky: "#7d6fb0", hemiSky: "#b9a6e6", hemiGround: "#4f6650", hemi: 1.08, sun: "#c3b8ff", sunI: 1.0, dir: [-4, 18, 8] },
  { t: 0.88, ...NIGHT },
  { t: 1.0, ...NIGHT },
];

const parsed = KEYS.map((k) => ({
  ...k,
  skyC: new Color(k.sky),
  hemiSkyC: new Color(k.hemiSky),
  hemiGroundC: new Color(k.hemiGround),
  sunC: new Color(k.sun),
}));

const DAY_VIEW = 0.4;
const tmp = { sky: new Color(), hemiSky: new Color(), hemiGround: new Color(), sun: new Color() };

/** Daytime sky and ground bounce of each season (summer = the keyframes as they are). */
const SEASON_SKY = { spring: new Color("#ffe3ee"), autumn: new Color("#ffdcb0"), winter: new Color("#dde9f4") };
const SEASON_BOUNCE = { spring: new Color("#9fdc7a"), autumn: new Color("#b8a052"), winter: new Color("#e6eef6") };
/** Overcast skies: rain, fog, snowfall. */
const RAIN_SKY = new Color("#9aabbd");
const FOG_SKY = new Color("#dfe6eb");
const SNOW_SKY = new Color("#cdd7e0");

/** Sample the lighting keyframes at time of day `t`. */
function sample(t: number) {
  let i = 0;
  while (i < parsed.length - 2 && parsed[i + 1].t <= t) i++;
  const a = parsed[i];
  const b = parsed[i + 1];
  const k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  tmp.sky.lerpColors(a.skyC, b.skyC, k);
  tmp.hemiSky.lerpColors(a.hemiSkyC, b.hemiSkyC, k);
  tmp.hemiGround.lerpColors(a.hemiGroundC, b.hemiGroundC, k);
  tmp.sun.lerpColors(a.sunC, b.sunC, k);
  return {
    hemi: a.hemi + (b.hemi - a.hemi) * k,
    sunI: a.sunI + (b.sunI - a.sunI) * k,
    dx: a.dir[0] + (b.dir[0] - a.dir[0]) * k,
    dy: a.dir[1] + (b.dir[1] - a.dir[1]) * k,
    dz: a.dir[2] + (b.dir[2] - a.dir[2]) * k,
  };
}

/** Sun, sky and fog following the time of day. */
export function DayNightLights({ runtime, quality }: { runtime: Runtime; quality: Quality }) {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const enabled = useUI((s) => s.settings.dayNight);
  const size = quality === "high" ? 2048 : 1024;
  const fog = useMemo(() => new Fog("#bfe6ff", 55, 120), []);
  const bg = useMemo(() => new Color("#bfe6ff"), []);
  const lastZoom = useRef(0);

  useFrame(() => {
    const l = sun.current;
    const h = hemi.current;
    if (!l || !h) return;
    if (scene.fog !== fog) scene.fog = fog;
    if (scene.background !== bg) scene.background = bg;

    const t = enabled ? timeOfDay(runtime.game.state.dayClock) : DAY_VIEW;
    const s = sample(t);
    const night = enabled ? nightFactor(t) : 0;
    // Seasons tint the daytime sky and the light bouncing off the ground.
    const sv = seasonVisual;
    const day = 1 - night;
    tmp.sky.lerp(SEASON_SKY.spring, sv.spring * 0.25 * day).lerp(SEASON_SKY.autumn, sv.autumn * 0.3 * day).lerp(SEASON_SKY.winter, sv.winter * 0.55 * day);
    tmp.hemiGround.lerp(SEASON_BOUNCE.spring, sv.spring * 0.4).lerp(SEASON_BOUNCE.autumn, sv.autumn * 0.5).lerp(SEASON_BOUNCE.winter, sv.winter * 0.7);
    // Weather: grey skies, a dimmer sun, fog closing in.
    const wv = weatherVisual;
    tmp.sky.lerp(RAIN_SKY, wv.rain * 0.65 * day).lerp(SNOW_SKY, wv.snow * 0.5 * day).lerp(FOG_SKY, wv.fog * 0.8 * day);
    bg.copy(tmp.sky);
    fog.color.copy(tmp.sky);
    // Light enough that pads and fields stay readable through it.
    fog.near = 55 - 40 * wv.fog - 15 * wv.snow - 10 * wv.rain;
    fog.far = 120 - 62 * wv.fog - 35 * wv.snow - 25 * wv.rain;
    h.color.copy(tmp.hemiSky);
    h.groundColor.copy(tmp.hemiGround);
    h.intensity = s.hemi * (1 + sv.winter * 0.06) * (1 - wv.rain * 0.15);
    l.color.copy(tmp.sun);
    l.intensity = s.sunI * (1 - sv.winter * 0.08) * (1 - wv.rain * 0.5 - wv.snow * 0.35 - wv.fog * 0.3);
    setNight(night);

    // The light follows the player so shadows stay crisp; its direction
    // follows the sun, so shadows slowly turn during the day.
    const p = runtime.game.state.player;
    l.position.set(p.x + s.dx, s.dy, p.z + s.dz);
    l.target.position.set(p.x, 0, p.z - 2);
    l.target.updateMatrixWorld();
    const z = Math.round(input.zoom * 20) / 20;
    if (z !== lastZoom.current) {
      lastZoom.current = z;
      const cam = l.shadow.camera;
      cam.left = -22 * z;
      cam.right = 22 * z;
      cam.top = 19 * z;
      cam.bottom = -19 * z;
      cam.updateProjectionMatrix();
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#e9f6ff", "#7dbb5a", 1.55]} />
      <directionalLight
        ref={sun}
        color="#fff4e0"
        intensity={2.35}
        castShadow={quality !== "low"}
        shadow-mapSize={[size, size]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={80}
      />
    </>
  );
}

// ── lamps ───────────────────────────────────────────────────────────────
/** Lamp posts along the paths: lanterns glow and light up the ground at night. */
export function Lamps() {
  return (
    <group>
      <StaticBatch>
        {LAMPS.map((l, i) => (
          <group key={i} position={[l.x, 0, l.z]}>
            <Part g={G.cyl(0.16, 0.2, 0.18, 6)} c="#6f6a64" position={[0, 0.09, 0]} />
            <Part g={G.cyl(0.05, 0.06, 2.0, 6)} c="#3a3f44" position={[0, 1.1, 0]} />
            <Part g={G.box(0.34, 0.06, 0.34)} c="#3a3f44" position={[0, 2.12, 0]} />
            <Part g={G.cone(0.26, 0.2, 4)} c="#3a3f44" position={[0, 2.58, 0]} rotation={[0, Math.PI / 4, 0]} />
          </group>
        ))}
      </StaticBatch>
      {LAMPS.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]}>
          <mesh geometry={G.box(0.26, 0.34, 0.26)} material={lanternMat} position={[0, 2.32, 0]} />
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.05, 0]} material={glowMat()} renderOrder={3}>
            <planeGeometry args={[4.2, 4.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── fireflies ───────────────────────────────────────────────────────────
const FIREFLIES = 40;
const ff = new Object3D();

/** Fireflies drifting around the player at night. */
export function Fireflies({ runtime }: { runtime: Runtime }) {
  const ref = useRef<InstancedMesh>(null);
  const seeds = useMemo(() => Array.from({ length: FIREFLIES }, (_, i) => ({ a: i * 2.39, r: 3 + ((i * 37) % 11), h: 0.6 + ((i * 13) % 7) * 0.18 })), []);
  const group = useRef<Group>(null);
  const enabled = useUI((s) => s.settings.dayNight);
  useFrame((state) => {
    const m = ref.current;
    const g = group.current;
    if (!m || !g) return;
    const night = enabled ? nightFactor(timeOfDay(runtime.game.state.dayClock)) : 0;
    g.visible = night > 0.3;
    if (!g.visible) return;
    const t = state.clock.elapsedTime;
    const p = runtime.game.state.player;
    seeds.forEach((s, i) => {
      const a = s.a + t * (0.15 + (i % 5) * 0.03);
      ff.position.set(p.x + Math.cos(a) * s.r + Math.sin(t * 0.7 + i) * 0.8, s.h + Math.sin(t * 1.3 + i * 1.7) * 0.25, p.z + Math.sin(a * 1.3) * s.r * 0.75);
      const blink = 0.55 + 0.45 * Math.sin(t * (2 + (i % 3)) + i);
      ff.scale.setScalar(0.32 * blink);
      ff.quaternion.copy(state.camera.quaternion);
      ff.updateMatrix();
      m.setMatrixAt(i, ff.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={group}>
      <instancedMesh ref={ref} args={[G.box(1, 1, 0.01), fireflyMat(), FIREFLIES]} frustumCulled={false} renderOrder={4} />
    </group>
  );
}


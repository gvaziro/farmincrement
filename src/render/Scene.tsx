"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { damp } from "@/game/core/math";
import type { Runtime } from "@/runtime/runtime";
import { useUI, type Quality } from "@/runtime/store";
import { input } from "@/ui/input";
import { Buildings } from "./buildings/Buildings";
import { Characters } from "./Characters";
import { Crops } from "./Crops";
import { Customers } from "./Customers";
import { DayNightLights, Fireflies, Lamps } from "./DayNight";
import { Decor } from "./Decor";
import { Effects } from "./Effects";
import { Festive } from "./Festive";
import { FloatingTexts } from "./FloatingTexts";
import { fx } from "./fx";
import { Ground } from "./Ground";
import { Items } from "./Items";
import { Markers } from "./Markers";
import { Pads } from "./Pads";
import { Pond } from "./Pond";
import { SeasonController, SeasonParticles } from "./Seasons";
import { WeatherFX } from "./Weather";

export function Scene({ runtime, quality }: { runtime: Runtime; quality: Quality }) {
  return (
    <>
      <GameLoop runtime={runtime} />
      <CameraRig runtime={runtime} />
      <SeasonController runtime={runtime} />
      <DayNightLights runtime={runtime} quality={quality} />
      <Ground runtime={runtime} />
      <Decor runtime={runtime} />
      <Pond />
      <Lamps />
      <Festive />
      <Fireflies runtime={runtime} />
      <Crops runtime={runtime} />
      <Buildings runtime={runtime} />
      <Pads runtime={runtime} />
      <Characters runtime={runtime} />
      <Customers runtime={runtime} />
      <Items runtime={runtime} />
      <Effects />
      <SeasonParticles runtime={runtime} quality={quality} />
      <WeatherFX runtime={runtime} quality={quality} />
      <Markers runtime={runtime} />
      <FloatingTexts runtime={runtime} />
    </>
  );
}

function GameLoop({ runtime }: { runtime: Runtime }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // Debug handle for profiling in development: window.__tfeGl.info.render
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __tfeGl: gl });
  }, [gl]);
  // Negative priority: runs before every renderer reads the state.
  useFrame((_, dt) => runtime.frame(dt), -10);
  return null;
}

const target = new Vector3();
const desired = new Vector3();

function CameraRig({ runtime }: { runtime: Runtime }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const init = useRef(false);
  const zoom = useRef(1);
  const shakeOn = useUI((s) => s.settings.shake);

  useFrame((state, dt) => {
    const p = runtime.game.state.player;
    // Snap on first frame and after teleports (load, new season).
    if (!init.current || Math.hypot(target.x - p.x, target.z - p.z) > 14) {
      target.set(p.x, 0, p.z);
      init.current = true;
    }
    target.x = damp(target.x, p.x, 7, dt);
    target.z = damp(target.z, p.z, 7, dt);
    zoom.current = damp(zoom.current, input.zoom, 8, dt);
    const aspect = size.width / Math.max(1, size.height);
    // Portrait screens need to back off to keep the farm readable.
    const portrait = aspect < 1 ? Math.min(1.7, 1 / aspect) * 0.95 : 1;
    const k = zoom.current * portrait;
    desired.set(target.x, 18 * k, target.z + 14.2 * k);
    const shake = shakeOn ? fx.shake * fx.shake * 0.35 : 0;
    if (shake > 0.001) {
      const t = state.clock.elapsedTime * 40;
      desired.x += Math.sin(t) * shake;
      desired.y += Math.cos(t * 1.3) * shake;
    }
    camera.position.copy(desired);
    camera.lookAt(target.x, 0.4, target.z - 0.6);
  }, -5);
  return null;
}


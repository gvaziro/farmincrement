"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Color, Fog, Vector3, type DirectionalLight } from "three";
import { damp } from "@/game/core/math";
import type { Runtime } from "@/runtime/runtime";
import type { Quality } from "@/runtime/store";
import { input } from "@/ui/input";
import { Buildings } from "./buildings/Buildings";
import { Characters } from "./Characters";
import { Crops } from "./Crops";
import { Customers } from "./Customers";
import { Decor } from "./Decor";
import { Effects } from "./Effects";
import { FloatingTexts } from "./FloatingTexts";
import { fx } from "./fx";
import { Ground } from "./Ground";
import { Items } from "./Items";
import { Markers } from "./Markers";
import { Pads } from "./Pads";
import { Pond } from "./Pond";

const SKY = "#bfe6ff";

export function Scene({ runtime, quality }: { runtime: Runtime; quality: Quality }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.background = new Color(SKY);
    scene.fog = new Fog(SKY, 55, 120);
  }, [scene]);

  return (
    <>
      <GameLoop runtime={runtime} />
      <CameraRig runtime={runtime} />
      <Lights runtime={runtime} quality={quality} />
      <Ground runtime={runtime} />
      <Decor runtime={runtime} />
      <Pond />
      <Crops runtime={runtime} />
      <Buildings runtime={runtime} />
      <Pads runtime={runtime} />
      <Characters runtime={runtime} />
      <Customers runtime={runtime} />
      <Items runtime={runtime} />
      <Effects />
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
    const shake = fx.shake * fx.shake * 0.35;
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

function Lights({ runtime, quality }: { runtime: Runtime; quality: Quality }) {
  const sun = useRef<DirectionalLight>(null);
  const size = quality === "high" ? 2048 : 1024;

  const lastZoom = useRef(0);
  useFrame(() => {
    const l = sun.current;
    if (!l) return;
    const p = runtime.game.state.player;
    // Shadow frustum follows the player so shadows stay crisp…
    l.position.set(p.x - 9, 24, p.z + 11);
    l.target.position.set(p.x, 0, p.z - 2);
    l.target.updateMatrixWorld();
    // …and grows with the camera zoom so zoomed-out views keep their shadows.
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
      <hemisphereLight args={["#e9f6ff", "#7dbb5a", 1.55]} />
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
        shadow-camera-far={70}
      />
    </>
  );
}

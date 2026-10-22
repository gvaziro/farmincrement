"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { PCFShadowMap } from "three";
import { sfx } from "@/audio/sfx";
import LoadingScreen from "@/components/LoadingScreen";
import { renderItemIcons } from "@/render/itemIcons";
import { Scene } from "@/render/Scene";
import { Hud } from "@/ui/Hud";
import { input } from "@/ui/input";
import { Joystick } from "@/ui/Joystick";
import { useKeyboard } from "@/ui/useKeyboard";
import { getRuntime } from "./runtime";
import { useUI } from "./store";

export default function GameRoot() {
  const [runtime] = useState(() => getRuntime());
  const quality = useUI((s) => s.settings.quality);
  const sound = useUI((s) => s.settings.sound);
  const music = useUI((s) => s.settings.music);
  const ready = useUI((s) => s.ready);
  const [splashGone, setSplashGone] = useState(false);

  useKeyboard(runtime.game);

  useEffect(() => {
    // Icons are rendered from the 3D item models in a throwaway context.
    const id = setTimeout(renderItemIcons, 200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    // Debug handle for development: window.__tfe.game.state …
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __tfe: runtime, __tfeInput: input });
  }, [runtime]);

  useEffect(() => {
    sfx.setSound(sound);
    sfx.setMusic(music);
  }, [sound, music]);

  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const onVis = () => runtime.visibility(document.hidden);
    const onUnload = () => runtime.save();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [runtime]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSplashGone(true), 700);
    return () => clearTimeout(t);
  }, [ready]);

  const dpr: [number, number] = quality === "high" ? [1, 2] : quality === "medium" ? [1, 1.5] : [0.75, 1];

  return (
    <div className="game">
      <Canvas
        className="game__canvas"
        shadows={quality === "low" ? false : { type: PCFShadowMap }}
        dpr={dpr}
        flat
        camera={{ fov: 36, near: 0.5, far: 260, position: [0, 18, 14] }}
        gl={{ antialias: quality !== "low", powerPreference: "high-performance" }}
        onCreated={() => useUI.setState({ ready: true })}
      >
        <Scene runtime={runtime} quality={quality} />
      </Canvas>
      <Joystick game={runtime.game} />
      <Hud runtime={runtime} />
      {!splashGone && <LoadingScreen fading={ready} />}
    </div>
  );
}

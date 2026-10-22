"use client";

import dynamic from "next/dynamic";
import LoadingScreen from "./LoadingScreen";

// three.js needs the browser — the whole game is client-only.
const GameRoot = dynamic(() => import("@/runtime/GameRoot"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

export default function GameClient() {
  return <GameRoot />;
}

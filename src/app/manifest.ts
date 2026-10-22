import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tiny Farm Empire",
    short_name: "Farm Empire",
    description: "Уютная idle-аркада: собирай урожай, строй машины и расширяй ферму.",
    start_url: "/",
    display: "fullscreen",
    orientation: "any",
    background_color: "#bfe6ff",
    theme_color: "#8fd36a",
    lang: "ru",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

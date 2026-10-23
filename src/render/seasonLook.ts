/**
 * The seasonal look of the whole world, done inside the shaders of the shared
 * materials so no model has to be duplicated: snow settles on every face that
 * looks up (roofs, ground, fences, crowns), greens turn yellow and red in
 * autumn and grey-green in winter, crowns blossom in spring.
 *
 * Materials opt in with a kind:
 *   plain      — no seasonal change (characters, animals, items, crops)
 *   snow       — snow only (buildings, props, ground, rocks)
 *   dusting    — a light, patchy snow (field beds stay readable)
 *   evergreen  — snow + winter dulling (pines)
 *   foliage    — everything: blossom, fresh spring green, autumn colours, snow
 *
 * <SeasonController> writes the uniforms every frame.
 */
import type { MeshLambertMaterial } from "three";

export type SeasonKind = "plain" | "snow" | "dusting" | "evergreen" | "foliage";

/** Shared uniform objects: every seasonal material references these. */
export const seasonUniforms = {
  uSnow: { value: 0 },
  uAutumn: { value: 0 },
  uFresh: { value: 0 },
  uWinter: { value: 0 },
  uBlossom: { value: 0 },
};

const PARS = /* glsl */ `
uniform float uSnow;
uniform float uAutumn;
uniform float uFresh;
uniform float uWinter;
uniform float uBlossom;
flat varying float vSeasonSeed;
flat varying vec3 vFacetN;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float sNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), f.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

/**
 * Per-object seed (instance or object origin) and the facet's world normal.
 * Both are `flat`: hashing interpolated values would turn tiny rounding
 * differences into per-pixel noise.
 */
const SEED_VERTEX = /* glsl */ `
{
  vec4 sOrigin = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
  sOrigin = instanceMatrix * sOrigin;
  #endif
  sOrigin = modelMatrix * sOrigin;
  vSeasonSeed = floor(sOrigin.x * 4.0) * 0.173 + floor(sOrigin.z * 4.0) * 0.419;
  vFacetN = normalize((vec4(transformedNormal, 0.0) * viewMatrix).xyz);
}
`;

// World-space normal and position from view space (flat-shaded normals too).
const BEGIN = /* glsl */ `
{
  vec3 sN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
  vec3 sP = (vec4(-vViewPosition, 0.0) * viewMatrix).xyz + cameraPosition;
  vec3 c = diffuseColor.rgb;
  // Random per facet (same over a whole flat triangle) and per object.
  vec3 sQ = floor(vFacetN * 16.0 + 0.5);
  float facet = sHash(sQ.xz * 0.713 + sQ.y * 0.371 + vSeasonSeed);
  float facet2 = sHash(sQ.zx * 0.537 + sQ.y * 0.193 + vSeasonSeed * 1.7);
  float green = clamp((c.g - max(c.r, c.b)) * 7.0, 0.0, 1.0);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
`;

const FOLIAGE = /* glsl */ `
  // Spring: fresher, lighter greens; whole facets of crowns blossom pink or white.
  c = mix(c, c * vec3(1.3, 1.15, 0.75) + vec3(0.02, 0.025, 0.0), green * uFresh);
  float petal = step(0.5, facet) * step(0.55, sP.y);
  vec3 bloom = mix(vec3(1.0, 0.36, 0.5), vec3(1.0, 0.86, 0.9), step(0.45, facet2));
  c = mix(c, bloom * clamp(lum * 2.4, 0.55, 1.0), green * petal * uBlossom);
  // Autumn: each tree its own yellow, orange or red; facets vary a little.
  float hue = sHash(vec2(vSeasonSeed, 0.41));
  vec3 fall = hue < 0.4 ? vec3(0.92, 0.52, 0.02) : (hue < 0.75 ? vec3(0.88, 0.24, 0.01) : vec3(0.6, 0.05, 0.02));
  fall *= (0.8 + 0.4 * facet2) * clamp(lum * 2.6, 0.5, 1.3);
  c = mix(c, fall, green * uAutumn);
`;

const WINTER_GREEN = /* glsl */ `
  // Winter: greens go dark and grey.
  c = mix(c, mix(vec3(lum), c, 0.45) * 0.85, green * uWinter);
`;

/** Snow lies on faces that look up, in patches while it is still settling. */
const snow = (cover: string) => /* glsl */ `
  float up = smoothstep(0.35, 0.8, sN.y);
  float n = sNoise(sP.xz * 0.45) * 0.6 + sNoise(sP.xz * 1.9) * 0.3;
  float snowAt = uSnow * ${cover};
  float lie = smoothstep(1.0 - snowAt, 1.15 - snowAt, n + 0.15);
  c = mix(c, vec3(0.8, 0.85, 0.94) * (0.93 + 0.12 * n), up * lie);
`;

const END = /* glsl */ `
  diffuseColor.rgb = c;
}
`;

function fragmentBody(kind: SeasonKind) {
  let s = BEGIN;
  if (kind === "foliage") s += FOLIAGE;
  if (kind === "foliage" || kind === "evergreen") s += WINTER_GREEN;
  s += snow(kind === "dusting" ? "0.5" : "1.0");
  return s + END;
}

/** Make a Lambert material react to the seasons. Returns the same material. */
export function makeSeasonal<T extends MeshLambertMaterial>(m: T, kind: SeasonKind): T {
  if (kind === "plain") return m;
  m.userData.season = kind;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, seasonUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nflat varying float vSeasonSeed;\nflat varying vec3 vFacetN;")
      .replace("#include <project_vertex>", `#include <project_vertex>\n${SEED_VERTEX}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${PARS}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${fragmentBody(kind)}`);
  };
  m.customProgramCacheKey = () => `season-${kind}`;
  return m;
}

/** Seasonal kind of a material (plain if it never opted in). */
export const seasonKindOf = (m: { userData: Record<string, unknown> }): SeasonKind => (m.userData.season as SeasonKind | undefined) ?? "plain";

/**
 * How much of each season the world shows right now (weights sum to 1).
 * Written every frame by <SeasonController>; renderers read it for things a
 * shader cannot do (ice on the pond, flowers under snow, ground and sky tint).
 */
export const seasonVisual = { spring: 0, summer: 1, autumn: 0, winter: 0 };

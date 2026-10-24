/**
 * The HUD's edge arrows (golden plant, merchant, runaway), by surprise kind.
 * The HUD owns the elements; the 3D scene moves them every frame, so they
 * never cause a React render.
 */
export const EDGE_ARROW_KINDS = ["golden", "merchant", "runaway"] as const;
export const edgeArrowEls = new Map<string, HTMLElement>();

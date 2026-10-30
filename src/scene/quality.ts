// Graphics level: ?gfx=high|low|2d overrides the stored setting, which overrides the device
// default. Reduced motion is the player's setting (GDD §8). ?orbit=1 runs the frame-time
// measurement.
export type Gfx = "high" | "low" | "2d";

export interface Quality {
  gfx: Gfx;
  pixelRatio: number;
  shadowMapSize: number;
  depthOfField: boolean;
  bloom: boolean;
  reducedMotion: boolean;
  orbit: boolean;
}

export function readQuality(
  url: URL,
  win: Window,
  stored: Gfx | null,
  reducedMotion: boolean,
): Quality {
  const asked = url.searchParams.get("gfx");
  const coarse = win.matchMedia("(pointer: coarse)").matches;
  const gfx: Gfx =
    asked === "low" || asked === "2d" || asked === "high"
      ? asked
      : (stored ?? (coarse ? "low" : "high"));
  const cap = coarse ? 1.5 : 2;
  return {
    gfx,
    pixelRatio: Math.min(win.devicePixelRatio || 1, gfx === "high" ? cap : 1.25),
    shadowMapSize: gfx === "high" ? 2048 : 1024,
    depthOfField: gfx === "high" && !coarse,
    bloom: gfx === "high",
    reducedMotion,
    orbit: url.searchParams.get("orbit") === "1",
  };
}

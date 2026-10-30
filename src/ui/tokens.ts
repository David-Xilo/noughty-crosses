// Palette tokens from docs/style-guide.md ("Palette"). One source for CSS and the 3D scene.
export const palette = {
  felt: "#1F3B2E",
  walnut: "#5A3A22",
  board: "#9C7148",
  walnutDark: "#2E1D12",
  brass: "#C8A15A",
  paper: "#F3ECDD",
  ink: "#1B1B1F",
  xGlaze: "#EDE6D6",
  pewter: "#DCDEE1",
  oLacquer: "#1A2442",
  win: "#F2C46D",
  danger: "#B5483B",
} as const;

/**
 * The high-contrast set (style guide, "Pieces"): a pure white X and a pure black O with a
 * white rim, on a desaturated grey board. Every X is white, Notakto's too.
 */
export const highContrast = {
  xGlaze: "#FFFFFF",
  oLacquer: "#000000",
  oRim: "#FFFFFF",
  board: "#707070",
} as const;

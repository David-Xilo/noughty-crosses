// The 2D pieces (TTT-0.1): one SVG per cell that shows a shared symbol from index.html
// (#piece-x, #piece-o). Vector shapes stay crisp and scale with the board; colours come
// from the palette's CSS variables.
export const SVG = "http://www.w3.org/2000/svg";

/** An empty piece slot for a board cell. */
export function createPiece(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "piece");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.appendChild(document.createElementNS(SVG, "use"));
  // The settle-in plays once per placement; without this a piece that stops fading
  // would replay it.
  svg.addEventListener("animationend", (e) => {
    if (e.animationName === "settle") svg.classList.remove("placed");
  });
  return svg;
}

/** Shows X, O or nothing in a slot. */
export function setPiece(svg: SVGSVGElement, mark: "X" | "O" | null | ""): void {
  const use = svg.firstElementChild as SVGUseElement;
  if (mark) use.setAttribute("href", `#piece-${mark.toLowerCase()}`);
  else use.removeAttribute("href");
}

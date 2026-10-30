// The DOM mirror of the board (GDD §9): a grid of cells that the keyboard uses, one grid
// per board (Notakto has up to three, Ultimate nine in a 3 by 3 grid; the Big board is 5 by
// 5, Gravity 6 by 6; Cube one per layer, side by side, and PageUp and PageDown change layer). In the 3D views it is visually hidden and drives the 3D cursor; in the
// 2D view it is the board.
import { type BoardModel, lineAcross, type SaucerVisit, VISIT_MS } from "../scene/board-model";
import { t } from "./l10n";
import { createPiece, SVG, setPiece } from "./pieces";

interface Mirror {
  /**
   * Shows a position; `legal` cells can be chosen, and `turn` is the piece to place. A pick
   * of cell `i` plays `target(i)`: in Gravity the landing cell of its column, so any cell
   * of an open column can be chosen. `placed` is the cell just played: in Saucer the
   * saucer's visit to it plays out (S3).
   */
  show(
    model: BoardModel,
    legal: readonly number[],
    turn: "X" | "O" | null,
    target?: (i: number) => number,
    placed?: number,
  ): void;
  /** Shows the ghost on `cell`, where a pick of another cell lands (Gravity); null clears it. */
  aim(cell: number | null): void;
  focus(): void;
  /** A cell was activated by Enter, Space or a click (on release). */
  onPick: ((cell: number) => void) | null;
  /** The focused or hovered cell changed (null when the grid loses focus). */
  onCursor: ((cell: number | null) => void) | null;
}

/**
 * A cell inside a sentence: "row 1, column 2", "board 2, row 1, column 2", or in Cube
 * "layer 2, row 1, column 2".
 */
export function cellName(i: number, boards = 1, size = 3, layers = false): string {
  const per = size * size;
  const args = {
    board: Math.floor(i / per) + 1,
    row: Math.floor((i % per) / size) + 1,
    column: (i % size) + 1,
  };
  return t(layers ? "cell-ref-layer" : boards > 1 ? "cell-ref-board" : "cell-ref", args);
}

/** Saucer: a small flying saucer, drawn over the 2D board (S3). */
function createSaucer(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "saucer2d");
  svg.setAttribute("viewBox", "0 0 100 60");
  svg.setAttribute("aria-hidden", "true");
  const add = (tag: string, attrs: Record<string, string>) => {
    const el = svg.appendChild(document.createElementNS(SVG, tag));
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  };
  add("path", { class: "beam", d: "M38 38 L22 60 L78 60 L62 38 Z" });
  add("ellipse", { class: "dome", cx: "50", cy: "24", rx: "17", ry: "15" });
  add("ellipse", { class: "hull", cx: "50", cy: "32", rx: "46", ry: "11" });
  for (const x of [18, 34, 50, 66, 82])
    add("circle", { class: "light", cx: `${x}`, cy: "34", r: "3.5" });
  return svg;
}

interface Board {
  grid: HTMLElement;
  stroke: SVGLineElement;
  line: SVGSVGElement;
  /** Ultimate: the large piece of the side that claimed the board. */
  claim: SVGSVGElement;
}

export function createMirror(root: HTMLElement): Mirror {
  let cells: HTMLButtonElement[] = [];
  let pieces: SVGSVGElement[] = [];
  let boards: Board[] = [];
  let size = 3;
  let upright = false;
  let layers = false;
  /** Boards per row in a grid of boards (Ultimate), or 0: a row or a column, by the CSS. */
  let columns = 0;
  let active = 4;
  let aimed: HTMLButtonElement | null = null;
  const saucer = createSaucer();
  /** Saucer: the ply of the last visit shown, so a refresh never replays it. */
  let visitPly = -1;
  /** The cell of the move just played, ringed until the next move (G10). */
  let last = -1;

  /** Builds `n` boards of `s` by `s` cells; called again when any of these changes. */
  const build = (n: number, s: number, up: boolean, cols: number, lay: boolean) => {
    root.replaceChildren();
    root.style.setProperty("--boards", String(n));
    root.style.setProperty("--size", String(s));
    size = s;
    upright = up;
    columns = cols;
    layers = lay;
    root.toggleAttribute("data-columns", cols > 0);
    root.toggleAttribute("data-layers", lay);
    root.style.setProperty("--columns", String(cols));
    cells = [];
    pieces = [];
    boards = [];
    aimed = null;
    // The centre, or on an upright board the middle of the bottom row.
    active = up ? (s - 1) * s + Math.floor((s - 1) / 2) : Math.floor((s * s) / 2);
    for (let b = 0; b < n; b++) {
      const grid = document.createElement("div");
      grid.className = "board2d";
      grid.setAttribute("role", "grid");
      // Cube: each layer is named over its grid, from the bottom.
      if (lay) grid.dataset.layer = t("cube-layer", { n: b + 1, top: b === n - 1 ? "yes" : "no" });
      for (let r = 0; r < s; r++) {
        const row = document.createElement("div");
        row.setAttribute("role", "row");
        for (let c = 0; c < s; c++) {
          const i = b * s * s + r * s + c;
          const cell = document.createElement("button");
          cell.type = "button";
          cell.setAttribute("role", "gridcell");
          cell.className = "cell";
          cell.tabIndex = i === active ? 0 : -1;
          cell.addEventListener("click", () => mirror.onPick?.(i));
          cell.addEventListener("focus", () => {
            moveTo(i, false);
            mirror.onCursor?.(i);
          });
          cell.addEventListener("pointerenter", () => mirror.onCursor?.(i));
          const piece = createPiece();
          cell.appendChild(piece);
          row.appendChild(cell);
          cells.push(cell);
          pieces.push(piece);
        }
        grid.appendChild(row);
      }
      // The board's line, drawn over the cells in the 2D view (in cell units).
      const line = document.createElementNS(SVG, "svg");
      line.setAttribute("class", "win-line");
      line.setAttribute("viewBox", `0 0 ${s} ${s}`);
      line.setAttribute("aria-hidden", "true");
      const stroke = document.createElementNS(SVG, "line");
      line.appendChild(stroke);
      grid.appendChild(line);
      const claim = createPiece();
      claim.classList.add("claim");
      grid.appendChild(claim);
      root.appendChild(grid);
      boards.push({ grid, stroke, line, claim });
    }
    boards[0]?.grid.appendChild(saucer);
  };

  /** Saucer: a cell's box in the first board's grid, in CSS pixels. */
  const box = (i: number) => {
    const grid = (boards[0] as Board).grid;
    const g = grid.getBoundingClientRect();
    const r = (cells[i] as HTMLElement).getBoundingClientRect();
    return { x: r.left - g.left - grid.clientLeft, y: r.top - g.top - grid.clientTop, w: r.width };
  };
  /** Saucer: where the saucer waits, by the board's top right corner. */
  const waiting = () => {
    const grid = (boards[0] as Board).grid;
    const w = box(0).w;
    return `translate(${grid.clientWidth - w * 0.55}px, ${-w * 0.75}px)`;
  };
  const sizeSaucer = () => {
    saucer.style.width = `${box(0).w}px`;
  };
  /**
   * Saucer: the saucer flies from where it waits to the piece, lifts it, sets it down on the
   * next cell, back on its own or carries it off, and flies away (S3).
   */
  const fly = (v: SaucerVisit) => {
    if (document.documentElement.dataset.motion === "reduced" || !boards[0]) return;
    sizeSaucer();
    const f = box(v.from);
    const t = v.to === null ? null : box(v.to);
    const lift = f.w * 0.22;
    const over = (b: { x: number; y: number }, up = 0) =>
      `translate(${b.x}px, ${b.y - f.w * 0.5 - up}px)`;
    const away = `translate(${boards[0].grid.clientWidth + f.w}px, ${-f.w * 2}px)`;
    saucer.animate(
      [
        { transform: waiting(), opacity: 1, offset: 0 },
        { transform: over(f), offset: 0.3 },
        { transform: over(f), offset: 0.45 },
        { transform: t ? over(t) : over(f, f.w * 0.8), offset: 0.65 },
        { transform: t ? over(t) : away, opacity: t ? 1 : 0, offset: 0.8 },
        { transform: away, opacity: 0, offset: 1 },
      ],
      { duration: VISIT_MS, easing: "ease-in-out" },
    );
    const piece = (pieces[v.to ?? v.from] ?? null) as SVGSVGElement | null;
    if (t && piece) {
      // Pushed or left: the piece rises from its cell, follows the saucer and settles.
      const dx = f.x - t.x;
      const dy = f.y - t.y;
      piece.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, offset: 0 },
          { transform: `translate(${dx}px, ${dy}px)`, offset: 0.3 },
          { transform: `translate(${dx}px, ${dy - lift}px)`, offset: 0.45 },
          { transform: `translate(0, ${-lift}px)`, offset: 0.65 },
          { transform: "translate(0, 0)", offset: 0.75 },
          { transform: "translate(0, 0)", offset: 1 },
        ],
        { duration: VISIT_MS, easing: "ease-in-out" },
      );
    } else {
      // Carried off: a copy of the piece rises from the centre into the saucer and fades.
      const copy = createPiece();
      setPiece(copy, v.side);
      copy.classList.add("carried");
      Object.assign(copy.style, {
        left: `${f.x + f.w * 0.12}px`,
        top: `${f.y + f.w * 0.12}px`,
        width: `${f.w * 0.76}px`,
        height: `${f.w * 0.76}px`,
      });
      (boards[0] as Board).grid.appendChild(copy);
      copy
        .animate(
          [
            { transform: "none", opacity: 1, offset: 0 },
            { transform: "none", opacity: 1, offset: 0.3 },
            { transform: `translateY(${-lift}px) scale(0.8)`, opacity: 1, offset: 0.45 },
            { transform: `translateY(${-f.w * 1.1}px) scale(0.4)`, opacity: 0, offset: 0.65 },
            { transform: `translateY(${-f.w * 1.1}px) scale(0.4)`, opacity: 0, offset: 1 },
          ],
          { duration: VISIT_MS, easing: "ease-in-out" },
        )
        .finished.finally(() => copy.remove());
    }
  };

  root.addEventListener("focusout", (e) => {
    if (root.contains(e.relatedTarget as Node | null)) return;
    mirror.onCursor?.(null);
  });
  // The cursor goes back to the focused cell, or away when the grid has no focus.
  root.addEventListener("pointerleave", () =>
    mirror.onCursor?.(root.contains(document.activeElement) ? active : null),
  );

  // Roving focus: the arrows move between cells, and on to the next board the way the
  // boards are laid out (a row, or a column in a tall 2D area, or Ultimate's 3 by 3 grid);
  // Home and End jump to the row's ends.
  const moveTo = (i: number, focus = true) => {
    (cells[active] as HTMLButtonElement).tabIndex = -1;
    active = i;
    const cell = cells[i] as HTMLButtonElement;
    cell.tabIndex = 0;
    if (focus) cell.focus();
  };
  root.addEventListener("keydown", (e) => {
    const n = boards.length;
    const per = size * size;
    const end = size - 1;
    const b = Math.floor(active / per);
    const r = Math.floor((active % per) / size);
    const c = active % size;
    const at = (bb: number, rr: number, cc: number) => bb * per + rr * size + cc;
    const cols = columns || (getComputedStyle(root).flexDirection === "column" ? 1 : n);
    const bc = b % cols;
    const up = b >= cols;
    const down = b + cols < n;
    const left = bc > 0;
    const right = bc < cols - 1 && b < n - 1;
    // Cube: the same cell one layer up or down. These keys then no longer tilt the camera.
    const layer = (d: number) => (b + d >= 0 && b + d < n ? at(b + d, r, c) : active);
    const to: Record<string, number> = {
      ...(layers ? { PageUp: layer(1), PageDown: layer(-1) } : {}),
      ArrowUp: r > 0 ? at(b, r - 1, c) : up ? at(b - cols, end, c) : active,
      ArrowDown: r < end ? at(b, r + 1, c) : down ? at(b + cols, 0, c) : active,
      ArrowLeft: c > 0 ? at(b, r, c - 1) : left ? at(b - 1, r, end) : active,
      ArrowRight: c < end ? at(b, r, c + 1) : right ? at(b + 1, r, 0) : active,
      Home: at(b, r, 0),
      End: at(b, r, end),
    };
    const target = to[e.key];
    if (target === undefined) return;
    e.preventDefault();
    moveTo(target);
  });

  const drawLine = (board: Board, line: readonly number[] | null, final: boolean) => {
    const on = !!line?.length; // a full board without a line has an empty one
    board.line.classList.toggle("on", on);
    board.line.classList.toggle("dead", on && !final);
    if (!line?.length) return;
    // From just before the first cell's centre to just past the last one's.
    const at = (c: number) =>
      [(c % size) + 0.5, Math.floor((c % (size * size)) / size) + 0.5] as const;
    const [x1, y1] = at(line[0] as number);
    const [x2, y2] = at(line.at(-1) as number);
    const length = Math.hypot(x2 - x1, y2 - y1);
    const ext = 0.32 / length;
    board.stroke.style.setProperty("--len", String(length + 0.64));
    board.stroke.setAttribute("x1", String(x1 - (x2 - x1) * ext));
    board.stroke.setAttribute("y1", String(y1 - (y2 - y1) * ext));
    board.stroke.setAttribute("x2", String(x2 + (x2 - x1) * ext));
    board.stroke.setAttribute("y2", String(y2 + (y2 - y1) * ext));
  };

  const mirror: Mirror = {
    onPick: null,
    onCursor: null,
    show(model, legal, turn, target = (i) => i, placed) {
      if (placed !== undefined) last = placed;
      if (!model.cells.some((m) => m)) last = -1; // a new game
      const n = model.dead.length;
      const cols = model.columns ?? 0;
      if (
        n !== boards.length ||
        model.size !== size ||
        model.upright !== upright ||
        cols !== columns ||
        model.layers !== layers
      ) {
        // Overtime: a game's board grew by a ring (O2); Cube: the cube grew by a layer on the
        // top, right and back (C3). Its marks keep their places, and so do focus and the
        // cursor; the new cells appear around them.
        const grew =
          (n === boards.length || (model.layers && layers)) &&
          model.size > size &&
          cells.some((c) => c.dataset.mark);
        const focused = root.contains(document.activeElement);
        // A cell of the old board, on the grown one.
        const old = size;
        const big = model.size;
        const ring = (big - old) / 2;
        const inGrown = (i: number) =>
          model.layers
            ? (Math.floor(i / old ** 2) * big + (Math.floor(i / old) % old) + 1) * big + (i % old)
            : (Math.floor(i / old) + ring) * big + (i % old) + ring;
        const kept = cells.flatMap((c, i) => (c.dataset.mark ? [inGrown(i)] : []));
        const from = active;
        build(n, model.size, model.upright, cols, model.layers);
        if (grew) {
          (cells[active] as HTMLButtonElement).tabIndex = -1;
          active = inGrown(from);
          (cells[active] as HTMLButtonElement).tabIndex = 0;
          cells.forEach((cell, i) => {
            const mark = model.cells[i];
            // An old mark does not settle again; the mark just played does.
            if (mark && kept.includes(i)) cell.dataset.mark = mark;
            else if (!mark) cell.classList.add("grown");
          });
        }
        if (focused) moveTo(active);
      }
      const per = size * size;
      const open = (i: number) => legal.includes(target(i));
      // Ultimate: the winning line is three boards, shown by the boards themselves (U5).
      const boardOf = (c: number) => Math.floor(c / per);
      const across = lineAcross(model);
      root.toggleAttribute("data-neutral", model.neutral);
      boards.forEach((board, b) => {
        const dead = model.dead[b] ?? null;
        const claimed = model.claimed[b] ?? null;
        const final = !across && !!model.line && boardOf(model.line[0] as number) === b;
        const won = across && !!model.line?.some((c) => boardOf(c) === b);
        board.grid.classList.toggle("dead", !!dead && !final && !claimed);
        board.grid.classList.toggle("claimed", !!claimed);
        board.grid.classList.toggle("win", won);
        board.grid.classList.toggle("target", model.targets.includes(b));
        setPiece(board.claim, claimed);
        // Cube: a line within one layer is drawn on it; one through the layers shows by its cells.
        const inLayer = model.layers && !!model.line?.every((c) => boardOf(c) === b);
        const line = n === 1 || inLayer ? model.line : null;
        drawLine(board, dead ?? line, final || n === 1 || inLayer);
      });
      cells.forEach((cell, i) => {
        const mark = model.cells[i] ?? null;
        const ghost = !mark && turn && legal.includes(i) ? turn : "";
        const piece = pieces[i] as SVGSVGElement;
        // A new mark settles in (the class clears itself when the animation ends).
        if (mark && cell.dataset.mark !== mark) piece.classList.add("placed");
        cell.dataset.mark = mark ?? "";
        setPiece(piece, mark ?? ghost);
        // Nesting: pieces in three sizes (NE1); the ghost has the size of the piece held.
        const z = mark ? model.sizes?.[i] : ghost ? model.ghostSize : undefined;
        if (z === undefined || z < 0) delete piece.dataset.size;
        else piece.dataset.size = String(z);
        piece.classList.toggle("ghost", !mark && !!ghost);
        cell.classList.toggle("fading", !!mark && model.fading.includes(i));
        cell.classList.toggle("win", !across && !!model.line?.includes(i));
        cell.classList.toggle("selected", model.selected === i);
        cell.classList.toggle("last", i === last && !!mark);
        cell.classList.toggle("blocked", !mark && !!turn && !open(i));
        cell.setAttribute("aria-disabled", String(!open(i)));
      });
      // Saucer: it waits by the board when it takes the next piece, and visits the piece
      // just played (S3).
      const v = model.visit;
      if (v && placed === v.from && v.ply !== visitPly) fly(v);
      visitPly = v?.ply ?? -1;
      saucer.classList.toggle("waits", !!model.saucerWaits);
      if (model.saucerWaits) {
        sizeSaucer();
        saucer.style.transform = waiting();
      }
    },
    aim(cell) {
      aimed?.classList.remove("aimed");
      aimed = cell === null ? null : (cells[cell] ?? null);
      aimed?.classList.add("aimed");
    },
    focus() {
      moveTo(active);
    },
  };
  build(1, 3, false, 0, false);
  return mirror;
}

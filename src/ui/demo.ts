// Miniature boards: on each mode's drawer, the last position of its demo; on its rule card,
// the demo itself (GDD §3, rule cards): a short, real game replayed through the rules core
// (src/app/demos.ts). It plays by itself unless reduced motion is on; the player can pause
// it or step through it. Both are pictures: the text beside them carries the meaning.
import { DEMOS } from "../app/demos";
import { type AnyModeInfo, MODES, type ModeId } from "../app/modes";
import { layerColumns } from "../scene/board-model";
import { t } from "./l10n";
import { createPiece, setPiece } from "./pieces";

/** A small, static board of a mode: one grid per board (or per layer of Cube), as on the 2D board. */
function createMiniBoard(info: AnyModeInfo, boards: number) {
  const start = info.start("X", boards);
  const el = document.createElement("span");
  el.className = "mini";
  el.setAttribute("aria-hidden", "true");
  el.toggleAttribute("data-neutral", info.neutral);
  const grids: HTMLElement[] = [];
  const claims: SVGSVGElement[] = [];
  const cells: HTMLElement[] = [];
  let size = 0;
  let per = 0;
  /** Builds `n` boards at `s` cells a side; again when Overtime's board or the cube grows. */
  const build = (s: number, n: number) => {
    size = s;
    per = s * s;
    el.style.setProperty("--size", String(s));
    el.style.setProperty("--columns", String(info.layers ? layerColumns(n) : (info.columns ?? n)));
    el.replaceChildren();
    grids.length = claims.length = cells.length = 0;
    for (let b = 0; b < n; b++) {
      const grid = el.appendChild(document.createElement("span"));
      grid.className = "mini-board";
      for (let i = 0; i < per; i++) {
        const cell = grid.appendChild(document.createElement("i"));
        cell.appendChild(createPiece());
        cells.push(cell);
      }
      const claim = grid.appendChild(createPiece());
      claim.classList.add("claim");
      grids.push(grid);
      claims.push(claim);
    }
  };
  build(info.size, info.dead(start).length);
  // biome-ignore lint/suspicious/noExplicitAny: a mode's own state type
  const show = (s: any) => {
    const sized = info.sizeOf?.(s) ?? info.size;
    const dead = info.dead(s);
    if (sized !== size) build(sized, dead.length);
    const marks = info.cells(s);
    const fading = info.fading(s);
    const claimed = info.claimed?.(s) ?? [];
    const targets = info.targets?.(s) ?? [];
    const r = info.mode.result(s);
    const line: readonly number[] = r?.kind === "win" ? r.line : [];
    // Ultimate's line runs across boards (U5): the boards glow, not the cells.
    const across = !!info.columns;
    grids.forEach((g, b) => {
      g.classList.toggle("dead", !!dead[b] && !claimed[b]);
      g.classList.toggle("claimed", !!claimed[b]);
      g.classList.toggle("target", targets.includes(b));
      g.classList.toggle("win", across && line.some((c) => Math.floor(c / per) === b));
      setPiece(claims[b] as SVGSVGElement, claimed[b] ?? null);
    });
    const sizes = info.nest?.sizes(s);
    cells.forEach((c, i) => {
      const piece = c.firstElementChild as SVGSVGElement;
      setPiece(piece, marks[i] ?? null);
      // Nesting: the top piece's size (NE1).
      if (sizes && (sizes[i] as number) >= 0) piece.dataset.size = String(sizes[i]);
      else delete piece.dataset.size;
      c.classList.toggle("fading", !r && fading.includes(i));
      c.classList.toggle("win", !across && line.includes(i));
    });
  };
  return { el, show };
}

/** The position after the first `ply` moves of a mode's demo. */
function demoState(id: ModeId, ply: number) {
  const info = MODES[id] as AnyModeInfo;
  const demo = DEMOS[id];
  return demo.moves
    .slice(0, ply)
    .reduce((s, c) => info.mode.apply(s, c), info.start("X", demo.boards));
}

/** A drawer's miniature: the demo's last position. */
export function drawerBoard(id: ModeId): HTMLElement {
  const mini = createMiniBoard(MODES[id], DEMOS[id].boards);
  mini.show(demoState(id, DEMOS[id].moves.length));
  return mini.el;
}

export function createDemo(root: HTMLElement, id: ModeId, reducedMotion: boolean) {
  const demo = DEMOS[id];
  const mini = createMiniBoard(MODES[id], demo.boards);
  const caption = document.createElement("p");
  caption.className = "demo-caption";
  const controls = document.createElement("div");
  controls.className = "demo-controls";
  const button = (act: string) => {
    const b = controls.appendChild(document.createElement("button"));
    b.type = "button";
    b.className = "stamp small";
    b.dataset.demo = act;
    return b;
  };
  const playBtn = button("play");
  const stepBtn = button("step");
  stepBtn.textContent = t("demo-step");
  root.replaceChildren(mini.el, caption, controls);

  let ply = 0;
  let timer = 0;
  let playing = !reducedMotion;
  const total = demo.moves.length;

  const draw = () => {
    mini.show(demoState(id, ply));
    const key = Math.max(...demo.captions.filter((k) => k <= ply));
    caption.textContent = t("demo-caption", { caption: t(`demo-${id}-${key}`), ply, total });
    playBtn.textContent = t(playing ? "demo-pause" : "demo-play");
    playBtn.dataset.demo = playing ? "pause" : "play";
  };
  const step = () => {
    ply = ply >= total ? 0 : ply + 1;
    draw();
  };
  const schedule = () => {
    window.clearTimeout(timer);
    if (!playing) return;
    // About ten seconds per loop: 1.1 s per move and a longer look at the end.
    timer = window.setTimeout(
      () => {
        step();
        schedule();
      },
      ply >= total ? 2600 : 1100,
    );
  };
  playBtn.addEventListener("click", () => {
    playing = !playing;
    draw();
    schedule();
  });
  stepBtn.addEventListener("click", () => {
    playing = false;
    window.clearTimeout(timer);
    step();
  });
  draw();
  schedule();
  return {
    stop() {
      playing = false;
      window.clearTimeout(timer);
    },
  };
}

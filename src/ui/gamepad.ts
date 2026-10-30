// Controller input (GDD §5) through the Gamepad API's standard layout, polled once a frame
// while a controller is connected. Buttons act on release; the d-pad and the left stick move
// at once and repeat while held; the right stick turns the camera.

type PadButton = "confirm" | "back" | "swapMark" | "undo" | "reset" | "layerDown" | "layerUp";
export type PadDir = "up" | "down" | "left" | "right";

interface PadHandlers {
  button(b: PadButton): void;
  move(d: PadDir): void;
  /** The right stick, each axis from -1 to 1, held for `dt` seconds. */
  camera(x: number, y: number, dt: number): void;
  /** Any input from controller `index`: glyphs and rumble follow the device used last. */
  used(index: number): void;
}

// Standard layout: A, B, X (Misère wild's mark), Y, the shoulder buttons (Cube's layers),
// Start, R3; the d-pad is buttons 12 to 15.
const BUTTONS: Record<number, PadButton> = {
  0: "confirm",
  1: "back",
  2: "swapMark",
  3: "undo",
  4: "layerDown",
  5: "layerUp",
  9: "back",
  11: "reset",
};
const DIRS: ReadonlyArray<[PadDir, number, number, number]> = [
  // direction, d-pad button, left-stick axis, sign
  ["up", 12, 1, -1],
  ["down", 13, 1, 1],
  ["left", 14, 0, -1],
  ["right", 15, 0, 1],
];
const STICK = 0.5; // the left stick counts as a direction past half way
const DEAD = 0.2; // the right stick's dead zone
const REPEAT_FIRST = 400;
const REPEAT_NEXT = 130;

export function watchGamepads(win: Window, h: PadHandlers): void {
  /** Per controller: buttons held at the last poll, and when each held direction repeats. */
  const held = new Map<number, { buttons: Set<number>; repeat: Map<PadDir, number> }>();
  let running = false;
  let last = 0;

  const poll = (now: number) => {
    const pads = win.navigator.getGamepads().filter((p): p is Gamepad => !!p && p.connected);
    if (pads.length === 0) {
      running = false;
      held.clear();
      return;
    }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    for (const pad of pads) {
      const was = held.get(pad.index) ?? { buttons: new Set<number>(), repeat: new Map() };
      const down = new Set<number>();
      pad.buttons.forEach((b, i) => {
        if (b.pressed) down.add(i);
      });
      let active = false;
      for (const [i, action] of Object.entries(BUTTONS)) {
        const n = Number(i);
        if (down.has(n)) active = true;
        if (was.buttons.has(n) && !down.has(n)) {
          h.used(pad.index);
          h.button(action); // on release (GDD §5)
        }
      }
      for (const [dir, button, axis, sign] of DIRS) {
        const on = down.has(button) || (pad.axes[axis] ?? 0) * sign > STICK;
        if (!on) {
          was.repeat.delete(dir);
          continue;
        }
        active = true;
        const due = was.repeat.get(dir);
        if (due === undefined || now >= due) {
          h.used(pad.index);
          h.move(dir);
          was.repeat.set(dir, now + (due === undefined ? REPEAT_FIRST : REPEAT_NEXT));
        }
      }
      const rx = pad.axes[2] ?? 0;
      const ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > DEAD && dt > 0) {
        h.used(pad.index);
        h.camera(rx, ry, dt);
      } else if (active) h.used(pad.index);
      held.set(pad.index, { buttons: down, repeat: was.repeat });
    }
    win.requestAnimationFrame(poll);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = 0;
    win.requestAnimationFrame(poll);
  };
  win.addEventListener("gamepadconnected", start);
  // A controller connected before the page loaded shows up at its first button press.
  if (win.navigator.getGamepads?.().some((p) => p?.connected)) start();
}

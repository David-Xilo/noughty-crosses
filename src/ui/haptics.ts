// Haptics (GDD §7, optional): a short tap when a piece is placed and a double tap on a win,
// through the controller used last, or the phone's vibration on a touch screen.
let enabled = true;
let padIndex: number | null = null;

export function setHaptics(on: boolean): void {
  enabled = on;
}

/** The controller that was used last, which rumbles; null after other input. */
export function setHapticPad(index: number | null): void {
  padIndex = index;
}

/** Pulses of [start ms, length ms, strength 0–1]. */
function pulse(parts: ReadonlyArray<readonly [number, number, number]>) {
  if (!enabled) return;
  const pad = padIndex === null ? null : navigator.getGamepads?.()[padIndex];
  const actuator = pad?.vibrationActuator;
  if (actuator) {
    for (const [startDelay, duration, s] of parts)
      void actuator
        .playEffect("dual-rumble", { startDelay, duration, strongMagnitude: s, weakMagnitude: s })
        .catch(() => {});
    return;
  }
  if (matchMedia("(pointer: coarse)").matches && navigator.vibrate) {
    // vibrate() takes alternating on and off times.
    const pattern: number[] = [];
    let at = 0;
    for (const [start, duration] of parts) {
      if (pattern.length) pattern.push(start - at);
      pattern.push(duration);
      at = start + duration;
    }
    navigator.vibrate(pattern);
  }
}

export const haptics = {
  place() {
    pulse([[0, 25, 0.35]]);
  },
  win() {
    pulse([
      [0, 60, 0.6],
      [130, 60, 0.6],
    ]);
  },
};

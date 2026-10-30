// The Linux desktop app's web view (WebKitGTK) has no Gamepad API, so the app reads the
// controllers and sends each change as a "pads" event (P20, src-tauri/src/pads.rs). This
// gives the page navigator.getGamepads() and "gamepadconnected" from those events, in the
// standard layout, so ./gamepad.ts reads them like any other controller.

interface NativePad {
  index: number;
  id: string;
  buttons: number[];
  axes: number[];
}

interface TauriEvents {
  event: { listen(name: string, f: (e: { payload: NativePad[] }) => void): unknown };
}

export function nativePads(win: Window): void {
  const tauri = (win as { __TAURI__?: TauriEvents }).__TAURI__;
  if (!tauri || "getGamepads" in win.navigator) return;
  let pads: Gamepad[] = [];
  Object.defineProperty(win.navigator, "getGamepads", { value: () => pads, configurable: true });
  tauri.event.listen("pads", ({ payload }) => {
    const known = new Set(pads.map((p) => p.index));
    pads = [];
    for (const p of payload) {
      pads[p.index] = {
        index: p.index,
        id: p.id,
        connected: true,
        mapping: "standard",
        timestamp: win.performance.now(),
        axes: p.axes,
        buttons: p.buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })),
        vibrationActuator: null,
      } as unknown as Gamepad;
    }
    if (payload.some((p) => !known.has(p.index))) win.dispatchEvent(new Event("gamepadconnected"));
  });
}

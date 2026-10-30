// The table's camera (GDD §5): the orbit within limits, its framing for each kind of board,
// the projection into the board area beside the panel, the eased steps for keys and sticks,
// and Ultimate's close-in on a phone (GDD §3.6).
import type { DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { boardAt, CELL, layerHeight } from "./models";

/** What the camera needs from the table (table.ts). */
interface CameraHost {
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  /** The board group: the framing reads its scale and height. */
  readonly board: THREE.Group;
  /** Kept on the cube when it is framed; null without depth of field. */
  readonly dof: DepthOfFieldEffect | null;
  /** The boards as set down. */
  shape(): { boards: number; columns: number; size: number; upright: boolean; cube: boolean };
  /** Ultimate: the one board the next move must go on, or null when any will do or the game ended. */
  onlyTarget(): number | null;
  animate(ms: number, step: (t: number) => void): void;
  requestRender(): void;
}

export function createCamera({
  camera,
  canvas,
  board,
  dof,
  shape,
  onlyTarget,
  animate,
  requestRender,
}: CameraHost) {
  // Three-quarter view, limited tilt and rotation so the board stays readable.
  const controls = new OrbitControls(camera, canvas);
  /** The board's centre as framed; Ultimate on a phone closes in on one board from it. */
  const home = new THREE.Vector3();
  let focused = -1; // Ultimate: the board the camera has closed in on, or -1
  let focusZoom = 1;
  let focusToken = 0;
  controls.enablePan = false;
  controls.minDistance = 0.55;
  controls.maxDistance = 1.1;
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(-35);
  controls.maxAzimuthAngle = THREE.MathUtils.degToRad(35);
  // GDD §5: the left button and one finger place pieces; right-drag, the wheel and two
  // fingers move the camera; a middle click resets it.
  controls.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.enableDamping = false;

  /**
   * Frames the camera: from 45° above a flat board, from 20° above the upright board's
   * centre, from 32° above the cube's centre, and keeps the cube in focus. Only a switch
   * between them calls it, so the player's view is kept otherwise.
   */
  const frame = () => {
    const { size, upright, cube } = shape();
    const middle = layerHeight((size - 1) / 2) * board.scale.y;
    const target = new THREE.Vector3(0, upright ? board.position.y : cube ? middle : 0.01, 0);
    const polar = THREE.MathUtils.degToRad(upright ? 70 : cube ? 58 : 45);
    // The upright board stands clear of the panel; the cube is taller than a board.
    const distance = upright ? 1 : cube ? 1.05 : 0.877;
    home.copy(target);
    focusToken++; // a close-in still easing would undo the new framing
    focused = -1;
    camera.zoom = focusZoom = 1;
    camera.updateProjectionMatrix();
    controls.target.copy(target);
    camera.position.set(0, Math.cos(polar), Math.sin(polar)).multiplyScalar(distance).add(target);
    controls.minPolarAngle = polar - THREE.MathUtils.degToRad(20);
    controls.maxPolarAngle = Math.min(
      polar + THREE.MathUtils.degToRad(12),
      THREE.MathUtils.degToRad(upright ? 84 : 72),
    );
    controls.enableZoom = !cube; // the wheel changes the cube's layer instead
    if (dof) {
      dof.cocMaterial.focusDistance = cube ? distance : 0.85;
      dof.cocMaterial.focusRange = cube ? 0.6 : 0.32; // the cube is deeper than a board
    }
    controls.update();
    controls.saveState();
  };
  controls.addEventListener("change", requestRender);
  frame();

  // Camera steps for keys, buttons and the right stick (GDD §5), scaled by the sensitivity.
  const STEP_TURN = THREE.MathUtils.degToRad(10);
  const STEP_TILT = THREE.MathUtils.degToRad(8);
  let speed = 1;
  const sph = new THREE.Spherical();
  /** Where the camera is heading; a newer move replaces an older one still easing. */
  let aim: { theta: number; phi: number; radius: number; token: number } | null = null;
  let token = 0;
  const current = () => sph.setFromVector3(camera.position.clone().sub(controls.target));
  const orbitTo = (theta: number, phi: number, radius: number, ease: boolean) => {
    const clamp = THREE.MathUtils.clamp;
    const from = { ...current() };
    const to = {
      theta: clamp(theta, controls.minAzimuthAngle, controls.maxAzimuthAngle),
      phi: clamp(phi, controls.minPolarAngle, controls.maxPolarAngle),
      radius,
    };
    const mine = ++token;
    aim = { ...to, token: mine };
    const set = (t: number) => {
      if (mine !== token) return;
      const k = 1 - (1 - t) ** 3;
      const lerp = (a: number, b: number) => a + (b - a) * k;
      sph.set(lerp(from.radius, to.radius), lerp(from.phi, to.phi), lerp(from.theta, to.theta));
      camera.position.setFromSpherical(sph).add(controls.target);
      camera.lookAt(controls.target);
      if (t >= 1) aim = null;
    };
    if (ease) animate(400, set);
    else {
      set(1);
      requestRender();
    }
  };

  /** The board area, in CSS pixels from the viewport; null for the whole canvas. */
  let area: { x: number; y: number; width: number; height: number } | null = null;
  /** Sizes the board's projection to the board area. */
  const project = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    camera.aspect = w / h;
    const c = canvas.getBoundingClientRect();
    const f =
      area && area.width >= 1 && area.height >= 1
        ? { x: area.x - c.left, y: area.y - c.top, w: area.width, h: area.height }
        : { x: 0, y: 0, w, h };
    // Frame the 40 cm board at about 80% of the area's narrower side on portrait screens.
    const fov = f.w < f.h ? 38 * Math.min(1.9, f.h / f.w / 1.1) : 38;
    // The same scale in the canvas as that field of view gives in the area, centred on the
    // area: the board stands beside the panel, never under it (TTT-4.4.2).
    const half = Math.atan((Math.tan(THREE.MathUtils.degToRad(fov / 2)) * h) / f.h);
    camera.fov = Math.min(120, THREE.MathUtils.radToDeg(2 * half));
    camera.setViewOffset(w, h, w / 2 - (f.x + f.w / 2), h / 2 - (f.y + f.h / 2), w, h);
    camera.updateProjectionMatrix();
    requestRender();
  };

  // Ultimate on a phone (GDD §3.6): where the nine boards leave cells under Android's 48 dp
  // touch target, the camera closes in on the target board until its cells are 56 px deep,
  // and draws back to all nine when any board will do or the game ends.
  const TOUCH = 48;
  const CLOSE = 56;
  /**
   * A cell's shorter side on screen in CSS pixels, with the camera drawn back: its depth,
   * foreshortened by the camera's tilt.
   */
  const cellPixels = () => {
    const d = camera.position.distanceTo(controls.target);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const width = (CELL * board.scale.x * canvas.clientHeight) / (2 * d * tan);
    return width * Math.cos(current().phi);
  };
  const focus = (ease: boolean) => {
    const px = cellPixels();
    const only = onlyTarget();
    const one = only !== null && px < TOUCH;
    const b = one ? only : -1;
    const zoom = one ? CLOSE / px : 1;
    if (b === focused && Math.abs(zoom - focusZoom) < 0.01) return;
    focused = b;
    focusZoom = zoom;
    const to = home.clone();
    if (one) {
      const { boards, columns } = shape();
      board.updateMatrixWorld();
      const at = boardAt(b, boards, columns);
      const c = board.localToWorld(new THREE.Vector3(at.x, 0, at.z));
      to.x = c.x;
      to.z = c.z;
    }
    const from = controls.target.clone();
    const z0 = camera.zoom;
    const mine = ++focusToken;
    const set = (t: number) => {
      if (mine !== focusToken) return;
      const k = 1 - (1 - t) ** 3;
      // The camera moves with its target, so its turn and tilt are kept.
      const offset = camera.position.clone().sub(controls.target);
      controls.target.lerpVectors(from, to, k);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
      camera.zoom = z0 + (zoom - z0) * k;
      camera.updateProjectionMatrix();
    };
    if (ease) animate(400, set);
    else {
      set(1);
      requestRender();
    }
  };

  return {
    controls,
    /** Frames a new kind of board; a camera move still easing would undo it, so it stops. */
    reframe() {
      token++;
      aim = null;
      frame();
    },
    project,
    setArea(a: typeof area) {
      area = a;
      project();
    },
    /** Closes in on Ultimate's one target board, or draws back (GDD §3.6). */
    focus,
    /** A new game: a close-in it cut short is forgotten, so the next focus starts from here. */
    unfocus() {
      focused = -2;
    },
    reset() {
      const to = new THREE.Spherical().setFromVector3(
        controls.position0.clone().sub(controls.target0),
      );
      orbitTo(to.theta, to.phi, to.radius, true);
    },
    turn(x: number, y: number, ease: boolean) {
      const from = aim ?? current();
      orbitTo(
        from.theta + x * STEP_TURN * speed,
        from.phi + y * STEP_TILT * speed,
        from.radius,
        ease,
      );
    },
    setSpeed(f: number) {
      speed = f;
      controls.rotateSpeed = f;
      controls.zoomSpeed = f;
    },
    /** The camera's rotation (theta) and its angle from straight above (phi), in radians. */
    angles: () => current(),
  };
}

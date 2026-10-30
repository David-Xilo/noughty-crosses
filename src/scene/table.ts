// The crafted tabletop scene (docs/style-guide.md, "Scene" and "Lighting and rendering").
// Renders on demand: a frame is drawn only after a change, a camera move or a resize.
import {
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from "postprocessing";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { highContrast } from "../ui/tokens";
import { type BoardModel, EMPTY_BOARD, lineAcross } from "./board-model";
import { createCamera } from "./camera";
import { createMaterials } from "./materials";
import {
  BOARD_PITCH,
  BOARD_TOP,
  beadGeometry,
  boardAt,
  CELL,
  CLAIM_SCALE,
  cellCentre,
  createBoards,
  cubeCentre,
  layerGridGeometry,
  layerHeight,
  mergeCopies,
  NEST_SCALE,
  O_HEIGHT,
  oGeometry,
  oRimGeometry,
  targetGeometry,
  xGeometry,
} from "./models";
import type { Quality } from "./quality";
import { createSaucer } from "./saucer";

type Side = "X" | "O";

/**
 * Notakto's and Ultimate's boards shrink to share the space of one: a row of them spans
 * about 50 cm. The Big board and Gravity's board shrink to 40 cm across, about the 3 by 3
 * board, and their pieces with them.
 */
const boardScale = (size: number, columns: number) =>
  size > 3
    ? 0.4 / (size * CELL + 0.06)
    : columns === 1
      ? 1
      : 0.5 / (columns * 0.42 + (columns - 1) * (BOARD_PITCH - 0.42));

export interface TableView {
  /** Shows a position; `placed` is the cell just played, which drops into place. */
  show(model: BoardModel, placed?: number): void;
  /**
   * The keyboard or pointer cursor, with a ghost of the piece that would be placed; in
   * Nesting at its `size`, 0 small to 2 large (NE1).
   */
  setCursor(cell: number | null, ghost: Side | null, size?: number): void;
  /** A board cell was clicked or tapped (on release, GDD §5). */
  onPick: ((cell: number) => void) | null;
  /** The pointer moved over a cell, or off the board (null). */
  onHover: ((cell: number | null) => void) | null;
  /** Pauses all drawing while the table is hidden (the 2D setting). */
  setActive(on: boolean): void;
  /**
   * The free part of the screen beside the panel (the board area), in CSS pixels from the
   * viewport. The board is centred and sized in it; null frames it in the whole canvas.
   */
  setFrame(area: { x: number; y: number; width: number; height: number } | null): void;
  /**
   * Cube: the active layer, from the bottom. Picking reads only its cells, and the other
   * layers dim. The wheel over the table moves it up or down (GDD §3.8).
   */
  setLayer(layer: number): void;
  resetCamera(): void;
  /**
   * Turns the camera by steps of rotation (x, + to the right) and tilt (y, + lower), within
   * its limits; eased over 400 ms unless `ease` is false or motion is reduced (GDD §5).
   */
  turnCamera(x: number, y: number, ease?: boolean): void;
  /** Camera sensitivity: 1 is the default, for dragging, the wheel, keys and sticks. */
  setCameraSpeed(f: number): void;
  setReducedMotion(on: boolean): void;
  /** The high-contrast piece set on a desaturated board (style guide, "Pieces"). */
  setContrast(on: boolean): void;
  /** Screen positions of the cell centres in CSS pixels (scripted playthroughs). */
  cellPoints(): Array<{ x: number; y: number }>;
  /**
   * Animates the camera for `frames` frames. Returns the frame intervals (capped by vsync)
   * and the render cost per frame: CPU time plus `gl.finish()` waiting for the GPU.
   */
  measureOrbit(frames: number): Promise<{ intervals: number[]; costs: number[] }>;
  stats(): {
    renders: number;
    drawCalls: number;
    triangles: number;
    gpu: string;
    pieces: number;
    /** The camera's rotation and its angle from straight above, in degrees. */
    azimuth: number;
    polar: number;
  };
}

export async function createTable(canvas: HTMLCanvasElement, q: Quality): Promise<TableView> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // SMAA in post
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(q.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // done by the ToneMappingEffect
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = q.gfx === "high" ? THREE.VSMShadowMap : THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0d0907");
  scene.fog = new THREE.FogExp2("#0d0907", 1.1);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 20);

  // Environment: one CC0 interior HDRI at low intensity for fill and reflections.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new HDRLoader().loadAsync("./assets/env_lythwood_lounge_1k.hdr");
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.environmentIntensity = 0.16;
  hdr.dispose();
  pmrem.dispose();

  // Hero light: one warm desk lamp (about 2,700 K) from the upper left, the only shadow caster.
  const lamp = new THREE.SpotLight("#ffd0a0", 13, 4, 0.4, 0.8, 1.8);
  lamp.position.set(-0.75, 1.15, 0.35);
  lamp.target.position.set(0.02, 0, -0.02);
  lamp.castShadow = true;
  lamp.shadow.mapSize.setScalar(q.shadowMapSize);
  lamp.shadow.camera.near = 0.4;
  lamp.shadow.camera.far = 2.2;
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.002;
  lamp.shadow.radius = q.gfx === "high" ? 7 : 2;
  lamp.shadow.blurSamples = 16;
  scene.add(lamp, lamp.target);
  scene.add(new THREE.HemisphereLight("#c9d6e8", "#0b0705", 0.08));

  // Table: baize inside a walnut frame, the board in the middle.
  const m = await createMaterials();
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), m.felt);
  felt.rotation.x = -Math.PI / 2;
  felt.receiveShadow = true;
  // The frame and its raised rim are one merged mesh (one draw call). The rim is outside the
  // lamp's shadow camera, so it casts nothing.
  const frame = new THREE.Mesh(
    mergeCopies([
      { geo: new THREE.BoxGeometry(3.4, 0.06, 3.4), at: new THREE.Vector3(0, -0.031, 0) },
      ...(
        [
          [0, -0.95, 2.2, 0.08],
          [0, 0.95, 2.2, 0.08],
          [-1.06, 0, 0.08, 1.98],
          [1.06, 0, 0.08, 1.98],
        ] as const
      ).map(([x, z, w, d]) => ({
        geo: new THREE.BoxGeometry(w, 0.05, d),
        at: new THREE.Vector3(x, 0.02, z),
      })),
    ]),
    m.frame,
  );
  frame.receiveShadow = true;
  // The board group holds the boards and everything on them, in the boards' own
  // coordinates (top face up, row 1 at -z). Notakto and Ultimate rebuild the boards and
  // scale the group when the board count changes; Gravity stands the group on its row-6
  // edge.
  const board = new THREE.Group();
  let boards = 1;
  let size = 3;
  let upright = false;
  let columns = 1;
  /** Cube: the board is the cube's base, and the cells float in layers above it. */
  let cube = false;
  let layer = 0;
  let boardMeshes = createBoards(m, boards, size);
  board.add(boardMeshes);
  scene.add(frame, felt, board);
  let built = 0; // board rebuilds: a growth still easing stops at the next one
  const setBoards = (n: number, s: number, up: boolean, cols: number, cu: boolean) => {
    if (cu) n = cols = 1; // the cube's layers stand on one base board
    if (n === boards && s === size && up === upright && cols === columns && cu === cube) return;
    built++;
    const turned = up !== upright || cu !== cube;
    boards = n;
    size = s;
    upright = up;
    columns = cols;
    cube = cu;
    board.remove(boardMeshes);
    boardMeshes.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    boardMeshes = createBoards(m, n, s, up, cols);
    board.add(boardMeshes);
    layerGrid.geometry.dispose();
    layerGrid.geometry = layerGridGeometry(s);
    layerGlass.scale.setScalar(s * CELL);
    layerGrid.visible = layerGlass.visible = beads.visible = cu;
    // A new kind of board starts on the bottom layer; a shrunk cube (undo) keeps a real one.
    layer = turned ? 0 : Math.min(layer, s - 1);
    placeLayer();
    placeBoard();
    syncTurn();
    if (turned) {
      cam.reframe();
    }
    // The larger boards' pieces are drawn small: fewer bevel steps and sides keep a full
    // board under 30k triangles (GDD §11); Gravity's 36 pieces, Ultimate's up to 81 and
    // the cube's up to 125 need the fewest.
    const tier = n > 3 || cu ? 3 : s > 5 ? 2 : s > 3 ? 1 : 0;
    xMesh.geometry = xGeos[tier];
    oMesh.geometry = oGeos[tier];
    rimMesh.geometry = rimGeos[tier];
  };

  // Pieces: one instanced mesh per kind (style guide: "instanced"). The thin gold rim casts
  // no visible shadow.
  const xGeo = xGeometry();
  const oGeo = oGeometry();
  const rimGeo = oRimGeometry();
  const xLight = xGeometry(3);
  const oLight = oGeometry(20, 2);
  const rimLight = oRimGeometry(20);
  const xLightest = xGeometry(2);
  const oLightest = oGeometry(16, 1);
  const rimLightest = oRimGeometry(16);
  const xTiny = xGeometry(1);
  const oTiny = oGeometry(12, 1);
  const rimTiny = oRimGeometry(12);
  const xGeos = [xGeo, xLight, xLightest, xTiny] as const;
  const oGeos = [oGeo, oLight, oLightest, oTiny] as const;
  const rimGeos = [rimGeo, rimLight, rimLightest, rimTiny] as const;
  // Cube: at most 63 marks of one side on the 5×5×5 cube (Ultimate: 41).
  const PIECES = 63;
  const xMesh = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>(
    xGeo,
    m.xGlaze,
    PIECES,
  );
  const oMesh = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>(
    oGeo,
    m.oLacquer,
    PIECES,
  );
  // The rims have their own brass, which high contrast turns white.
  const rimMat = m.brass.clone();
  const rimMesh = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>(
    rimGeo,
    rimMat,
    PIECES,
  );
  for (const mesh of [xMesh, oMesh, rimMesh]) {
    // An instanced mesh caches its bounding sphere at the first render, when the board is
    // still empty; that would cull every later piece. The pieces are always on screen.
    mesh.frustumCulled = false;
    mesh.castShadow = mesh !== rimMesh;
    mesh.receiveShadow = true;
    mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // per-piece tint: win glow, loser dim
    board.add(mesh);
  }

  // The marks about to vanish (V6): frosted, translucent copies, at most one per side.
  const frost = (base: THREE.MeshPhysicalMaterial) => {
    const f = base.clone();
    f.transparent = true;
    f.opacity = 0.3;
    f.depthWrite = false;
    f.roughness = 0.6;
    return f;
  };
  const xFade = new THREE.Mesh(xGeo, frost(m.xGlaze));
  const oFade = new THREE.Mesh(oGeo, frost(m.oLacquer));
  // The cursor: a brass ring on the cell, and a ghost of the piece that would be placed.
  const cursor = new THREE.Mesh(
    new THREE.RingGeometry(CELL * 0.43, CELL * 0.47, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#f2c46d", transparent: true, opacity: 0.85 }),
  );
  const ghostMat = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const ghost = new THREE.Mesh(xGeo, ghostMat);
  // The win line: a brass bar along the three winning cells.
  const winBar = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.004, 0.008), // scaled to the line's length when shown
    new THREE.MeshStandardMaterial({
      color: "#f2c46d",
      emissive: "#f2c46d",
      emissiveIntensity: 1.6,
      metalness: 0.6,
      roughness: 0.3,
    }),
  );
  for (const o of [xFade, oFade, cursor, ghost, winBar]) {
    o.visible = false;
    board.add(o);
  }
  // Ultimate: a brass glow around each board the side to move may play in (GDD §3.6). It
  // casts no shadow; bloom on high makes it glow.
  const targetMesh = new THREE.InstancedMesh(
    targetGeometry(),
    new THREE.MeshStandardMaterial({
      color: "#3a2a10",
      emissive: "#f2c46d",
      emissiveIntensity: 1.3,
      roughness: 0.5,
    }),
    9,
  );
  targetMesh.count = 0;
  targetMesh.frustumCulled = false;
  board.add(targetMesh);

  // Cube (GDD §3.8): a bead on each empty cell of the lattice, one instanced mesh; the
  // active layer's brass grid on a faint glass pane. None of them casts a shadow.
  const beads = new THREE.InstancedMesh(
    beadGeometry(),
    new THREE.MeshBasicMaterial({ color: "#f2c46d" }),
    125,
  );
  beads.count = 0;
  beads.frustumCulled = false;
  beads.setColorAt(0, new THREE.Color(1, 1, 1));
  const layerGrid = new THREE.Mesh(layerGridGeometry(size), m.brass);
  const layerGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), // scaled to the layer's span
    new THREE.MeshStandardMaterial({
      color: "#f2c46d",
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  for (const o of [beads, layerGrid, layerGlass]) {
    o.visible = false;
    board.add(o);
  }
  /** Moves the grid and the glass to the active layer, just under its pieces. */
  const placeLayer = () => {
    layerGrid.position.y = layerHeight(layer) - 0.001;
    layerGlass.position.y = layerHeight(layer) - 0.0015;
  };

  // Saucer (GDD §3.8, S3). The arrows reach functions declared further down.
  const saucer = createSaucer({
    board,
    piece: {
      x: { geometry: xGeo, material: m.xGlaze },
      o: { geometry: oGeo, material: m.oLacquer },
      rim: { geometry: rimGeo, material: rimMat },
    },
    waits: () => !!model.saucerWaits,
    centre: (i) => centre(i),
    twist: (i) => twist(i),
    animate: (ms, step) => animate(ms, step),
    layout: () => layout(),
  });

  // Post-processing (style guide, by graphics level).
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const effects = [];
  const dof = q.depthOfField
    ? new DepthOfFieldEffect(camera, { focusDistance: 0.85, focusRange: 0.32, bokehScale: 2.2 })
    : null;
  if (dof) effects.push(dof);
  if (q.bloom) {
    effects.push(
      new BloomEffect({
        luminanceThreshold: 0.92,
        luminanceSmoothing: 0.08,
        intensity: 0.45,
        mipmapBlur: true,
        levels: 5, // a short, subtle glow; each level costs two passes (draw-call budget)
      }),
    );
  }
  effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.55 }));
  effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
  composer.addPass(new EffectPass(camera, ...effects));
  composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));

  /**
   * Sets the board group down: flat with a small turn, as a board set down by hand is never
   * perfectly square; or upright on its feet, facing the player.
   */
  const placeBoard = () => {
    const s = boardScale(size, columns);
    board.scale.setScalar(s);
    board.rotation.set(upright ? Math.PI / 2 : 0, -0.06, 0, "YXZ");
    board.position.set(0, 0, 0);
    if (upright) {
      board.updateMatrixWorld(true);
      board.position.y = -new THREE.Box3().setFromObject(boardMeshes).min.y;
    }
  };
  let renders = 0;
  let pending = false;
  renderer.info.autoReset = false; // count every pass of a frame, not just the last one
  // Running animations: each returns false once finished. Frames are drawn only while one
  // runs, or after a change (render on demand).
  const anims = new Set<(now: number) => boolean>();
  const render = () => {
    renderer.info.reset();
    composer.render();
    renders++;
  };
  const drawFrame = (now: number) => {
    pending = false;
    for (const a of anims) if (!a(now)) anims.delete(a);
    render();
    if (anims.size > 0) requestRender();
  };
  let active = true; // false while the 2D board replaces the table
  const requestRender = () => {
    if (active && !pending) {
      pending = true;
      requestAnimationFrame(drawFrame);
    }
  };
  /** Runs `step(t)` with t from 0 to 1 over `ms`; at once under reduced motion. */
  const animate = (ms: number, step: (t: number) => void) => {
    if (q.reducedMotion) {
      step(1);
      requestRender();
      return;
    }
    let start = -1;
    anims.add((now) => {
      if (start < 0) start = now;
      const t = Math.min(1, (now - start) / ms);
      step(t);
      return t < 1;
    });
    requestRender();
  };
  // Cube: the cube turns slowly to and fro, so the eye reads its depth; the one exception to
  // render on demand (GDD §3.8). It stops under reduced motion and in the 2D setting.
  const TURN = 0.2; // radians each way
  const TURN_PERIOD = 30_000; // ms
  let turning = false;
  const turn = (now: number) => {
    board.rotation.y = -0.06 + (turning ? TURN * Math.sin((now / TURN_PERIOD) * Math.PI * 2) : 0);
    return turning;
  };
  const syncTurn = () => {
    const on = active && cube && !q.reducedMotion;
    if (on === turning) return;
    turning = on;
    if (on) anims.add(turn);
    requestRender(); // a turn that stops sets the cube square on its last frame
  };
  placeBoard();
  const cam = createCamera({
    camera,
    canvas,
    board,
    dof,
    shape: () => ({ boards, columns, size, upright, cube }),
    onlyTarget: () =>
      boards === 9 && !model.outcome && model.targets.length === 1
        ? (model.targets[0] as number)
        : null,
    animate,
    requestRender,
  });

  // A finger's double tap on the empty table resets the camera (GDD §5).
  let lastTap = 0;

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h, false);
    cam.project();
  };
  resize();

  const dummy = new THREE.Object3D();
  // The normal colours, which high contrast replaces and gives back.
  const colours = {
    x: m.xGlaze.color.clone(),
    pewter: m.pewter.color.clone(),
    o: m.oLacquer.color.clone(),
    rim: rimMat.color.clone(),
    board: m.board.color.clone(),
    edge: m.boardEdge.color.clone(),
  };
  const woodMap = m.board.map;
  let contrast = false;
  const gl = renderer.getContext();
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));

  // Pieces are placed by hand: a small, fixed twist per cell (not random).
  const twist = (i: number) => ((i * 37) % 11) * 0.02 - 0.1;
  /** A cell's centre on its board, or in the cube's lattice. */
  const centre = (i: number) => (cube ? cubeCentre(i, size) : cellCentre(i, boards, size, columns));
  /** Cube: the layer of cell `i`. */
  const layerOf = (i: number) => Math.floor(i / (size * size));
  /** `lift` raises a piece off the board's face; `fall` holds it up its column (upright). */
  const place = (o: THREE.Object3D, i: number, lift = 0, fall = 0, scale = 1) => {
    o.position.copy(centre(i));
    o.position.y += lift;
    o.position.z -= fall;
    o.rotation.set(0, twist(i), 0);
    o.scale.setScalar(scale);
    o.updateMatrix();
  };

  let model = EMPTY_BOARD;
  let drop = { cell: -1, lift: 0, fall: 0 };
  const white = new THREE.Color(1, 1, 1);
  const glow = new THREE.Color(1.9, 1.7, 1.3);
  const dim = new THREE.Color(0.55, 0.55, 0.55);
  /** Cube: the pieces and beads off the active layer, and the active layer's beads. */
  const faint = new THREE.Color(0.35, 0.35, 0.35);
  const beadOn = new THREE.Color(1, 1, 1);
  const beadOff = new THREE.Color(0.22, 0.22, 0.22);
  let winT = 0; // 0 to 1: how far the win glow and the brass sweep have run

  /** Rebuilds the piece instances from the model. */
  const layout = () => {
    let nx = 0;
    let no = 0;
    const tint = new THREE.Color();
    xFade.visible = oFade.visible = false;
    xMesh.material = model.neutral ? m.pewter : m.xGlaze;
    const per = size * size;
    // Ultimate: a claimed board shows one large piece of its side on its centre cell, in
    // place of its marks (U4); the move that claims it drops the large piece.
    const pieces: Array<[Side, number, number]> = [];
    // Nesting: a piece shows at its size, and only the top piece of a cell shows (NE1, NE3).
    model.cells.forEach((c, i) => {
      if (c && !model.claimed[Math.floor(i / per)])
        pieces.push([c, i, NEST_SCALE[model.sizes?.[i] ?? 2] ?? 1]);
    });
    model.claimed.forEach((c, b) => {
      if (c) pieces.push([c, b * per + Math.floor(per / 2), CLAIM_SCALE]);
    });
    const inBeam = saucer.inBeam();
    for (const [c, i, scale] of pieces) {
      if (i === inBeam) continue; // Saucer: the piece is still in the beam (S3)
      if (model.fading.includes(i)) {
        const f = c === "X" ? xFade : oFade;
        place(f, i);
        f.visible = true;
        continue;
      }
      const dropping =
        scale > 1 ? Math.floor(drop.cell / per) === Math.floor(i / per) : i === drop.cell;
      // Three men's morris: the piece picked up to slide is held above its cell (TM2).
      const held = model.selected === i ? 0.02 : 0;
      if (dropping) place(dummy, i, drop.lift, drop.fall, scale);
      else place(dummy, i, held, 0, scale);
      tint.copy(held ? glow : white);
      const dead = model.dead[Math.floor(i / per)];
      if (model.outcome === "win" && model.line)
        tint.lerp(model.line.includes(i) ? glow : dim, winT);
      else if (dead && scale <= 1)
        tint.copy(dim); // a dead board's marks are muted (N2, U4)
      else if (cube && !model.outcome && layerOf(i) !== layer) tint.copy(faint);
      if (c === "X") {
        xMesh.setMatrixAt(nx, dummy.matrix);
        xMesh.setColorAt(nx++, tint);
      } else {
        oMesh.setMatrixAt(no, dummy.matrix);
        oMesh.setColorAt(no, tint);
        rimMesh.setMatrixAt(no, dummy.matrix);
        rimMesh.setColorAt(no++, tint);
      }
    }
    xMesh.count = nx;
    oMesh.count = rimMesh.count = no;
    // Cube: a bead on each empty cell, bright on the active layer.
    let nb = 0;
    if (cube)
      model.cells.forEach((c, i) => {
        if (c) return;
        place(dummy, i);
        beads.setMatrixAt(nb, dummy.matrix);
        beads.setColorAt(nb++, layerOf(i) === layer && !model.outcome ? beadOn : beadOff);
      });
    beads.count = nb;
    for (const mesh of [xMesh, oMesh, rimMesh, beads]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    requestRender();
  };

  new ResizeObserver(() => {
    resize();
    cam.focus(false);
  }).observe(canvas);

  // V6 pulse: a slow breathing of the frosted marks at about 12 frames a second, on high
  // only and never under reduced motion. Off when no mark is fading.
  let pulse = 0;
  const syncPulse = () => {
    const on =
      active && q.gfx === "high" && !q.reducedMotion && model.fading.length > 0 && !model.outcome;
    if (on && !pulse) {
      pulse = window.setInterval(() => {
        const o = 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(performance.now() / 260));
        (xFade.material as THREE.Material).opacity = o;
        (oFade.material as THREE.Material).opacity = o;
        requestRender();
      }, 80);
    } else if (!on && pulse) {
      window.clearInterval(pulse);
      pulse = 0;
    }
  };

  const lampFull = lamp.intensity;
  const showOutcome = () => {
    if (model.outcome === "win" && model.line) {
      const a = centre(model.line[0] as number);
      const b = centre(model.line.at(-1) as number);
      // Ultimate: a thicker bar across the boards, over the large pieces.
      const across = lineAcross(model);
      const thick = across ? 3 : 1;
      winBar.position.copy(a).lerp(b, 0.5);
      // Cube: over the pieces, so it shows in any of the 13 directions (C2).
      winBar.position.y += across ? O_HEIGHT * CLAIM_SCALE + 0.006 : cube ? O_HEIGHT : 0.002;
      winBar.quaternion.setFromUnitVectors(
        new THREE.Vector3(1, 0, 0),
        b.clone().sub(a).normalize(),
      );
      winBar.visible = true;
      const length = a.distanceTo(b) + 0.05; // diagonals are √2 longer than rows
      animate(600, (t) => {
        winT = t;
        winBar.scale.set(Math.max(0.01, t) * length, thick, thick);
        layout();
      });
    } else if (model.outcome === "draw") {
      animate(600, (t) => {
        lamp.intensity = lampFull * (1 - 0.4 * t);
      });
    }
  };

  // Picking: the ray from the pointer meets the boards' top plane, in the board group's own
  // coordinates, flat or upright (GDD §5: act on release).
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);
  const toBoard = new THREE.Matrix4();
  const hit = new THREE.Vector3();
  const cellAt = (e: MouseEvent): number | null => {
    const r = canvas.getBoundingClientRect();
    camera.updateMatrixWorld(); // rendering is on demand: the view may have changed since
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      ),
      camera,
    );
    board.updateMatrixWorld();
    toBoard.copy(board.matrixWorld).invert();
    // Cube: the plane of the active layer.
    plane.constant = -(cube ? layerHeight(layer) : BOARD_TOP);
    if (!ray.ray.applyMatrix4(toBoard).intersectPlane(plane, hit)) return null;
    // One board can be wider than the pitch (the Big board), so only several boards divide.
    const rows = Math.ceil(boards / columns);
    const bx = boards === 1 ? 0 : Math.round(hit.x / BOARD_PITCH + (columns - 1) / 2);
    const bz = rows === 1 ? 0 : Math.round(hit.z / BOARD_PITCH + (rows - 1) / 2);
    const b = bz * columns + bx;
    if (bx < 0 || bx >= columns || bz < 0 || bz >= rows || b >= boards) return null;
    const at = boardAt(b, boards, columns);
    const x = hit.x - at.x;
    const z = hit.z - at.z;
    const mid = (size - 1) / 2;
    const col = Math.round(x / CELL + mid);
    const row = Math.round(z / CELL + mid);
    if (Math.abs(x) > (CELL * size) / 2 || Math.abs(z) > (CELL * size) / 2) return null;
    return (cube ? layer : b) * size * size + row * size + col;
  };
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 0) down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (e.button !== 0 || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    const cell = cellAt(e);
    if (moved < 8 && cell !== null) view.onPick?.(cell);
    if (moved < 8 && cell === null && e.pointerType === "touch") {
      if (e.timeStamp - lastTap < 350) view.resetCamera();
      lastTap = e.timeStamp;
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") view.onHover?.(cellAt(e));
  });
  canvas.addEventListener("pointerleave", () => view.onHover?.(null));
  canvas.addEventListener("auxclick", (e) => {
    if (e.button === 1) view.resetCamera();
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  // Cube: the wheel moves the active layer up or down, under the pointer (GDD §3.8). A
  // trackpad or a fine wheel sends many small steps: one layer per notch's worth of them.
  let wheel = 0;
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!cube || e.deltaY === 0) return;
      e.preventDefault();
      const d = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : e.deltaY * 100;
      wheel = Math.sign(d) === Math.sign(wheel) ? wheel + d : d;
      if (Math.abs(wheel) < 100) return;
      view.setLayer(Math.min(size - 1, Math.max(0, layer + (wheel < 0 ? 1 : -1))));
      wheel = 0;
      view.onHover?.(cellAt(e));
    },
    { passive: false },
  );

  const view: TableView = {
    onPick: null,
    onHover: null,
    show(next, placed) {
      const ended = !model.outcome && next.outcome;
      // A new game after a finished one (a fair start opens with marks on the board).
      const fresh = !!model.outcome && !next.outcome;
      // Overtime: a move grew the board by a ring (O2); Cube: by a layer on the top, right
      // and back (C3). The bigger board first keeps the old cells' size, so the marks stay
      // put, then settles to its own size; the cube also slides back to the table's centre.
      const grew =
        placed !== undefined &&
        next.size > size &&
        (next.layers ? cube : next.dead.length === boards);
      const from = boardScale(size, columns);
      setBoards(
        next.dead.length,
        next.size,
        next.upright,
        next.columns ?? next.dead.length,
        next.layers,
      );
      if (grew) {
        const to = boardScale(size, columns);
        const mine = built;
        // The kept cells' shift on the grown cube: half a cell left and half a cell forward.
        const shift = new THREE.Vector3(-CELL / 2, 0, CELL / 2);
        animate(520, (t) => {
          if (built !== mine) return;
          const k = 1 - (1 - t) ** 3;
          const scale = from + (to - from) * k;
          board.scale.setScalar(scale);
          if (cube)
            board.position
              .copy(shift)
              .multiplyScalar(-scale * (1 - k))
              .applyQuaternion(board.quaternion);
        });
      }
      model = next;
      next.targets.forEach((b, k) => {
        const at = boardAt(b, boards, columns);
        dummy.position.set(at.x, 0, at.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        targetMesh.setMatrixAt(k, dummy.matrix);
      });
      targetMesh.count = next.targets.length;
      targetMesh.instanceMatrix.needsUpdate = true;
      if (fresh) {
        anims.clear(); // stop the last game's win sweep or lamp dimming
        cam.unfocus(); // and a close-in it cut short
        turning = false;
        syncTurn();
        winT = 0;
        winBar.visible = false;
        lamp.intensity = lampFull;
      }
      const v = next.visit;
      const flying = saucer.flying();
      if (flying >= 0 && (placed !== undefined || fresh || v?.ply !== flying)) saucer.end();
      if (placed !== undefined && v && v.from === placed) {
        saucer.fly(v);
      } else if (placed !== undefined && next.cells[placed]) {
        // Each drop owns its state: an older drop still running cannot move the new piece.
        // A flat board's piece falls onto it and settles with a small bounce; Gravity's
        // drops from above the board down its column, speeding up.
        const height = upright ? (Math.floor(placed / size) + 1.5) * CELL : 0;
        const d = { cell: placed, lift: 0, fall: 0 };
        drop = d;
        animate(upright ? 160 + 40 * (height / CELL) : 260, (t) => {
          const fall = 1 - t * t;
          if (upright) d.fall = height * fall;
          else d.lift = t < 1 ? 0.05 * fall + 0.004 * Math.sin(t * Math.PI) : 0;
          if (drop === d) layout();
        });
      } else {
        layout();
      }
      syncPulse();
      saucer.sync();
      if (ended) showOutcome();
      cam.focus(true);
    },
    setCursor(cell, piece, size = 2) {
      cursor.visible = cell !== null;
      ghost.visible = cell !== null && piece !== null;
      if (cell !== null) {
        place(cursor, cell);
        cursor.position.y += 0.0015;
        cursor.updateMatrix();
      }
      if (cell !== null && piece) {
        ghost.geometry = piece === "X" ? xMesh.geometry : oMesh.geometry;
        ghostMat.color.copy(
          (piece === "O" ? m.oLacquer : model.neutral ? m.pewter : m.xGlaze).color,
        );
        place(ghost, cell, 0.025, 0, NEST_SCALE[size]); // held above the board, unlike a fading mark
      }
      requestRender();
    },
    setActive(on) {
      if (active === on) return;
      active = on;
      syncPulse();
      syncTurn();
      requestRender();
    },
    setFrame(a) {
      cam.setArea(a);
      cam.focus(false);
    },
    setLayer(l) {
      if (l === layer || !cube) return;
      layer = l;
      placeLayer();
      layout();
    },
    resetCamera() {
      cam.reset();
    },
    turnCamera(x, y, ease = true) {
      cam.turn(x, y, ease);
    },
    setCameraSpeed(f) {
      cam.setSpeed(f);
    },
    setReducedMotion(on) {
      q.reducedMotion = on;
      syncPulse();
      syncTurn();
      requestRender();
    },
    setContrast(on) {
      if (on === contrast) return; // each change recompiles the board's shaders
      contrast = on;
      const set = (mat: THREE.MeshStandardMaterial, normal: THREE.Color, hc: string) =>
        mat.color.copy(on ? new THREE.Color(hc) : normal);
      set(m.xGlaze, colours.x, highContrast.xGlaze);
      set(m.pewter, colours.pewter, highContrast.xGlaze);
      set(m.oLacquer, colours.o, highContrast.oLacquer);
      set(rimMat, colours.rim, highContrast.oRim);
      (xFade.material as THREE.MeshStandardMaterial).color.copy(m.xGlaze.color);
      (oFade.material as THREE.MeshStandardMaterial).color.copy(m.oLacquer.color);
      for (const [mat, normal] of [
        [m.board, colours.board],
        [m.boardEdge, colours.edge],
      ] as const) {
        set(mat, normal, highContrast.board);
        mat.map = on ? null : woodMap; // a plain grey board, without the walnut's colour
        mat.needsUpdate = true;
      }
      requestRender();
    },
    cellPoints() {
      const r = canvas.getBoundingClientRect();
      camera.updateMatrixWorld();
      board.updateMatrixWorld();
      return Array.from({ length: size * size * (cube ? size : boards) }, (_, i) => {
        const p = board.localToWorld(centre(i)).project(camera);
        return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
      });
    },
    async measureOrbit(frames) {
      const intervals: number[] = [];
      const costs: number[] = [];
      const { controls } = cam;
      const start = controls.getAzimuthalAngle();
      const radius = Math.hypot(camera.position.x, camera.position.z);
      let last = 0;
      for (let f = 0; f < frames; f++) {
        const t = await new Promise<number>((r) => requestAnimationFrame(r));
        const a = start + Math.sin((f / frames) * Math.PI * 2) * THREE.MathUtils.degToRad(25);
        camera.position.set(Math.sin(a) * radius, camera.position.y, Math.cos(a) * radius);
        camera.lookAt(controls.target);
        const s = performance.now();
        render();
        gl.finish();
        costs.push(performance.now() - s);
        if (last) intervals.push(t - last);
        last = t;
      }
      controls.update();
      return { intervals, costs };
    },
    stats() {
      return {
        renders,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        gpu,
        pieces: xMesh.count + oMesh.count + (xFade.visible ? 1 : 0) + (oFade.visible ? 1 : 0),
        azimuth: THREE.MathUtils.radToDeg(cam.angles().theta),
        polar: THREE.MathUtils.radToDeg(cam.angles().phi),
      };
    },
  };
  return view;
}

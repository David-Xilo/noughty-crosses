// Procedural placeholder models for look development. Final models come from Blender (style guide).
// Units are metres: the board is 40 cm across, like a real wooden set.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Materials } from "./materials";

export const CELL = 0.12;
export const BOARD_TOP = 0.03;
/** Notakto and Ultimate: the distance between the centres of boards set side by side. */
export const BOARD_PITCH = 0.46;
/** The O ring's height; the X is lower. */
export const O_HEIGHT = 0.016;
/** Ultimate: a claimed board's large piece, as a multiple of a cell's piece. */
export const CLAIM_SCALE = 2.8;
/** Nesting: a small, medium and large piece, as multiples of a cell's piece (NE1). */
export const NEST_SCALE = [0.5, 0.75, 1] as const;

/**
 * The centre of board `b` of `boards`, laid out `columns` to a row (Notakto: one row;
 * Ultimate: 3 by 3), centred on the origin.
 */
export function boardAt(b: number, boards: number, columns = boards): { x: number; z: number } {
  const rows = Math.ceil(boards / columns);
  return {
    x: ((b % columns) - (columns - 1) / 2) * BOARD_PITCH,
    z: (Math.floor(b / columns) - (rows - 1) / 2) * BOARD_PITCH,
  };
}

/** Centre of cell i (row-major, size × size per board) on the boards' top surface. */
export function cellCentre(i: number, boards = 1, size = 3, columns = boards): THREE.Vector3 {
  const b = Math.floor(i / (size * size));
  const c = i % (size * size);
  const mid = (size - 1) / 2;
  const at = boardAt(b, boards, columns);
  return new THREE.Vector3(
    at.x + ((c % size) - mid) * CELL,
    BOARD_TOP,
    at.z + (Math.floor(c / size) - mid) * CELL,
  );
}

/**
 * Cube: the layers float over a base board, `CUBE_LIFT` above it and `CUBE_PITCH` apart, a
 * cell, so the cube reads as a cube from the table's camera.
 */
const CUBE_LIFT = 0.05;
const CUBE_PITCH = CELL;
/** Cube: the height of layer `l`'s cells, where its pieces rest, in board units. */
export const layerHeight = (l: number) => BOARD_TOP + CUBE_LIFT + l * CUBE_PITCH;

/**
 * Centre of cell i of a `size`-cube (layer by layer from the bottom, rows from the back,
 * columns from the left; rules C1), at the height where its piece rests.
 */
export function cubeCentre(i: number, size: number): THREE.Vector3 {
  const mid = (size - 1) / 2;
  return new THREE.Vector3(
    ((i % size) - mid) * CELL,
    layerHeight(Math.floor(i / size ** 2)),
    ((Math.floor(i / size) % size) - mid) * CELL,
  );
}

/** Merges copies of `geo`, one per transform, into one geometry (one draw call). */
export function mergeCopies(
  parts: ReadonlyArray<{ geo: THREE.BufferGeometry; at: THREE.Vector3; turn?: number }>,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4();
  return mergeGeometries(
    parts.map(({ geo, at, turn = 0 }) =>
      geo.clone().applyMatrix4(m.makeRotationY(turn).setPosition(at)),
    ),
  );
}

/**
 * The boards: a dark edge, the honey-walnut top and the brass grid, `size` cells a side.
 * Several boards (Notakto, Ultimate) are merged per material, so any count costs the same
 * three draw calls. An `upright` board (Gravity) gets two feet under its row of `size`
 * cells at high z, merged into the edge: the table stands it on that side. A grid of boards
 * (Ultimate) sits in a low tray, also merged into the edge.
 */
export function createBoards(
  m: Materials,
  boards = 1,
  size = 3,
  upright = false,
  columns = boards,
): THREE.Group {
  const g = new THREE.Group();
  const at = (b: number, y: number) => {
    const p = boardAt(b, boards, columns);
    return new THREE.Vector3(p.x, y, p.z);
  };
  const each = <T>(f: (b: number) => T[]) => Array.from({ length: boards }, (_, b) => f(b)).flat();
  const span = size * CELL; // 36 cm for 3 by 3
  // Ultimate's nine small boards round their corners in one step: at four steps the boards
  // alone would spend about 26k triangles with their shadows (GDD §11: 30k a frame).
  const steps = boards > 3 ? 1 : 4;
  const edgeGeo = new RoundedBoxGeometry(span + 0.06, 0.022, span + 0.06, steps, 0.008);
  const footGeo = new RoundedBoxGeometry(0.06, 0.18, 0.026, 2, 0.006);
  const feet = upright
    ? [-1, 1].map((x) => ({
        geo: footGeo,
        at: new THREE.Vector3(x * (span / 2 - 0.04), 0.011, (span + 0.06) / 2 + 0.013),
      }))
    : [];
  const rows = Math.ceil(boards / columns);
  const trayGeo =
    rows > 1
      ? new RoundedBoxGeometry(
          columns * BOARD_PITCH + 0.04,
          0.012,
          rows * BOARD_PITCH + 0.04,
          2,
          0.005,
        )
      : null;
  const tray = trayGeo ? [{ geo: trayGeo, at: new THREE.Vector3(0, 0.006, 0) }] : [];
  const edge = new THREE.Mesh(
    mergeCopies([...each((b) => [{ geo: edgeGeo, at: at(b, 0.011) }]), ...feet, ...tray]),
    m.boardEdge,
  );
  edge.castShadow = edge.receiveShadow = true;
  const topGeo = new RoundedBoxGeometry(span + 0.03, 0.012, span + 0.03, steps, 0.004);
  const top = new THREE.Mesh(
    mergeCopies(each((b) => [{ geo: topGeo, at: at(b, BOARD_TOP - 0.006) }])),
    m.board,
  );
  top.receiveShadow = true;
  // Inlaid brass grid: size - 1 bars each way, slightly proud of the surface. Too thin to
  // cast a visible shadow.
  const bar = new THREE.BoxGeometry(span, 0.0024, 0.0065);
  const bars = Array.from({ length: size - 1 }, (_, j) => (j + 1 - size / 2) * CELL);
  const y = BOARD_TOP + 0.0007;
  const grid = new THREE.Mesh(
    mergeCopies(
      each((b) =>
        bars.flatMap((o) => [
          { geo: bar, at: at(b, y).add(new THREE.Vector3(0, 0, o)) },
          { geo: bar, at: at(b, y).add(new THREE.Vector3(o, 0, 0)), turn: Math.PI / 2 },
        ]),
      ),
    ),
    m.brass,
  );
  grid.receiveShadow = true;
  for (const geo of [edgeGeo, footGeo, topGeo, bar, trayGeo]) geo?.dispose(); // merged copies remain
  g.add(edge, top, grid);
  return g;
}

/** A carved cross: a plus-shaped outline, extruded with a soft bevel, turned 45°. */
export function xGeometry(bevelSegments = 6): THREE.BufferGeometry {
  const w = 0.011; // half arm width
  const l = 0.043; // half arm length
  const s = new THREE.Shape();
  const pts: Array<[number, number]> = [
    [-w, l],
    [w, l],
    [w, w],
    [l, w],
    [l, -w],
    [w, -w],
    [w, -l],
    [-w, -l],
    [-w, -w],
    [-l, -w],
    [-l, w],
    [-w, w],
  ];
  const [[x0, y0], ...rest] = pts as [[number, number], ...Array<[number, number]>];
  s.moveTo(x0, y0);
  for (const [x, y] of rest) s.lineTo(x, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.0042,
    bevelSegments,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, 0.004, 0);
  return geo;
}

/**
 * A turned ring: a rounded-rectangle profile swept around the vertical axis. The Big
 * board's smaller pieces use fewer sides and corner steps (triangle budget, TTT-4.1.3).
 */
export function oGeometry(sides = 40, steps = 4): THREE.BufferGeometry {
  const inner = 0.022;
  const outer = 0.043;
  const height = O_HEIGHT;
  const r = 0.005;
  const profile: THREE.Vector2[] = [];
  const corner = (cx: number, cy: number, start: number) => {
    for (let k = 0; k <= steps; k++) {
      const a = start + (k / steps) * (Math.PI / 2);
      profile.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  corner(outer - r, r, -Math.PI / 2);
  corner(outer - r, height - r, 0);
  corner(inner + r, height - r, Math.PI / 2);
  corner(inner + r, r, Math.PI);
  const [first] = profile;
  if (first) profile.push(first.clone()); // close the profile
  return new THREE.LatheGeometry(profile, sides); // 40 sides: smooth at table distance, 30k-triangle budget
}

/** The thin gold line on top of the O (style guide: "a fine gold rim line"). */
export function oRimGeometry(sides = 40): THREE.BufferGeometry {
  const geo = new THREE.TorusGeometry(0.0325, 0.0011, 6, sides);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.0162, 0);
  return geo;
}

/** Cube: a small bead that marks an empty cell of the lattice (20 triangles). */
export function beadGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.0055, 0).translate(0, O_HEIGHT / 2, 0);
}

/** Cube: the active layer's brass grid, `size` cells a side with its outer edge, at height 0. */
export function layerGridGeometry(size: number): THREE.BufferGeometry {
  const span = size * CELL;
  const bar = new THREE.BoxGeometry(span + 0.003, 0.0016, 0.003);
  const offsets = Array.from({ length: size + 1 }, (_, j) => (j - size / 2) * CELL);
  const geo = mergeCopies(
    offsets.flatMap((o) => [
      { geo: bar, at: new THREE.Vector3(0, 0, o) },
      { geo: bar, at: new THREE.Vector3(o, 0, 0), turn: Math.PI / 2 },
    ]),
  );
  bar.dispose();
  return geo;
}

/**
 * Ultimate: a flat frame just outside one board's edge, for the glow on the boards the
 * side to move may play in (GDD §3.6).
 */
export function targetGeometry(size = 3): THREE.BufferGeometry {
  const inner = (size * CELL + 0.06) / 2 + 0.004;
  const outer = inner + 0.014;
  const square = (h: number) =>
    [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ].map(([x, y]) => new THREE.Vector2(x, y));
  const shape = new THREE.Shape(square(outer));
  shape.holes.push(new THREE.Path(square(inner).reverse()));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.0125, 0); // on the tray, beside the board's edge
  return geo;
}

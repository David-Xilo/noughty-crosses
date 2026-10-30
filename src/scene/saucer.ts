// Saucer (GDD §3.8, S3): a flying saucer of primitives, no asset. A pewter hull with a
// ring of brass lights, a glass dome and a soft beam; it carries one piece.
import * as THREE from "three";
import { type SaucerVisit, VISIT_MS } from "./board-model";
import { BOARD_TOP, CELL, mergeCopies } from "./models";

type Look = { readonly geometry: THREE.BufferGeometry; readonly material: THREE.Material };

/** What the saucer needs from the table (table.ts). */
interface SaucerHost {
  /** The board group: the saucer flies in the boards' own coordinates. */
  readonly board: THREE.Group;
  /** The board's own X, O and O rim, for the piece in the beam. */
  readonly piece: { readonly x: Look; readonly o: Look; readonly rim: Look };
  /** Whether the saucer waits to take the next piece placed. */
  waits(): boolean;
  centre(cell: number): THREE.Vector3;
  /** A piece's small, fixed twist on its cell. */
  twist(cell: number): number;
  animate(ms: number, step: (t: number) => void): void;
  /** Lays the pieces out again: a piece set down comes back on the board. */
  layout(): void;
}

export function createSaucer({ board, piece, waits, centre, twist, animate, layout }: SaucerHost) {
  const saucer = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 40, 12).scale(1, 0.26, 1),
    new THREE.MeshStandardMaterial({ color: "#b9bcc2", metalness: 0.85, roughness: 0.28 }),
  );
  hull.castShadow = true;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.021, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.006, 0),
    new THREE.MeshStandardMaterial({
      color: "#9fd8d0",
      emissive: "#3a8f86",
      emissiveIntensity: 0.6,
      metalness: 0.1,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75,
    }),
  );
  const saucerLights = new THREE.Mesh(
    mergeCopies(
      Array.from({ length: 10 }, (_, k) => ({
        geo: new THREE.SphereGeometry(0.004, 8, 6),
        at: new THREE.Vector3(
          Math.cos((k / 10) * Math.PI * 2) * 0.047,
          0,
          Math.sin((k / 10) * Math.PI * 2) * 0.047,
        ),
      })),
    ),
    new THREE.MeshBasicMaterial({ color: "#f2c46d" }),
  );
  // The beam: an open cone from under the hull to the board, scaled to the height.
  const beamMat = new THREE.MeshBasicMaterial({
    color: "#c9f3ea",
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.04, 1, 24, 1, true).translate(0, -0.5, 0),
    beamMat,
  );
  saucer.add(hull, dome, saucerLights, beam);
  // The piece in the beam: an X, or an O with its rim.
  const carried = new THREE.Group();
  const carriedX = new THREE.Mesh(piece.x.geometry, piece.x.material);
  const carriedO = new THREE.Mesh(piece.o.geometry, piece.o.material);
  const carriedRim = new THREE.Mesh(piece.rim.geometry, piece.rim.material);
  carriedX.castShadow = carriedO.castShadow = true;
  carried.add(carriedX, carriedO, carriedRim);
  for (const o of [saucer, carried]) {
    o.visible = false;
    board.add(o);
  }
  /** Where the saucer waits, behind the board's far right corner, and where it flies off. */
  const SAUCER_WAIT = new THREE.Vector3(CELL * 1.9, 0.15, -CELL * 1.9);
  const SAUCER_AWAY = new THREE.Vector3(CELL * 9, 0.5, -CELL * 9);
  /** The saucer's height over a piece it visits, and how high the beam lifts the piece. */
  const HOVER = 0.11;
  const LIFT = 0.055;
  /** The visit flying now, by its ply (-1: none), and the cell whose piece it still holds. */
  let flying = -1;
  let inBeam = -1;
  let visitToken = 0;
  const poseSaucer = (at: THREE.Vector3, tilt = 0) => {
    saucer.position.copy(at);
    saucer.rotation.set(tilt, saucer.rotation.y, -tilt * 0.6);
  };
  /** Shows the saucer waiting, or hides it, unless a visit is flying. */
  const syncSaucer = () => {
    if (flying >= 0) return;
    saucer.visible = waits();
    if (saucer.visible) poseSaucer(SAUCER_WAIT, 0.18);
    beamMat.opacity = 0;
  };
  /** Ends a visit still flying: a new position or game replaces it. */
  const endVisit = () => {
    visitToken++;
    flying = inBeam = -1;
    carried.visible = false;
    beamMat.opacity = 0;
  };
  const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
  /** Eased progress through the part of a flight from `a` to `b`. */
  const part = (t: number, a: number, b: number) =>
    ease(THREE.MathUtils.clamp((t - a) / (b - a), 0, 1));
  /**
   * A visit (S3): the saucer flies from where it waits to the piece just placed, lifts it in
   * its beam, sets it down on the next cell or back on its own, or flies off with it.
   */
  const flyVisit = (v: SaucerVisit) => {
    const mine = ++visitToken;
    flying = v.ply;
    // The piece leaves the board until it is set down; a carried one never comes back.
    inBeam = v.to ?? -1;
    const from = centre(v.from);
    const to = v.to === null ? null : centre(v.to);
    const over = (p: THREE.Vector3, up = 0) => p.clone().setY(p.y + HOVER + up);
    carriedX.visible = v.side === "X";
    carriedO.visible = carriedRim.visible = v.side === "O";
    carried.visible = saucer.visible = true;
    animate(VISIT_MS, (t) => {
      if (mine !== visitToken) return;
      // In: 0–0.3. Lift: 0.3–0.45. On, or up: 0.45–0.65. Down: 0.65–0.8. Off: 0.8–1, or
      // 0.65–1 with a carried piece.
      const arrive = part(t, 0, 0.3);
      const raise = part(t, 0.3, 0.45);
      const move = part(t, 0.45, 0.65);
      const lower = part(t, 0.65, 0.8);
      const at = SAUCER_WAIT.clone().lerp(over(from), arrive);
      const piece = from.clone();
      if (to) {
        at.lerp(over(to), move);
        if (v.to === v.from) at.x += Math.sin(move * Math.PI * 4) * 0.01; // a shake: no room
        at.lerp(SAUCER_AWAY, part(t, 0.8, 1));
        piece.lerp(to, move);
        piece.y += LIFT * raise * (1 - lower);
      } else {
        at.lerp(over(from, 0.12), move).lerp(SAUCER_AWAY, part(t, 0.65, 1));
        piece.y += LIFT * raise;
        piece.lerp(at.clone().setY(at.y - 0.02), move);
      }
      saucer.rotation.y = t * Math.PI * 3;
      poseSaucer(at, 0.18 * (1 - arrive) + 0.25 * part(t, 0.8, 1));
      // The beam shines while the saucer holds the piece.
      beamMat.opacity = t > 0.28 && t < (to ? 0.8 : 0.65) ? 0.32 : 0;
      beam.scale.y = Math.max(0.001, at.y - BOARD_TOP);
      carried.position.copy(piece);
      carried.rotation.set(0, twist(v.from) + move * 0.5, 0);
      carried.scale.setScalar(to ? 1 : 1 - 0.7 * move);
      carried.visible = to ? lower < 1 : t < 0.65;
      if (inBeam >= 0 && lower >= 1) {
        inBeam = -1; // set down: the board's own piece takes over
        layout();
      }
      if (t >= 1) {
        endVisit();
        syncSaucer();
        layout();
      }
    });
    layout();
  };

  return {
    sync: syncSaucer,
    end: endVisit,
    fly: flyVisit,
    /** The visit flying now, by its ply, or -1. */
    flying: () => flying,
    /** The cell whose piece the beam still holds, or -1. */
    inBeam: () => inBeam,
  };
}

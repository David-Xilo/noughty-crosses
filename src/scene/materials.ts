// Materials for the crafted tabletop (docs/style-guide.md). Colours come from the palette.
import * as THREE from "three";
import { palette } from "../ui/tokens";

const loader = new THREE.TextureLoader();

async function tex(name: string, repeat: number, color = false): Promise<THREE.Texture> {
  const t = await loader.loadAsync(`./assets/${name}`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Materials {
  board: THREE.MeshPhysicalMaterial;
  boardEdge: THREE.MeshPhysicalMaterial;
  frame: THREE.MeshPhysicalMaterial;
  felt: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  xGlaze: THREE.MeshPhysicalMaterial;
  /** Notakto's neutral X: brushed pewter (style guide, "Pieces"). */
  pewter: THREE.MeshStandardMaterial;
  oLacquer: THREE.MeshPhysicalMaterial;
}

/** Resolves once every texture has loaded, so the first rendered frame is complete. */
export async function createMaterials(): Promise<Materials> {
  const [woodColor, woodNormal, woodArm, feltNormal, feltRough] = await Promise.all([
    tex("wood_walnut_color.webp", 1, true),
    tex("wood_walnut_normal.webp", 1),
    tex("wood_walnut_arm.webp", 1),
    tex("felt_normal.webp", 24),
    tex("felt_rough.webp", 24),
  ]);
  const wood = (tint: string, clearcoat: number) =>
    new THREE.MeshPhysicalMaterial({
      // The texture carries grain and colour; the tint only darkens it towards the palette value.
      color: new THREE.Color(tint).lerp(new THREE.Color("#ffffff"), 0.3).multiplyScalar(1.35),
      map: woodColor,
      normalMap: woodNormal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap: woodArm,
      roughness: 0.75,
      clearcoat,
      clearcoatRoughness: 0.35,
    });
  return {
    board: wood(palette.board, 0.5),
    boardEdge: wood(palette.walnut, 0.4),
    frame: wood(palette.walnutDark, 0.3),
    felt: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.felt).multiplyScalar(0.8),
      normalMap: feltNormal,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: feltRough,
      roughness: 1,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: palette.brass,
      metalness: 0.6,
      roughness: 0.32,
      envMapIntensity: 2,
    }),
    xGlaze: new THREE.MeshPhysicalMaterial({
      color: palette.xGlaze,
      roughness: 0.38,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
    }),
    pewter: new THREE.MeshStandardMaterial({
      // Mostly diffuse: a fully metallic pewter only mirrors the dim room and reads dark.
      color: palette.pewter,
      metalness: 0.2,
      roughness: 0.45,
      envMapIntensity: 2,
    }),
    oLacquer: new THREE.MeshPhysicalMaterial({
      color: palette.oLacquer,
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
  };
}

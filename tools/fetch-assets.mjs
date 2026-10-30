// Downloads the CC0 source textures and HDRI from Poly Haven into art/src/ (not committed)
// and writes web-ready files to public/assets/ (committed). Every asset is listed in CREDITS.md.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "art/src/polyhaven";
const OUT = "public/assets";
const PH = "https://dl.polyhaven.org/file/ph-assets";

// [source url, output name, max size, webp quality]
const textures = [
  [
    `${PH}/Textures/jpg/1k/american_walnut_veneer/american_walnut_veneer_diff_1k.jpg`,
    "wood_walnut_color.webp",
    1024,
    82,
  ],
  [
    `${PH}/Textures/jpg/1k/american_walnut_veneer/american_walnut_veneer_nor_gl_1k.jpg`,
    "wood_walnut_normal.webp",
    1024,
    90,
  ],
  [
    `${PH}/Textures/jpg/1k/american_walnut_veneer/american_walnut_veneer_arm_1k.jpg`,
    "wood_walnut_arm.webp",
    512,
    85,
  ],
  [`${PH}/Textures/jpg/1k/scuba_suede/scuba_suede_nor_gl_1k.jpg`, "felt_normal.webp", 512, 88],
  [`${PH}/Textures/jpg/1k/scuba_suede/scuba_suede_rough_1k.jpg`, "felt_rough.webp", 512, 85],
];
const hdri = [`${PH}/HDRIs/hdr/1k/lythwood_lounge_1k.hdr`, "env_lythwood_lounge_1k.hdr"];

async function download(url) {
  const file = path.join(SRC, path.basename(url));
  if (!fs.existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

fs.mkdirSync(SRC, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [url, name, size, quality] of textures) {
  const src = await download(url);
  await sharp(src).resize(size, size).webp({ quality }).toFile(path.join(OUT, name));
  console.log(name, fs.statSync(path.join(OUT, name)).size);
}
fs.copyFileSync(await download(hdri[0]), path.join(OUT, hdri[1]));
console.log(hdri[1], fs.statSync(path.join(OUT, hdri[1])).size);

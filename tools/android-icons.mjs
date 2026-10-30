// Draws the Android launcher icons from art/icon.svg into the Capacitor project (TTT-4.4.1).
// The adaptive icon's foreground keeps the board inside the 66 dp safe zone that every
// launcher mask shows; its background is the colour in values/ic_launcher_background.xml.
import fs from "node:fs";
import sharp from "sharp";

const SVG = fs.readFileSync("art/icon.svg");
const RES = "android/app/src/main/res";
const BG = "#0d0907";
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// The icon at `size` px, centred on a `canvas` px square, over a transparent background
// or a circle of the background colour.
async function icon(canvas, size, round) {
  const art = await sharp(SVG, { density: 384 }).resize(size, size).png().toBuffer();
  const base = round
    ? Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}"><circle cx="50%" cy="50%" r="50%" fill="${BG}"/></svg>`,
      )
    : { create: { width: canvas, height: canvas, channels: 4, background: "#0000" } };
  const offset = Math.round((canvas - size) / 2);
  return sharp(base)
    .composite([{ input: art, left: offset, top: offset }])
    .png()
    .toBuffer();
}

for (const [name, d] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${name}`;
  fs.mkdirSync(dir, { recursive: true });
  // Legacy icons (Android 7), 48 dp.
  fs.writeFileSync(`${dir}/ic_launcher.png`, await icon(48 * d, 48 * d, false));
  fs.writeFileSync(`${dir}/ic_launcher_round.png`, await icon(48 * d, Math.round(36 * d), true));
  // Adaptive foreground, 108 dp; the board's frame fits the 66 dp circle at 56 dp.
  fs.writeFileSync(`${dir}/ic_launcher_foreground.png`, await icon(108 * d, 56 * d, false));
}
console.log(`icons written to ${RES}/mipmap-*`);

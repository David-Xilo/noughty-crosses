// Downloads the CC0 sound sources (Kenney packs, music loops) into art/src/audio/ (not
// committed) and writes the game's files to public/assets/audio/ (committed): effects as
// 16-bit 48 kHz mono WAV at a set peak, music as Ogg Vorbis with an AAC fallback at about
// −18 LUFS. It prints each file's loudness and true peak, then the mix of a scripted game.
// Every file is listed in CREDITS.md. Needs `unzip` on the PATH.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpeg from "ffmpeg-static";

const SRC = "art/src/audio";
const OUT = "public/assets/audio";
const K = "https://kenney.nl/media/pages/assets";
const packs = {
  impact: `${K}/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip`,
  casino: `${K}/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip`,
  interface: `${K}/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip`,
  rpg: `${K}/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip`,
  jingles: `${K}/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip`,
};

// [effect name (src/ui/sound.ts), pack, file in the pack's Audio folder, peak in dBFS]
const effects = [
  ["place-x", "impact", "impactPlate_light_000.ogg", -3], // ceramic on wood
  ["place-o", "impact", "impactWood_light_000.ogg", -3], // lacquer on wood
  ["slide", "casino", "card-slide-1.ogg", -12], // a Gravity piece down its column
  ["vanish", "interface", "glass_001.ogg", -12], // soft glass chime
  ["illegal", "impact", "impactSoft_medium_000.ogg", -7], // felt thud
  ["drawer-open", "rpg", "doorOpen_1.ogg", -12],
  ["drawer-close", "rpg", "doorClose_1.ogg", -12],
  ["card-place", "casino", "card-place-1.ogg", -12],
  ["card-flip", "rpg", "bookFlip1.ogg", -12],
  ["press", "rpg", "bookPlace1.ogg", -9], // a button: the stamp
  ["tick", "interface", "tick_001.ogg", -22], // focus or hover on a legal cell
  ["win", "jingles", "Sax jingles/jingles_SAX07.ogg", -6], // warm brass chord
  ["draw", "jingles", "Pizzicato jingles/jingles_PIZZI07.ogg", -8], // soft cadence
];

// [music name (src/ui/sound.ts), source url, file name in art/src/audio/music/]: made as
// seamless loops; the shortlist and its licences are in research.md (TTT-4.1.9)
const OGA = "https://opengameart.org/sites/default/files";
const music = [
  [
    "music-cabinet",
    `${OGA}/bluebonnet_in_b_major_looped_0.wav`,
    "bluebonnet_in_b_major_looped_0.wav",
  ],
  ["music-table", `${OGA}/a_small_fire_will_do.wav`, "a_small_fire_will_do.wav"],
];

const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-y", ...args], { stdio: "pipe" });
/** ffmpeg prints a filter's analysis on stderr; a null output keeps only that. */
const analyse = (file, af) =>
  spawnSync(ffmpeg, ["-hide_banner", "-nostats", "-i", file, "-af", af, "-f", "null", "-"], {
    encoding: "utf8",
  }).stderr;
/** Integrated loudness (LUFS) and true peak (dBTP) by ITU BS.1770 (ffmpeg's ebur128). */
function loudness(file) {
  const out = analyse(file, "ebur128=peak=true");
  const summary = out.slice(out.lastIndexOf("Summary:"));
  const num = (re) => Number(summary.match(re)?.[1]);
  return { lufs: num(/I:\s+(-?[\d.]+|-inf) LUFS/), peak: num(/Peak:\s+(-?[\d.]+|-inf) dBFS/) };
}
const samplePeak = (file) =>
  Number(analyse(file, "volumedetect").match(/max_volume: (-?[\d.]+) dB/)?.[1]);

/** A gain to apply, or a clear stop when the source could not be measured. */
function finite(gain, file) {
  if (!Number.isFinite(gain)) throw new Error(`no level measured for ${file}`);
  return gain;
}

async function download(url, file) {
  if (fs.existsSync(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

fs.mkdirSync(path.join(SRC, "music"), { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [name, url] of Object.entries(packs)) {
  const zip = path.join(SRC, `kenney_${name}.zip`);
  await download(url, zip);
  const dir = path.join(SRC, `kenney_${name}`);
  if (!fs.existsSync(dir)) execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
}

// Under 0.4 s, BS.1770 gating leaves nothing to measure: ebur128 reports −70.
const fmt = (x) => (Number.isFinite(x) && x > -70 ? x.toFixed(1) : "n/a");
for (const [name, pack, file, peak] of effects) {
  const src = path.join(SRC, `kenney_${pack}`, "Audio", file);
  const out = path.join(OUT, `${name}.wav`);
  const gain = finite(peak - samplePeak(src), src);
  run([
    "-i",
    src,
    "-af",
    `volume=${gain.toFixed(2)}dB`,
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "pcm_s16le",
    out,
  ]);
  const l = loudness(out);
  console.log(`${name}.wav  ${fs.statSync(out).size} B  ${fmt(l.lufs)} LUFS  ${fmt(l.peak)} dBTP`);
}

for (const [name, url, file] of music) {
  const src = path.join(SRC, "music", file);
  await download(url, src);
  const l = loudness(src);
  // To −18 LUFS, but never past −1 dBTP.
  const gain = finite(Math.min(-18 - l.lufs, -1.5 - l.peak), src);
  const af = `volume=${gain.toFixed(2)}dB`;
  run([
    "-i",
    src,
    "-af",
    af,
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "libvorbis",
    "-q:a",
    "4",
    path.join(OUT, `${name}.ogg`),
  ]);
  run([
    "-i",
    src,
    "-af",
    af,
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    path.join(OUT, `${name}.m4a`),
  ]);
  for (const ext of ["ogg", "m4a"]) {
    const f = path.join(OUT, `${name}.${ext}`);
    const m = loudness(f);
    console.log(
      `${name}.${ext}  ${fs.statSync(f).size} B  ${fmt(m.lufs)} LUFS  ${fmt(m.peak)} dBTP`,
    );
  }
}

// The mix of a short scripted game at full volumes: focus ticks, a press, the setup card, nine
// placements with a refusal, then the win. Target about −18 LUFS, true peak at most −1 dBTP.
const script = [
  ["tick", 0],
  ["press", 0.4],
  ["card-place", 0.6],
  ["tick", 1.6],
  ["tick", 2.0],
  ["place-x", 2.4],
  ["place-o", 3.4],
  ["tick", 4.2],
  ["illegal", 4.6],
  ["place-x", 5.2],
  ["place-o", 6.2],
  ["tick", 6.8],
  ["place-x", 7.4],
  ["place-o", 8.4],
  ["place-x", 9.4],
  ["win", 9.8],
];
const mix = path.join(SRC, "mix-check.wav");
run([
  ...script.flatMap(([n]) => ["-i", path.join(OUT, `${n}.wav`)]),
  "-filter_complex",
  `${script.map(([, t], i) => `[${i}]adelay=${Math.round(t * 1000)}:all=1[a${i}]`).join(";")};${script.map((_, i) => `[a${i}]`).join("")}amix=inputs=${script.length}:normalize=0`,
  mix,
]);
const m = loudness(mix);
console.log(`mix of a scripted game  ${fmt(m.lufs)} LUFS  ${fmt(m.peak)} dBTP`);

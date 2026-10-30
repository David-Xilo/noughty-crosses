// Sounds (GDD §7, style guide "Sound"): effects from Kenney's CC0 packs and two music loops,
// made by `npm run audio` into public/assets/audio/ and listed in CREDITS.md. Effects and
// music each have a volume under the master volume. Nothing loads before the player has
// interacted with the page (unlock), so the title screen loads no sound.
const EFFECTS = [
  "place-x",
  "place-o",
  "slide",
  "vanish",
  "illegal",
  "drawer-open",
  "drawer-close",
  "card-place",
  "card-flip",
  "press",
  "tick",
  "win",
  "draw",
] as const;
type Effect = (typeof EFFECTS)[number];
/** The cabinet's loop, and the one at the table when music stays on during play. */
const MUSIC = ["music-cabinet", "music-table"] as const;
type Music = (typeof MUSIC)[number];

interface Volumes {
  /** Each in percent, 0 to 100. */
  master: number;
  music: number;
  effects: number;
}

interface Audio {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  effects: GainNode;
}

let out: Audio | null = null;
let volumes: Volumes = { master: 100, music: 100, effects: 100 };
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let wanted: Music | null = null;
let playing: { name: Music; src: AudioBufferSourceNode; fade: GainNode } | null = null;

/** Hooks for the scripted playthroughs (test/e2e): what was played, and what decoded. */
const log = { played: [] as string[], decoded: [] as string[] };
const logPlayed = (name: string) => {
  log.played.push(name);
  if (log.played.length > 1000) log.played.splice(0, 500); // a long session stays small
};
let unlocked = false;

/** Loudness follows the square of the slider, so its middle sounds about half as loud. */
const level = (percent: number) => (percent / 100) ** 2;

function audio(): Audio | null {
  if (!unlocked) return null;
  if (!out) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    const music = ctx.createGain();
    const effects = ctx.createGain();
    music.connect(master);
    effects.connect(master);
    master.connect(ctx.destination);
    out = { ctx, master, music, effects };
    // Hidden (another tab, or the app minimised): the music and everything else pause.
    document.addEventListener("visibilitychange", () => {
      void (document.hidden ? ctx.suspend() : ctx.resume());
    });
    (window as unknown as { __sound: typeof log }).__sound = log;
    applyVolumes();
  }
  if (out.ctx.state === "suspended" && !document.hidden) void out.ctx.resume();
  return out;
}

/**
 * Called on the first interaction that browsers count; browsers allow audio only after it.
 * Every effect is fetched then, so the first of each plays on time, and the wanted loop
 * starts.
 */
export function unlock(): void {
  unlocked = true;
  const a = audio();
  if (a) for (const name of EFFECTS) void load(a, `${name}.wav`);
  setMusic(wanted);
}

function applyVolumes() {
  if (!out) return;
  // A short glide, so a slider moved during music does not click.
  const t = out.ctx.currentTime;
  out.master.gain.setTargetAtTime(level(volumes.master), t, 0.015);
  out.music.gain.setTargetAtTime(level(volumes.music), t, 0.015);
  out.effects.gain.setTargetAtTime(level(volumes.effects), t, 0.015);
}

export function setVolumes(v: Volumes): void {
  volumes = { ...v };
  applyVolumes();
}

function load(a: Audio, file: string): Promise<AudioBuffer | null> {
  let b = buffers.get(file);
  if (!b) {
    b = fetch(`${import.meta.env.BASE_URL}assets/audio/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${file}`))))
      .then((data) => a.ctx.decodeAudioData(data))
      .then((buf) => {
        log.decoded.push(file);
        return buf;
      })
      .catch((e) => {
        console.warn("sound", e);
        return null;
      });
    buffers.set(file, b);
  }
  return b;
}

/** Plays an effect; the first play of each one waits for its file. */
export function play(name: Effect): void {
  const a = audio();
  if (!a || volumes.master === 0 || volumes.effects === 0) return;
  logPlayed(name);
  void load(a, `${name}.wav`).then((buf) => {
    if (!buf) return;
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(a.effects);
    src.start();
  });
}

const FADE = 1.5; // seconds

/** Starts a loop, or with null fades the music out. Loops are made to repeat seamlessly. */
export function setMusic(name: Music | null): void {
  wanted = name;
  const a = audio();
  if (!a || playing?.name === name) return;
  if (playing) {
    const old = playing;
    old.fade.gain.setTargetAtTime(0, a.ctx.currentTime, FADE / 3);
    old.src.stop(a.ctx.currentTime + FADE);
    playing = null;
  }
  if (!name || volumes.master === 0 || volumes.music === 0) return;
  // Ogg Vorbis, else AAC where Ogg does not decode (Safari before 18.4).
  const music = load(a, `${name}.ogg`).then((buf) => buf ?? load(a, `${name}.m4a`));
  void music.then((buf) => {
    if (!buf || wanted !== name || playing) return;
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const fade = a.ctx.createGain();
    fade.gain.setValueAtTime(0, a.ctx.currentTime);
    fade.gain.setTargetAtTime(1, a.ctx.currentTime, FADE / 3);
    src.connect(fade).connect(a.music);
    src.start();
    playing = { name, src, fade };
    logPlayed(name);
  });
}

/** A low hum on the turn a mark is about to vanish (V6): a soft sine, made here. */
export function hum(): void {
  const a = audio();
  if (!a || volumes.master === 0 || volumes.effects === 0) return;
  logPlayed("hum");
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  osc.frequency.setValueAtTime(110, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  osc.connect(g).connect(a.effects);
  osc.start(t);
  osc.stop(t + 0.75);
}

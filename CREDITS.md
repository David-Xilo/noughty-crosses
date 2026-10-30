# Credits and asset register

Every asset that ships has one row before it is committed: art, audio, fonts, shaders,
text, data and third-party code. An asset without a source and licence does not ship.
Licence rules are in the workspace legal and IP guideline.

**Licences (plan decision P26, 2026-10-30):** the code is MIT ([LICENSE](LICENSE)). The
project's own assets, the rows below whose licence says "project code", "project data" or
"project art" (the models' code, the icon, the solved tables, the synthesised hum), are
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): credit "David Bugalho de Moura,
Noughty Crosses". Third-party assets, libraries and fonts keep the licences in their
rows.

## People

- David-Xilo: design and development, with AI coding agents.

## Assets

| Asset (path) | Author | Source URL | Licence | Attribution required | Changes made | AI-assisted (tool, how) | Added |
|---|---|---|---|---|---|---|---|
| `public/assets/wood_walnut_color.webp`, `wood_walnut_normal.webp`, `wood_walnut_arm.webp` | Poly Haven ("American Walnut Veneer") | https://polyhaven.com/a/american_walnut_veneer | CC0 1.0 | no | resized to 1024 or 512 px, WebP by `tools/fetch-assets.mjs` | no | 2026-10-01 |
| `public/assets/felt_normal.webp`, `felt_rough.webp` | Poly Haven ("Scuba Suede"), used as baize | https://polyhaven.com/a/scuba_suede | CC0 1.0 | no | resized to 512 px, WebP; tinted green in the material | no | 2026-10-01 |
| `public/assets/env_lythwood_lounge_1k.hdr` | Greg Zaal, Poly Haven ("Lythwood Lounge") | https://polyhaven.com/a/lythwood_lounge | CC0 1.0 | no | none | no | 2026-10-01 |
| Board and piece models (`src/scene/models.ts`) | David-Xilo, with AI coding agents | — | project code | — | procedural placeholders for look development; TTT-3.2 merged the static board parts and lowered the ring to 40 sides | yes: geometry code written with Claude Code | 2026-10-01 |
| `public/assets/classic_table.bin`, `vanishing_table.bin`, `misere_table.bin`, `notakto_table.bin`, `misere-wild_table.bin`, `morris_table.bin`, `saucer_table.bin` (solved positions) | David-Xilo, with AI coding agents | made by `tools/solve-tables.mjs` from the rules core | project data | — | generated; regenerate with `npm run tables` | yes: solver code written with Claude Code | 2026-10-05 |
| App icon `art/icon.svg`, `src-tauri/icons/*.png` and `icon.ico`, `android/app/src/main/res/mipmap-*/*.png` | David-Xilo, with AI coding agents | — | project art | — | PNGs and the ICO made from the SVG by `npx tauri icon` (the ICO on 2026-10-16, TTT-4.3.1); the Android launcher icons by `tools/android-icons.mjs` (2026-10-16, TTT-4.4.1) | yes: SVG written with Claude Code | 2026-10-05 |
| The hum before a mark vanishes (`src/ui/sound.ts`) | David-Xilo, with AI coding agents | — | project code | — | synthesised at run time with Web Audio; until TTT-4.1.9 every sound was made this way | yes: written with Claude Code | 2026-10-05 |
| `public/assets/audio/place-x.wav` (impactPlate_light_000), `place-o.wav` (impactWood_light_000), `illegal.wav` (impactSoft_medium_000) | Kenney ("Impact Sounds" 1.0) | https://kenney.nl/assets/impact-sounds | CC0 1.0 | no | levelled to a set peak, 48 kHz mono 16-bit WAV by `tools/fetch-audio.mjs` | no | 2026-10-10 |
| `public/assets/audio/slide.wav` (card-slide-1), `card-place.wav` (card-place-1) | Kenney ("Casino Audio") | https://kenney.nl/assets/casino-audio | CC0 1.0 | no | levelled to a set peak, 48 kHz mono 16-bit WAV by `tools/fetch-audio.mjs` | no | 2026-10-10 |
| `public/assets/audio/vanish.wav` (glass_001), `tick.wav` (tick_001) | Kenney ("Interface Sounds") | https://kenney.nl/assets/interface-sounds | CC0 1.0 | no | levelled to a set peak, 48 kHz mono 16-bit WAV by `tools/fetch-audio.mjs` | no | 2026-10-10 |
| `public/assets/audio/drawer-open.wav` (doorOpen_1), `drawer-close.wav` (doorClose_1), `card-flip.wav` (bookFlip1), `press.wav` (bookPlace1) | Kenney ("RPG Audio") | https://kenney.nl/assets/rpg-audio | CC0 1.0 | no | levelled to a set peak, 48 kHz mono 16-bit WAV by `tools/fetch-audio.mjs` | no | 2026-10-10 |
| `public/assets/audio/music-cabinet.ogg`, `music-cabinet.m4a` | Kistol ("Bluebonnet", looped version) | https://opengameart.org/content/bluebonnet | CC0 1.0 | no | levelled to −18 LUFS, 48 kHz Ogg Vorbis and AAC by `tools/fetch-audio.mjs` | no | 2026-10-10 |
| `public/assets/audio/music-table.ogg`, `music-table.m4a` | Trex0n ("A Small Fire Will Do (Calming Loop)") | https://opengameart.org/content/a-small-fire-will-do-calming-loop | CC0 1.0 | no | levelled to −18 LUFS, 48 kHz Ogg Vorbis and AAC by `tools/fetch-audio.mjs` | no | 2026-10-10 |
| `public/assets/audio/win.wav` (jingles_SAX07), `draw.wav` (jingles_PIZZI07) | Kenney ("Music Jingles") | https://kenney.nl/assets/music-jingles | CC0 1.0 | no | levelled to a set peak, 48 kHz mono 16-bit WAV by `tools/fetch-audio.mjs` | no | 2026-10-10 |

## Third-party code and libraries

| Library | Version | Licence | Used for | Notice shipped |
|---|---|---|---|---|
| three | 0.186.1 | MIT | 3D rendering | `public/THIRD-PARTY-NOTICES.txt` (2026-10-29, TTT-5.1) |
| postprocessing (pmndrs) | 6.39.5 | Zlib | post-processing effects | `public/THIRD-PARTY-NOTICES.txt` (2026-10-29, TTT-5.1) |
| Fluent (@fluent/bundle, Project Fluent) | 0.19.1 | Apache-2.0 | the game's text in every language | `public/THIRD-PARTY-NOTICES.txt` (2026-10-29, TTT-5.1; the package ships no licence file, so the notice is the Apache-2.0 header with Mozilla's copyright) |
| Fraunces (@fontsource-variable/fraunces) | 5.3.0 | SIL OFL 1.1 | display type | `public/THIRD-PARTY-NOTICES.txt`, the OFL text (2026-10-29, TTT-5.1) |
| Atkinson Hyperlegible (@fontsource/atkinson-hyperlegible) | 5.3.0 | SIL OFL 1.1 | body and UI type | `public/THIRD-PARTY-NOTICES.txt`, the OFL text (2026-10-29, TTT-5.1) |
| Tauri (tauri, tauri-build and their Rust crates) | 2.12 | MIT or Apache-2.0 | the desktop app (`src-tauri/`) | not in 1.0 (web only); the crate licence list goes with the first desktop release |
| steamworks and steamworks-sys (Rust crates) | 0.13.1, 0.13.0 | MIT or Apache-2.0 | the Steam build only (`steam` feature) | not in 1.0; the crate licence list goes with the Steam release (After release: Steam) |
| Capacitor (@capacitor/core, @capacitor/android) and its Android project template (`android/`) | 8.5.3 | MIT | the Android app | not in 1.0; goes with the Play release (After release: Google Play) |
| AndroidX (appcompat, core, core-splashscreen, activity, fragment, coordinatorlayout, webkit) and Apache Cordova's Android framework, pulled in by Capacitor | per `android/variables.gradle` | Apache-2.0 | the Android app | not in 1.0; the licence list goes with the Play release |
| Steamworks SDK redistributable (`libsteam_api.so`, `steam_api64.dll`), Valve, shipped inside steamworks-sys | the crate's SDK | Steamworks SDK Access Agreement §1.1(b): the `redistributable_bin` files may be distributed with the game, in object code | the Steam build only; copied beside the binary by `tools/steam-lib.mjs`, never committed | not in 1.0; to check with the Steam release |

Build and test tools (Vite, TypeScript, Vitest, Biome, Playwright, sharp, ffmpeg-static, the Tauri CLI,
the Capacitor CLI, Gradle and its wrapper) are not shipped.

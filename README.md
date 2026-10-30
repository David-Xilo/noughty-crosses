# Noughty Crosses

Every clever way to play noughts and crosses, on one lamp-lit game table. Thirteen modes
with exact rules and honest fairness labels, a computer opponent at three levels, and
pass-and-play on the same device. Free, no ads, no accounts, no analytics.

**Play it in the browser:** https://xillz.itch.io/noughty-crosses

## The game

- **Modes:** Classic, Vanishing, Misère, Notakto, Big board, Gravity, Ultimate, Overtime,
  Misère wild, Three men's morris, Saucer, Order and Chaos, and Nesting. Each has a rule
  card with a ten-second demo, and each says whether perfect play draws or who has the
  edge. The rules are in the [game design document](docs/gdd.md).
- **Opponent:** Casual blocks the obvious line and misses the fork, Keen rarely slips,
  Sharp never does. Solved modes play from precomputed tables; the others search in a Web
  Worker. The seeded generator makes every game reproducible.
- **Table:** a 3D table with crafted wood and brass (Three.js), or a plain 2D board for
  any device. Keyboard, controller, mouse and touch. A game saves after every move.
- **Access:** high contrast, text size up to 200%, reduced motion, no timers. What the
  game does and does not do: the [accessibility statement](docs/accessibility.md).

## Run and build

Node 22.

```sh
npm install
npm run dev               # the game at http://localhost:5173; ?gfx=high|low|2d
npm run check             # Biome lint, tsc, knip and Vitest (rules, properties, tables, saves)
npm run build             # the web build in dist/
npm run e2e               # build, then scripted playthroughs in Chromium (Playwright)
npm run tables            # rebuild the solved tables after a rules change
npm run notices           # regenerate public/THIRD-PARTY-NOTICES.txt
npm run itch              # the web build zipped for itch.io
npm run desktop           # Linux desktop app (Tauri 2; needs Rust, WebKitGTK, patchelf, libudev-dev)
npm run android           # debug APK (Capacitor; needs JDK 21 and the Android SDK)
```

The Windows app builds in the "Windows build" workflow on GitHub.

## Code

- `src/core/`: the rules, one module per mode behind one `Mode<S>` interface, the seeded
  generator, the solver and the computer players. No DOM, no clock, no `Math.random`.
- `src/app/`: modes as the app sees them, the match and the game record. No DOM.
- `src/scene/`: the 3D table. `src/ui/`: the DOM screens; every string the player reads
  is a Fluent message in `src/ui/locales/en.ftl`.
- `src-tauri/`: the desktop app. `android/`: the Android app. `tools/`: asset, table and
  measurement scripts. `test/`: Vitest rule tests named by GDD rule ID, fast-check
  properties, and the Playwright playthroughs.

Design documents: the [pitch](docs/pitch.md), the [game design document](docs/gdd.md),
the [style guide](docs/style-guide.md) and the [itch.io page text](docs/store/itch.md).

## Contributing

This repository is exported from a private working repository, where the plan, research
notes and playtest reports live. Issues and pull requests are welcome; a change is taken
into the private repository first and comes back with the next export, so the history
here is a series of exports, not the day-to-day commits.

## Licences and credits

The code is MIT ([LICENSE](LICENSE)). The project's own assets (the models' code, the
icon, the solved tables) are CC BY 4.0. Every third-party asset, library and font is in
[CREDITS](CREDITS.md) with its source and licence; the web build ships their licence
texts in `public/THIRD-PARTY-NOTICES.txt`.

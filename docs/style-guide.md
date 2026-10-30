# Noughty Crosses: style guide

- **Updated:** 2026-10-05 (platform order, plan decision P4).
  Accepted at TTT-G2 on 2026-10-02.
- **Step:** TTT-2.2. Validated by the look-development frame (TTT-2.3).
- **Pillar served:** "A crafted object, everywhere" ([pitch](pitch.md#experience-goal-and-pillars)).
- **Direction chosen by the user at G1:** crafted tabletop.

## Direction

- **Mood:** lamp-lit, tactile, quiet confidence. Like an heirloom games set on a
  late-evening table.
- **Five words:** warm, weighty, precise, crafted, calm.
- **What the player should feel:**
  - Every piece has weight.
  - Every surface could be touched.
  - The menus are a cabinet you open, not a web page.
- **References** (moods only; never copy specific works; see
  legal and IP):
  - museum product photography of wooden games
  - mid-century games cabinets
  - letterpress cards
  - the calm, polished lighting of premium tabletop adaptations on Steam
- **Avoid:**
  - glossy plastic
  - neon
  - cartoon outlines
  - stock-UI flatness
  - busy backgrounds
  - more than one hero light

## Scene

- **Table:** dark green baize inset in a walnut frame. Felt micro-texture with a subtle
  normal map; walnut with a satin clear coat.
- **Board kit:** honey-walnut boards (`board`, a mid-tone, so both the light X and the
  dark O stand out at 3:1 or more), with inlaid brass grid lines and a bevelled
  dark-walnut edge. Each
  mode's board is built from one modular kit: 3×3, 5×5, 6×6 upright gravity frame,
  Ultimate 9×(3×3) tray, Notakto 1–3 small boards.
- **Pieces** (instanced):
  - **X:** a carved cross in warm bone-white glazed ceramic (`#EDE6D6` base). It has a
    matte bevel catching highlights.
  - **O:** a ring in deep indigo lacquer (`#1A2442` base) with a fine gold rim line.
  - **Notakto X:** a pale neutral X in light brushed pewter (`pewter`, `#DCDEE1`), cool
    grey against the warm bone-white X, so it cannot be confused with the X of the other
    modes. It reaches 3.2:1 on the board.
  - Pieces differ in **shape and value** (light vs dark), never only in hue.
  - **High-contrast set:** pure white X with a black rim, and pure black O with a white
    rim, on a desaturated board.
- **Vanishing mark:** the oldest piece turns translucent, like frosted glass, and its
  rim pulses gently. Under reduced motion it stays translucent without pulsing.
- **Win line:** a brass light sweep along the line plus a warm glow on the three pieces.
  The losing pieces dim slightly.
- **Backdrop:** the soft-focus edge of a games cabinet and a wall in warm shadow. It is
  never busy.

## Lighting and rendering

- **Hero light:** one warm desk lamp (2,700 K) from the upper left. It is the only
  shadow-casting light, with a soft PCF or VSM shadow and a tight shadow camera.
- **Fill:** a small CC0 interior HDRI (1–2k, ≤ 1 MB) at low intensity for reflections and
  fill.
- **Baked lighting:** the table, frame and boards have lighting and ambient occlusion
  baked in Blender Cycles. Only the pieces and the lamp shadow are dynamic.
- **Tone mapping:** AgX, or Khronos Neutral if AgX crushes the felt colour. Exposure is
  tuned per scene, not per frame.
- **Post-processing, by graphics level:**
  - **Low:** SMAA only.
  - **High:**
    - SMAA
    - subtle bloom on brass and glows only (threshold above the lamp-lit wood)
    - shallow depth of field focused on the board (desktop and Deck only)
    - a light vignette
- **Camera:**
  - A 35–40° downward three-quarter view, 35 mm equivalent.
  - On phones it frames the board at 80% of the width.
  - Tilt is limited to ±20° and rotation to ±35°, so the board is always readable.
  - Moves ease over 400 ms; under reduced motion they cut.
- **Render on demand:** frames are drawn only during input, animation or camera moves.
  Idle means no frames, except one slow lamp flicker every few seconds on high, which is
  off under reduced motion.

## Palette (UI and scene tokens)

| Token | Hex | Use | Contrast note |
|---|---|---|---|
| `felt` | `#1F3B2E` | table baize | background for pieces |
| `walnut` | `#5A3A22` | table frame, board edges, cabinet | — |
| `board` | `#9C7148` | board playing surface (honey walnut) | X 3.5:1 and O 3.3:1 on it (WCAG 1.4.11 needs 3:1) |
| `walnut-dark` | `#2E1D12` | UI panels | text on it ≥ 7:1 with `paper` |
| `brass` | `#C8A15A` | grid inlays, accents, focus ring | ≥ 3:1 on `walnut-dark` |
| `paper` | `#F3ECDD` | rule cards, body text on dark | — |
| `ink` | `#1B1B1F` | text on paper | ≥ 12:1 on `paper` |
| `x-glaze` | `#EDE6D6` | X piece | value contrast with `o-lacquer` > 10:1 |
| `o-lacquer` | `#1A2442` | O piece | darkened from `#1E2A4A` in TTT-4.1.7, so it stays at 3:1 on the board under simulated protanopia |
| `win` | `#F2C46D` | win glow | paired with the light sweep (shape) |
| `danger` | `#B5483B` | illegal move, resign | always paired with an icon and text |

Contrast ratios were checked by `test/tokens.test.ts` until TTT-0.3 removed it (plan
decision P12). Measure a changed pair before it ships; any pair that fails is changed here
first.

**Change 2026-10-01 (TTT-2.3):** the first draft put the pieces on dark walnut
(`#5A3A22`). The O piece reached only 1.39:1 there, and only 1.16:1 on the felt. The
playing surface is now the mid-tone `board`. Pieces off the board, such as the Notakto
tray or captures, keep their brass rim for separation.

**Change 2026-10-07 (TTT-4.1.2):** the Notakto X was `#A7A9AC`, which reaches only 1.83:1
on the `board` tone, below the 3:1 every piece needs. It is now the lighter `#DCDEE1`
(3.2:1), checked then in `test/tokens.test.ts`. On the 3D table it is mostly diffuse
(metalness 0.2): a fully metallic finish mirrored the dim room and read dark.

## Typography

- **Display:** **Fraunces** (SIL OFL), a soft-serif variable font. Use it in small caps
  for the title, drawer labels and headings, engraved on brass.
- **Body and UI:** **Atkinson Hyperlegible** (SIL OFL). It was designed for legibility.
  Use it for rule cards, settings and status.
- **Scale:** body 18 px at 1080p minimum, scaling 100–200% with the text-size setting.
  Headings are 1.333×, 1.777× and 2.369× the body size.
- **Files:** fonts are self-hosted WOFF2, subset to Latin Extended, with the OFL text in
  `CREDITS.md`.
- **No text in images:** every label is live text.

## Menus: the games cabinet

- **Title:** the closed cabinet, drawn in HTML and CSS over the felt (TTT-4.1.6): walnut,
  a brass name plate and two doors with the menu card hung on them. Play opens it: the
  doors swing out to the sides and the drawers come into view.
- **Mode drawers:** each drawer has an engraved brass label, the miniature board inside,
  a one-line rule and the fairness note.
  - Focus or hover slides the drawer out 8 px with a brass edge light.
  - Selecting opens the setup card; the "?" opens the rule card and its demo.
- **Cards:** setup, rule cards, settings and results are letterpress paper cards on the
  felt, laid out as semantic HTML over the scene.
  - Ink text, deckled edges drawn with CSS and SVG, a subtle paper texture.
  - Buttons look like stamped labels with a pressed state.
- **Motion:**
  - Drawers: 220 ms ease-out. Cards: 180 ms rise. Doors: 400 ms swing. Screens change
    with CSS animations, not View Transitions: in Chromium a click during a view
    transition was lost (TTT-4.1.6).
  - Under reduced motion every change is a 120 ms fade.
  - Idle loops stop.
- **Focus:** a 3 px `brass` ring with a 2 px offset, always visible. Hover and focus look
  the same.
- **Scrim:** text over the 3D scene always sits on a paper card or a `walnut-dark` panel,
  never on the raw render.
- **Controller and Steam Deck:** a visible focus path through drawers and cards, and
  glyph prompts in the card footer.

## Sound

- **Mood:** close-miked, warm, quiet. Wood, felt, brass, ceramic, and a room with a
  little air.
- **Effects** (about 15):
  - piece place: ceramic on wood, and lacquer on wood
  - piece slide
  - vanish (soft glass chime)
  - illegal move (felt thud)
  - drawer open and close
  - card place and card flip
  - button press (stamp)
  - focus tick
  - win chord (warm brass)
  - draw cadence
  - the computer makes no sound while it thinks (GDD §7; a clock was dropped in TTT-4.1.9)
- **Music:** two gentle acoustic loops (felt piano, nylon guitar, light strings), 90–110 s
  each, with seamless loop points. They are off during play by default; an option keeps
  them on.
- **Mix:** about −18 LUFS integrated for mobile and web, true peak ≤ −1 dBTP. There are
  separate volumes for music and effects.
- **Formats:** WAV masters at 48 kHz. Effects ship as 48 kHz mono WAV; music ships as Ogg
  Vorbis with an AAC fallback for older Safari
  (content pipelines).
- **Sources (TTT-4.1.9):** effects from Kenney's CC0 packs, music from CC0 loops; both made
  by `npm run audio`, with every file in [CREDITS](../CREDITS.md).
- **Haptics:** optional. Used for place and win only (GDD §7).

## Asset production

- **Models:** made in Blender (our own work), exported as glTF `.glb`, with metal/rough
  PBR and one material per surface. Static board parts are merged. Real-world scale is
  1 unit = 1 m.
- **Textures:**
  - Wood, felt and brass come from CC0 libraries (ambientCG, Poly Haven), adapted.
  - Baked lighting and occlusion come from Cycles.
  - KTX2 compression: UASTC for normal and ORM maps, ETC1S for colour.
  - At most 2048², ORM maps at ¼ size, mipmaps on.
- **HDRI:** one CC0 interior HDRI from Poly Haven, prefiltered.
- **Optimisation:** `gltf-transform optimize` or `gltfpack -cc` (meshopt), then a size
  check against the budget in the [GDD](gdd.md#11-technical-constraints).
- **Budgets:**
  - The scene with every board and piece under 4 MB compressed.
  - The title screen needs under 3 MB.
  - Under 50 draw calls and 30k triangles on screen.
- **File names:** `category_subject_variant_state.ext`, for example
  `piece_x_glaze_default.glb` or `board_3x3_walnut.glb`. Source files (`.blend`) live in
  `art/src/`; exports go to `public/assets/`.
- **Credits:** every asset gets a row in [CREDITS](../CREDITS.md) before it is committed,
  including AI assistance (none planned for final art).

## Validation (TTT-2.3)

The style guide is accepted at G2 together with a **look-development frame**: one real
in-engine render of the Classic board mid-game on the table, at the high level, made with
the actual Three.js stack.

The frame must:
1. Read as "crafted tabletop" to someone shown it cold.
2. Pass the contrast checks.
3. Hold ≤ 16.7 ms per frame while the camera moves on desktop, in the browser and the
   desktop app. A Steam Deck and a mid-range Android phone (≤ 33 ms each) are checked
   after the game is playable.
4. Fit the size budget.

Screenshots of high, low and 2D, plus the measurements, go into
research.

# Noughty Crosses: pitch

- **Name:** "Noughty Crosses" since 2026-10-30 (plan decision P29); "Noughts & Variants" was the
  working title.
- **Date:** 2026-10-01; accepted at TTT-G1 on 2026-10-01 with the 3D tabletop and crafted art direction added.
  Platform order changed on 2026-10-05: browser and desktop app first
  (plan decision P4). Gravity is 6×6 only since 2026-10-07
  (decision P6), as in the GDD.
- **Step:** TTT-1.4.
- **Size:** S.
- **Platforms:** first a browser build (itch.io and own site) and a desktop app built
  from the same code. Once the game is playable: Steam (Linux, Windows, Steam Deck), then
  Android (Google Play).
- **Price model:** free. No ads, accounts or analytics.

## Hook

Every clever way to play noughts and crosses, on a beautifully crafted 3D game table,
each mode fair or honestly labelled, against a computer that plays like a person.

## What playing feels like

You open a lamp-lit games cabinet and pick a board from its drawers: classic, the one
where three in a row loses, the one where your oldest mark fades away. The board slides
onto a wooden table; the pieces are weighty and catch the light. A one-line rule card and a ten-second
demo show the twist. You play the computer at "casual". It blocks your obvious line but
misses your fork, and you grin. You switch to "sharp", and it never misses. Next to you,
a friend takes the other side of the phone for a pass-and-play game of the vanishing
mode, where the board never fills and the tension never drops. A game takes one to three
minutes.

## Experience goal and pillars

- **Experience goal:** the small "aha" of discovering how a tiny rule change turns a
  game you thought you knew into a new puzzle (MDA: discovery and
  challenge).
- **Pillars:**
  1. **Fair or honestly labelled.** Every mode ends, has a draw rule, and states its
     balance. Modes that perfect play decides for one side are either fixed with a rule
     or not shipped. Rules out: the old 3×3×3 mode, unbalanced variants without a fix.
  2. **A computer that plays like a person.** Difficulty comes from human-looking
     mistakes, not random blunders; the strongest level is perfect where the mode is
     solved. Rules out: "easy = random", unseeded randomness.
  3. **A crafted object, everywhere.** Every mode is played on an artistically
     rendered 3D tabletop with distinctive, tactile menus that look like a professional
     game. It ships as one codebase on web, desktop and Android, loads fast, and stays
     accessible through a DOM mirror of the board. The project is also a study case for
     multi-platform delivery. Rules out: plain flat UI, engine-sized downloads, features
     that work on one platform only.

## Core loop

1. Choose a mode and an opponent (computer level or a friend).
2. Read the one-line rule card; watch the short demo the first time.
3. Play a one-to-three-minute game.
4. See the result, the winning line, and, against the computer, a hint of what you
   missed.
5. Rematch with sides swapped, or try the next mode.

## Key features

The vertical slice must prove the features marked **[slice]**.
- **[slice]** Classic and Vanishing modes on one shared rules core with move history.
- **[slice]** Computer opponent with three levels per mode, seeded and reproducible.
- **[slice]** Pass-and-play on one device, with alternating first player.
- **[slice]** Accessible board: keyboard, controller and touch play, colour-independent
  marks, text scaling. No screen-reader support for now
  (plan decision P14).
- **[slice]** Web build under the size and load budget, plus a Linux desktop app built
  from the same code.
- Seven launch modes (see Scope), each with a rule card, demo and fairness note.
- **[slice]** The 3D tabletop look for Classic and Vanishing at target quality (style
  guide), with the flat 2D board as a setting.
- Distinctive "games cabinet" menus with motion and sound.
- Steam release with a Windows build and full controller support for Steam Deck, after
  the game is playable.
- Android build for Google Play, after Steam.
- Settings: language, text size, contrast, reduced motion, sound.

## References

| Work | What we take | What we do differently | What we must not copy |
|---|---|---|---|
| The old `tictactoe-android-python` | the idea of many modes, the 3D map | fair rules, real draw rules, seeded AI, one-line rule cards (audit) | — (our own code, but not reused) |
| Ultimate tic-tac-toe apps and web versions | the nested board rule | highlighted target board, MCTS levels | names, art, UI layouts |
| Notakto (Koca; Plambeck & Whitehead) | the misère multi-board idea | board-count picker that keeps it fair | — (the mechanic is free; use a generic or own name) |
| Connect Four (Hasbro), Gobblet (Blue Orange), Qubic (Parker Brothers) | gravity, size-stacking, 4×4×4 mechanics | proven-draw board sizes, own names | the trademarked names and their art |

## Audience and platform

- **Audience:** casual players of any age, and puzzle fans who enjoy finding the trick
  in a small game. Sessions of 1–10 minutes in a browser tab or at a desk; on a Steam
  Deck or a phone later.
- **Why browser and desktop first:** the user's choice on 2026-10-05
  (plan decision P4): make the game playable on builds that come
  straight from the code on this computer, before any store or device work. The desktop
  app (Tauri) wraps the web build.
  Steam and Android reuse the same build later
  (ADR-0001).

## Scope

The modes come from the mode research.
- **Slice (G3):** Classic and **Vanishing**. In Vanishing, each player keeps three marks
  and placing a fourth removes the oldest. Rules:
  - The oldest mark stays on the board while you choose.
  - The first move may not be on an edge cell.
  - A draw on the third repetition of a position, or at 60 plies.

  With these rules, perfect play is a draw, and the mode still has real tactics.
- **Launch set (G4), fourteen modes** (8 and 9 added by plan decision P13, 10 to 13 by
  P21, 14 by P22 and P24):
  1. Classic
  2. Misère: three in a row loses; the first player must open in the centre to avoid a
     forced loss.
  3. Vanishing
  4. Big board: 5×5, four in a row; proven draw.
  5. Gravity: drop marks into the columns of a 6×6 board, four in a row; a proven draw.
  6. Ultimate: nine boards, standard rules, a free move when sent to a finished board.
  7. Notakto: both play X, completing a line loses; the player behind picks 1–3 boards.
  8. Overtime: Classic 3×3; on a draw a ring makes it 5×5, the marks stay, and play goes
     on with four in a row. Solved at TTT-4.1.11: every 3×3 draw stays a draw, so
     perfect play draws.
  9. Cube: 4×4×4, four in a row; after the 7th mark it grows once to 5×5×5, and the
     second player moves first on the grown cube. Unsolved; in computer play each side
     wins about half the games. Who starts alternates, and the setup says so (rules
     decided and built at TTT-4.1.12).
  10. Misère wild: each turn places an X or an O; three of one mark in a row loses its
      maker. A solved draw.
  11. Three men's morris: place three each, then slide; no centre on the first move. A
      solved draw.
  12. Saucer: after every third move a saucer pushes the piece just placed one cell
      clockwise, or carries it off from the centre. A solved draw.
  13. Order and Chaos: both sides place either mark on 6×6; Order wants five of one mark,
      Chaos wants none. Played in pairs of games, roles swapped.
  14. Nesting: size-stacking under our own name; pieces in three sizes cover smaller ones,
      and only top pieces count. Thought to be a first player win, so played in pairs.
- **Not now (later set):**
  - 7×7 or 8×8 with five in a row
  - gomoku with Swap2
  - online play
  - iOS
  - daily puzzles
  - achievements
- **Never, as researched:**
  - normal 3×3×3
  - three in a row on boards of 3×4 or larger
  - normal wild
  - Ultimate with play inside won boards
  - Vanishing without the opening rule
  - Quantum, which is too slow to learn
- **Content budget:**
  - 14 modes, 14 rule cards and demos, 3 computer levels per mode
  - one table scene; a board model per mode; one piece set (X, O, neutral)
  - one menu cabinet
  - about 15 sound effects and 2 music loops

## Risks and open questions

1. **Riskiest question:** can one TypeScript codebase ship a professional-looking 3D
   tabletop to the browser and the desktop now, and Steam and Android later, with a
   single pipeline, an accessible board and a web build under budget? The
   look-development frame (TTT-2.3) tests the art half. The spikes proved web and Android
   builds, and the Tauri desktop build launched on Linux
   (TTT-1.5). Steam Deck Game Mode,
   Windows and Steam overlay behaviour are still unverified.
   - **Claim:** a slice build passes CI and runs in a browser and as a Linux desktop app.
   - **Pass:** web playable in ≤ 1 s on Fast 3G, and the desktop app builds from the code
     and launches on Linux. Steam Deck Game Mode, Windows and the APK on a device are
     checked after the game is playable.
   - **Fail:** any target needs a separate codebase.
2. **AI per mode:** answered at TTT-4.1.5: Ultimate's MCTS runs in a Web Worker within
   budget on a desktop; a phone and the Deck are not measured.
3. **Vanishing rules:** answered at TTT-3.1: the rules core reproduces the solve (a draw
   with the opening rule).
4. **Teaching fourteen twists** clearly enough that each is learnt in under a minute.
5. **Scope:** fourteen modes for a size-S game. Small solved modes are cheap; Ultimate and
   Gravity are the expensive ones, and they are cut first if the schedule slips.

## Slice success criteria

At G3, measured in playtest 1:
- 4 of 5 new players learn Vanishing from its rule card and demo and finish a game
  without help.
- 4 of 5 players describe the "casual" computer as beatable but not silly, and the
  "sharp" one as fair.
- The web slice is playable in ≤ 1 s at Fast 3G. Keyboard-only play completes a game.
  There is no screen-reader support for now (plan decision P14).
- CI shows:
  - 10,000 seeded AI-vs-AI games per mode and level end within the cap, with no errors
  - perfect play from the start of Vanishing gives a draw

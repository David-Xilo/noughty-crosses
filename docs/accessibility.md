# Accessibility statement

Noughty Crosses (until 2026-10-30 "Noughts and Variants", P29), the web build and the
desktop app, version 1.0. Written at
TTT-4.2 (2026-10-29) for the README and the store page; the design and the checks are
in [GDD §9](gdd.md#9-accessibility-plan) and the
QA pass.

## What the game does

- **Keyboard only:** every screen and every game. On the board the arrows move, Enter or
  Space chooses, Esc goes back, Home and End jump. Undo, the camera and "next piece" keys
  can be remapped in Settings, which also lists the fixed keys.
- **Controller only:** every screen and every game, with the controller's own glyphs.
  On the Linux desktop app the app reads the controller itself.
- **Pointer or touch only:** every screen and every game. A move never needs a drag: a
  click or tap places, or a pick then a cell. A press can be cancelled by moving off
  before release.
- **A 2D board** instead of the 3D table, in Settings or at first launch, for low-end
  devices and for anyone who prefers it. The last move is ringed on it.
- **Pieces by shape:** X and O differ in silhouette and engraving, not only in colour;
  Notakto's one mark is the same shape for both sides. A high-contrast set (white X,
  black O, grey board, lighter brass text) is a setting and follows the system's
  "more contrast".
- **Text size** from 100% to 200% in Settings, with no sideways scrolling; the browser's
  zoom works too. Body text is Atkinson Hyperlegible, at most about 73 characters a line,
  line spacing 1.5.
- **Reduced motion:** follows the system setting or the setting in the game. Camera
  drift, shakes and drops become short fades; idle animation stops. No flashing.
- **No timers.** The computer's thinking pause is not a limit on the player. A game can
  be left and continued later: it is saved after every move.
- **Sound** is never the only channel: every sound has something on screen. Music and
  effects have their own volumes.
- **Help:** each mode has a rule card with a short demo before play; the hint after a
  game names a better move.
- **First launch** asks for graphics, text size, contrast and motion before anything
  else; the system's contrast and motion settings are read.

## What the game does not do

- **No screen-reader support** for now (plan decision P14). The board is a grid of
  buttons for the keyboard, but it is not narrated and the 3D canvas is hidden from
  assistive technology. A study of proper support (TTT-4.6) follows the first release.
- **No manual save:** one game slot, saved after every move; a new game replaces it. The
  title screen shows the saved game beside Play before that happens.
- **The computer's level is fixed for a game.** Pause → Change mode starts a new game at
  another level. Games last at most 60 moves.
- **No undo** in pass-and-play or against Sharp.
- **No last-move ring on the 3D table;** the 2D board has one, and the status line names
  the move in both.

## Accepted gaps

Measured in the accessibility pass
against the workspace baseline, and decided in TTT-4.2:

- Default body text is 15–17 px tall at 100% (the baseline asks 18 px); 125% text meets
  it, and nothing is under 15 px.
- Stamp buttons are upper case and headings small caps, the game's stamped style; body
  text is sentence case.
- Heading levels: each screen starts with its own heading; only the title screen has a
  level-1 heading.

## Reporting a problem

Say what you used (browser or desktop app, keyboard, controller or touch, the text size
and contrast settings) and what happened. Issues:
https://github.com/David-Xilo/noughty-crosses/issues (the public repository, TTT-5.2).

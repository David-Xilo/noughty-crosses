# Every string the player reads or hears (GDD §10, TTT-4.1.8). Messages with a `.aria-label`
# or `.title` attribute label an element; `data-l10n-id` in index.html names its message.
# Variables such as $mode and $who arrive already translated; $side is X or O.

app-title = Noughty Crosses
back = Back
play = Play
settings = Settings
how-to-play = How to play
change-mode = Change mode
rule-card =
    .aria-label = Rule card

## Title and cabinet (GDD §6)

main-menu =
    .aria-label = Main menu
continue = Continue
credits = Credits
quit = Quit
choose-game = Choose a game
continue-computer = Continue: { $mode } vs { $level }, { $computerMoves ->
        [yes] the computer's move
       *[no] your move
    }
continue-friend = Continue: { $mode } with a friend, { $who } to move
save-unreadable = The saved game could not be read, so it cannot continue. It is kept on this device.
how-to-play-mode =
    .aria-label = How to play { $mode }
badge-beat = Beat Sharp
badge-drew = Drew Sharp

## Modes (GDD §3)

mode-classic = Classic
mode-classic-rule = Three in a row wins. A full board is a draw.
mode-classic-fairness = Perfect play draws.
mode-vanishing = Vanishing
mode-vanishing-rule = Each side keeps three marks: place a fourth and your oldest vanishes.
mode-vanishing-fairness = Perfect play draws. No edge on the first move; a draw on a third repeat.
mode-misere = Misère
mode-misere-rule = Three of your own in a row loses. A full board is a draw.
mode-misere-fairness = Perfect play draws. Tip: there's only one safe first move.
mode-misere-wild = Misère wild
mode-misere-wild-rule = Place an X or an O, your choice. Three of one mark in a row loses for whoever placed it.
# Solved (research TTT-4.1.15): a draw, and only the centre is a safe first move.
mode-misere-wild-fairness = Perfect play draws. Tip: there's only one safe first move.
mode-morris = Three men's morris
mode-morris-rule = Place three pieces each, then slide one to a neighbouring empty cell along a line. Three in a row wins.
# Solved (research TTT-4.1.16): a draw. A first piece in the centre would win, so it is not allowed.
mode-morris-fairness = Perfect play draws. No centre on the first move; a draw on a third repeat.
mode-saucer = Saucer
mode-saucer-rule = Every third piece placed, a flying saucer pushes it one cell clockwise around the edge, or carries it off from the centre. Three in a row wins.
# Solved (research TTT-4.1.17): a draw from every first move. A first piece in the centre
# would win, so it is not allowed.
mode-saucer-fairness = Perfect play draws. No centre on the first move.
mode-nesting = Nesting
mode-nesting-rule = Pieces come in three sizes. Place one, or move one of yours, onto an empty cell or over a smaller piece. Three on top in a row wins.
# Not solved by us (research TTT-4.1.19): the first player is thought to win, and Sharp
# against Sharp agrees.
mode-nesting-fairness = The first player is thought to win with perfect play. Play two games, so each side starts once.
mode-notakto = Notakto
mode-notakto-rule = Both sides play X. Three in a row kills a board; whoever kills the last board loses.
# Solved (research TTT-1.3, checked by the solver in test/core/notakto.test.ts): an odd
# number of boards wins for the first player, an even one for the second.
mode-notakto-fairness = { $boards ->
        [1] With one board, perfect play wins for the player who moves first.
        [2] With two boards, perfect play wins for the player who moves second.
       *[3] With three boards, perfect play wins for the player who moves first.
    }
mode-notakto-solved = Solved: the number of boards decides who wins.
mode-bigboard = Big board
mode-bigboard-rule = Four in a row wins on a 5 by 5 board. A full board is a draw.
# A proven draw (research TTT-1.3: boards up to 5×5 with k=4 are draws).
mode-bigboard-fairness = Perfect play draws.
mode-overtime = Overtime
mode-overtime-rule = Three in a row wins. A draw grows the board to 5 by 5, every mark stays, and then four in a row wins. When no four is left open for either side, it is a draw.
# Solved offline (research TTT-4.1.11, tools/solve-overtime.mjs): every 3×3 draw stays a
# draw on the grown board, so perfect play draws.
mode-overtime-fairness = Perfect play draws, before and after the board grows.
mode-gravity = Gravity
mode-gravity-rule = Drop your mark into a column of the 6 by 6 board. Four in a row wins.
# A proven draw on 6×6 (research TTT-1.3, Tromp's table).
mode-gravity-fairness = Perfect play draws.
mode-order-chaos = Order and Chaos
mode-order-chaos-rule = Both sides place an X or an O, their choice. Order wants five of one mark in a row; Chaos wins once no five can be made. Order moves first.
# Unsolved for certain; weak sources claim a forced win for Order (research TTT-4.1.18).
mode-order-chaos-fairness = Order is thought to win with perfect play. Play two games, so each side has a turn as Order.
mode-ultimate = Ultimate
mode-ultimate-rule = Nine boards in one: the cell you play sends your opponent to that board. Claim three boards in a row.
# Unsolved under these rules (research TTT-1.3).
mode-ultimate-fairness = Unsolved: a test of skill.
mode-cube = Cube
mode-cube-rule = Four in a line wins, in any direction through a 4 by 4 by 4 cube. After the 7th mark the cube grows to 5 by 5 by 5.
# Unsolved (research TTT-4.1.12): computer play is about even, because the growth after the
# first player's 7th mark gives the grown cube's first move to the second player.
mode-cube-fairness = Not solved. The first player wins about 6 in 10 computer games. Sides take turns to start, so a series is even.

## Rule card demos (GDD §3, src/app/demos.ts): one caption per keyed move

demo-step = Step
demo-play = Play
demo-pause = Pause
demo-caption = { $caption } ({ $ply } of { $total })
demo-classic-0 = X and O take turns. Three in a row wins.
demo-classic-5 = X threatens two lines at once: a fork.
demo-classic-6 = O can block only one of them.
demo-classic-7 = X completes the other line and wins.
demo-vanishing-0 = Each side keeps only three marks.
demo-vanishing-5 = X has three marks. Its oldest one fades: it goes when X places again.
demo-vanishing-6 = O has three marks too, so O's oldest mark fades.
demo-vanishing-7 = X places a fourth mark: the faded one vanishes, and X has three in a row.
demo-misere-0 = Three of your own in a row loses.
demo-misere-1 = X opens in the centre: the only safe first move.
demo-misere-7 = O has two cells left, and each one makes three O's in a row.
demo-misere-8 = O must play, and loses.
demo-misere-wild-0 = Each turn, place an X or an O. Three of one mark in a row loses.
demo-misere-wild-1 = Player 1 opens in the centre: the only safe first move.
demo-misere-wild-7 = Every empty cell now completes a line, whichever mark goes there.
demo-misere-wild-8 = Player 2 must play, and loses.
demo-morris-0 = Each side places three pieces. Three in a row wins.
demo-morris-6 = All six pieces are down. Now each turn slides a piece to a neighbouring empty cell, along a line.
demo-morris-7 = X slides into the centre. The middle column now needs only its top cell.
demo-morris-9 = O left it open: X slides in and wins with three in a column.
demo-saucer-0 = Every third piece placed, a flying saucer comes for it.
demo-saucer-3 = The third piece: the saucer pushes X's corner piece one cell clockwise, up the left edge.
demo-saucer-6 = The sixth piece, O's in the centre, is carried away. The centre is empty again.
demo-saucer-9 = X aims the ninth piece: the saucer pushes it into the corner, and the left column is X's.
demo-nesting-0 = Each side has two small, two medium and two large pieces. A move places one, or moves one already on the board.
demo-nesting-3 = X covers O's small piece with a medium one. Only the top piece counts.
demo-nesting-5 = Nothing covers a large piece. X now threatens two lines.
demo-nesting-7 = O blocked one, and X completes the right column.
demo-notakto-0 = Both players place the same X. Three in a row kills the board.
demo-notakto-1 = With one board, perfect play wins for the player who moves first.
demo-notakto-5 = Every empty cell now makes three in a row.
demo-notakto-6 = Player 2 must play, kills the last board and loses.
demo-bigboard-0 = Four in a row wins on the 5 by 5 board.
demo-bigboard-5 = X has three in a column with both ends open.
demo-bigboard-6 = O blocks one end.
demo-bigboard-7 = X takes the other end: four in a row.
demo-overtime-0 = Classic first: three in a row wins.
demo-overtime-9 = A draw: a ring grows the board to 5 by 5. Now four in a row wins.
demo-overtime-10 = O moves first on the bigger board, and has three on a diagonal of four.
demo-overtime-12 = X did not block: O completes the diagonal and wins.
demo-gravity-0 = Pick a column: your mark drops to its lowest empty cell.
demo-gravity-5 = X has three along the bottom with both ends open.
demo-gravity-6 = O blocks one end.
demo-gravity-7 = X drops into the other: four in a row.
demo-order-chaos-0 = Each turn, place an X or an O. Order wants five of one mark in a row; Chaos wants none.
demo-order-chaos-5 = Order has three X down a column, with room at both ends. Chaos must block it now.
demo-order-chaos-7 = Chaos looked away: four X with both ends open. Chaos can block only one.
demo-order-chaos-9 = Order fills the other end: five in a row.
demo-ultimate-0 = Nine small boards make one big board.
demo-ultimate-1 = The cell you play picks the board your opponent plays in next.
demo-ultimate-5 = Three in a row on a small board claims it. Sent to a decided board, you may play on any open board.
demo-cube-0 = Four in a line wins: along a row, a column, a pillar or any diagonal of the cube.
demo-cube-5 = X has three in a row, but O blocks one end and the cube's edge stops the other.
demo-cube-7 = After the 7th mark the cube grows by a layer on the top, right and back. O moves first now.
demo-cube-9 = The new cells give X's row a fourth cell. O did not block it: X wins.

## Setup (GDD §6)

set-up-game = Set up a game
boards = Boards
boards-one = One
boards-two = Two
boards-three = Three
fair-start = Fair start: the first four moves are random
opponent = Opponent
opponent-computer = Computer
opponent-friend = A friend, same device
computer = Computer
level-casual = Casual
level-keen = Keen
level-sharp = Sharp
your-side = You play X and move
side-first = First
side-second = Second
side-alternate = Alternate
you-can-win = You can win.
computer-can-win = The computer can win.
# Order and Chaos: the role the player's side setting gives (OC1).
your-role = { $side ->
        [first] You play Order.
        [second] You play Chaos.
       *[alternate] You swap roles each game.
    }
record = Your record against { $level }: { $win ->
        [one] { $win } win
       *[other] { $win } wins
    }, { $draw ->
        [one] { $draw } draw
       *[other] { $draw } draws
    }, { $loss ->
        [one] { $loss } loss
       *[other] { $loss } losses
    }.

## Play (GDD §6, §7)

pause = Pause
undo = Undo
camera =
    .aria-label = Camera
# Cube: buttons that move the board's cursor one layer up or down.
layer-buttons =
    .aria-label = Layer
layer-up = Layer up
layer-down = Layer down
you = You
the-computer = The computer
# Notakto's sides both place X, and Misère wild's both place either mark, so they are
# named by number.
player = Player { $n }
# Order and Chaos: the sides are named by their roles (OC1).
role-order = Order
role-chaos = Chaos
you-play = { $role ->
        [order] You play Order: make five of one mark in a row.
       *[chaos] You play Chaos: stop every five.
    }
computer-thinking = The computer is thinking…
your-move = Your move{ $where ->
        [board] , on board { $board }
        [any] , on any open board
       *[none] {""}
    }.
to-move = { $who } to move{ $where ->
        [board] , on board { $board }
        [any] , on any open board
       *[none] {""}
    }.
played = { $who } played { $cell }.
# Misère wild, Order and Chaos: a move names its mark and its cell.
wild-move = { $mark } at { $cell }
# Three men's morris: a slide names the cell it leaves and the cell it reaches.
slide-move = from { $from } to { $to }
moved = { $who } moved from { $from } to { $to }.
# Saucer: a visit after every third move (S3). The side is X or O.
saucer-pushed = The saucer pushed { $side } from { $from } to { $to }.
saucer-stayed = The saucer could not push { $side } at { $cell }: the next cell is taken.
saucer-carried = The saucer carried { $side } away from the centre.
saucer-next = The saucer takes the next piece placed.
picked-up = Picked up the piece at { $cell }. Choose a neighbouring empty cell, or the piece again to put it back.
# Nesting: a move names its piece's size (NE2).
nest-placed = { $who } placed a { $size ->
        [small] small
        [medium] medium
       *[large] large
    } piece on { $cell }.
nest-moved = { $who } moved a { $size ->
        [small] small
        [medium] medium
       *[large] large
    } piece from { $from } to { $to }.
nest-from-tray = { $size ->
        [small] Small
        [medium] Medium
       *[large] Large
    } piece in hand. Put it on an empty cell or over a smaller piece, or press the tray piece again to put it back.
nest-picked-up = { $size ->
        [small] Small
        [medium] Medium
       *[large] Large
    } piece in hand, from { $cell }. Put it on an empty cell or over a smaller piece, or press it again to put it back.
# Nesting: the tray beside the board, the side's pieces still off the board (NE1): a heading
# with the side and the key that takes the next size, then one stamp per size with its name,
# the count left, and "in hand" on the one held (NE2).
tray =
    .aria-label = Pieces off the board
tray-title = { $side }'s pieces
tray-hint = { $key }: next size
tray-size = { $size ->
        [small] Small
        [medium] Medium
       *[large] Large
    }
tray-left = × { $left }
tray-held = in hand
tray-piece =
    .aria-label = { $size ->
        [small] Small
        [medium] Medium
       *[large] Large
    } { $side }, { $left } left
# Misère wild, Order and Chaos: the button that shows the mark the player places next, and swaps it.
mark-now = Place { $mark }
mark-swap =
    .aria-label = Place { $mark }. { $action } ({ $key })
    .title = { $action } ({ $key })
overtime-grew = A draw on 3 by 3: the board grows to 5 by 5. Now four in a row wins.
cube-grew = After the 7th mark the cube grows to 5 by 5 by 5, with new cells on the top, right and back. Four in a line still wins.
wait-computer = Wait for the computer's move.
refused-edge = The first move may not be on an edge. Choose a corner or the centre.
refused-dead = That board is dead: play on a live board.
refused-full = That column is full.
refused-sent = Play on the glowing board: the last move sent you there.
refused-closed = That board is decided: play on a glowing board.
refused-taken = That cell is taken.
refused-centre = The first piece may not go in the centre.
refused-stuck = That piece has no empty cell next to it.
refused-pick = First choose one of your pieces to move.
refused-slide = Move to an empty cell next to the piece, along a line.
refused-hold = First choose a piece: one from the tray beside the board, or one of yours on the board.
refused-fit = That piece fits only on an empty cell or over a smaller piece.
computer-search-failed = The computer could not move. Pause and resume to try again.
computer-load-failed = The computer could not load. Check the connection and try again.
undone = You took back your move.
fading = Fading: { $marks }.
fading-mark = { $side } at { $cell }

# A cell inside a sentence.
cell-ref = row { $row }, column { $column }
cell-ref-board = board { $board }, row { $row }, column { $column }
cell-ref-layer = layer { $board }, row { $row }, column { $column }
# Cube: the name over each layer of the 2D board, numbered from the bottom.
cube-layer = { $top ->
        [yes] Layer { $n }, the top
       *[no] { $n ->
            [1] Layer 1, the bottom
           *[other] Layer { $n }
        }
    }

## Result (R9, GDD §4.2)

result-draw = Draw
result-you-win = You win
result-computer-wins = The computer wins
result-wins = { $who } wins
result-status = { $moved } { $title }.
line-made = { $count ->
        [3] Three
        [5] Five
       *[4] Four
    } in a row, from { $from } to { $to }.
line-made-last = { $count ->
        [3] Three
       *[4] Four
    } in a row on the last live board, from { $from } to { $to }.
line-made-by = { $who } made { $count ->
        [3] three
        [5] five
       *[4] four
    } in a row, from { $from } to { $to }.
line-made-by-last = { $who } made { $count ->
        [3] three
       *[4] four
    } in a row on the last live board, from { $from } to { $to }.
# Nesting: the last mover lifted a piece off the other side's line (NE4).
nest-uncovered = { $who } uncovered the other side's three in a row, from { $from } to { $to }.
# Ultimate: three claimed boards in a row (U5).
boards-made = Three boards in a row, from board { $from } to board { $to }.
draw-board-full = The board is full.
# Order and Chaos: Chaos's win (OC3).
no-five-left = Every line of five holds both marks: no five can be made.
draw-repetition = The same position came up a third time.
draw-ply-cap = Sixty moves without a winner.
draw-no-line = Neither side can still claim three boards in a row.
draw-dead-board = No line of four is open for either side.
moves = { $moves ->
        [one] { $moves } move.
       *[other] { $moves } moves.
    }
hint-no-mistake-loss = You made no mistake: from the start, perfect play wins for the computer.
hint-no-mistake-draw = You made no mistake: with perfect play this game was a draw.
hint-missed-win = Hint: on move { $ply } you had a forced win. Try { $better } instead of { $played }.
hint-better = Hint: on move { $ply } you played { $played }. Try { $better } instead.
rematch = Rematch

## Pause

paused = Paused
resume = Resume

## Settings (GDD §8) and the first-launch welcome (§6)

welcome = Welcome
welcome-intro = Set up how the game looks. You can change this any time in Settings.
welcome-done = Continue
graphics = Graphics
gfx-high = High
gfx-low = Low
gfx-2d = 2D board
text-size = Text size
percent = { $n }%
high-contrast = High contrast
reduced-motion = Reduced motion
master-volume = Volume
music-volume = Music
effects-volume = Sound effects
music-in-play = Music during play
vibration = Vibration
camera-sensitivity = Camera sensitivity
keys = Keys
keys-reset = Reset keys
# The keys that cannot be remapped, so they can be looked up here at any time (GDD §9, G5).
keys-fixed = On the board: the arrows move, Enter or Space chooses, Esc goes back, Home and End jump to the first and last cell.
keys-reset-done = Keys reset.
your-settings = Your settings
export = Export
import = Import
settings-exported = Settings exported.
settings-imported = Settings imported.
settings-not-a-file = That file is not a settings file. Nothing changed.

## Keys (GDD §5): the actions, and the keys by name

action-rotateLeft = Turn left
action-rotateRight = Turn right
action-tiltUp = Tilt up
action-tiltDown = Tilt down
action-resetCamera = Reset camera
action-undo = Undo
action-swapMark = Swap mark
# Letters and F1 to F12 show as they are.
key-name = { $key ->
        [PageUp] Page Up
        [PageDown] Page Down
        [Insert] Insert
        [Delete] Delete
        [Backspace] Backspace
       *[other] { $key }
    }
key-press = Press a key…
key-button =
    .aria-label = { $action }: { $key }. Change
camera-button =
    .aria-label = { $action } ({ $key })
    .title = { $action } ({ $key })
remap-prompt = Press the new key for { $action }, or Esc to keep { $key }.
remap-kept = { $action } keeps { $key }.
remap-fixed = The arrows, Home, End, Enter, Space, Tab and Esc keep their own jobs. Choose another key.
remap-invalid = Choose a letter, a digit or another key.
remap-done = { $action }: { $key }.
remap-swapped = { $action } now uses { $key }.

## Controller prompts (style guide, "Controller and Steam Deck")

pad-choose = Ⓐ Choose
pad-back = Ⓑ Back
pad-undo = Ⓨ Undo
pad-swap = Ⓧ Swap mark
pad-next-piece = Ⓧ Next piece
pad-camera = Right stick: camera

## Credits (GDD §6): the rows come from CREDITS.md as written

credits-people = Made by
credits-assets = Assets
credits-code = Code and fonts
credits-version = Version { $version }
credits-notices = The licence texts of the code and fonts

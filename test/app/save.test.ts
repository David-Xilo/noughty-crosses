// The autosave (GDD §8, R6, R7): fixture saves of version 1 are read or refused, and a game
// continued from a save plays on exactly as it would have without the break.
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Match, type Setup } from "../../src/app/match";
import { readSave, toSave } from "../../src/app/save";

const fixture = (name: string): unknown =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../fixtures/saves/${name}.json`), "utf8"));

// The solved tables load as in the game, from public/assets.
beforeAll(() => {
  vi.stubGlobal("fetch", async (url: string) => {
    const file = path.resolve(__dirname, "../../public", url.replace("./", ""));
    return new Response(fs.readFileSync(file));
  });
});

/** Plays the computer's turns and the player's first legal move until the game ends. */
async function playOut(m: Match, stopAt = Number.POSITIVE_INFINITY) {
  await m.prepare();
  while (!m.result && m.record.moves.length < stopAt) {
    const cell = m.computerToMove ? await m.computerMove() : (m.legal()[0] as number);
    expect(m.play(cell)).toBe(true);
  }
  return m;
}

describe("saves, version 1", () => {
  it("reads a Vanishing game against Keen, mid-game, and replays its moves", () => {
    const read = readSave(fixture("v1-vanishing-keen"));
    if (!("match" in read)) throw new Error(read.error);
    expect(read.match.setup).toMatchObject({
      mode: "vanishing",
      opponent: "computer",
      level: "keen",
    });
    expect(read.match.record.moves).toEqual([4, 5, 3, 2]);
    expect(read.match.toMove).toBe("X");
  });

  it("reads a three-board Notakto game with a friend and an Ultimate fair start", () => {
    for (const name of ["v1-notakto-friend", "v1-ultimate-fair"]) {
      const read = readSave(fixture(name));
      expect(read, name).toHaveProperty("match");
    }
    const ultimate = readSave(fixture("v1-ultimate-fair"));
    if ("match" in ultimate) expect(ultimate.match.opening).toBe(4); // U6, from the seed
  });

  it("refuses a save with an illegal move, an unknown version or a broken setup", () => {
    expect(readSave(fixture("corrupt-illegal-move"))).toEqual({ error: "illegal move 4" });
    expect(readSave(fixture("corrupt-future-version"))).toEqual({ error: "unknown version 2" });
    expect(
      readSave({ ...(fixture("v1-vanishing-keen") as object), setup: { mode: "chess" } }),
    ).toEqual({ error: "bad setup" });
    expect(readSave("not json at all")).toEqual({ error: "not a save" });
  });

  it("R6: a game continued from a save at any ply plays the same computer moves", async () => {
    const setups: Setup[] = [
      {
        mode: "vanishing",
        opponent: "computer",
        level: "keen",
        side: "first",
        boards: 1,
        fair: false,
      },
      {
        mode: "notakto",
        opponent: "computer",
        level: "casual",
        side: "second",
        boards: 3,
        fair: false,
      },
    ];
    for (const setup of setups) {
      const whole = await playOut(new Match(setup, 2026, setup.side === "second" ? "O" : "X"));
      for (let ply = 0; ply < whole.record.moves.length; ply++) {
        const first = await playOut(new Match(setup, 2026, whole.record.first), ply);
        const read = readSave(JSON.parse(JSON.stringify(toSave(first))));
        if (!("match" in read)) throw new Error(read.error);
        const resumed = await playOut(read.match);
        expect(resumed.record.moves, `${setup.mode} from ply ${ply}`).toEqual(whole.record.moves);
      }
    }
  });
});

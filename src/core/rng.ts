// Seeded random generator for the rules core: xoshiro128** (Blackman & Vigna), seeded
// through SplitMix32. 32-bit only, so it is fast and exact in JavaScript. The state is four
// numbers and can be saved with a game (GDD rule R6).

export type RngState = readonly [number, number, number, number];

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, n). */
  int(n: number): number;
  state(): RngState;
}

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

export function createRng(seedOrState: number | RngState): Rng {
  let s: [number, number, number, number];
  if (typeof seedOrState === "number") {
    const sm = splitmix32(seedOrState);
    s = [sm(), sm(), sm(), sm()];
  } else {
    s = [...seedOrState];
  }
  const nextU32 = () => {
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    s = [s[0] >>> 0, s[1] >>> 0, s[2] >>> 0, s[3] >>> 0];
    return result;
  };
  return {
    next: () => nextU32() / 4294967296,
    int: (n) => Math.floor((nextU32() / 4294967296) * n),
    state: () => [s[0], s[1], s[2], s[3]],
  };
}

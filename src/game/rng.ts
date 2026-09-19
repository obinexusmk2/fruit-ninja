/* eslint-disable no-bitwise -- mulberry32 is a bit-mixing PRNG; the operators are intentional. */

/** A source of uniform random numbers in [0, 1). */
export type Rng = () => number;

/** Small, fast, seedable PRNG (mulberry32) so simulations are reproducible in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

/** Inclusive integer range. */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

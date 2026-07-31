/** Deterministic PRNG so the same seed string always produces the same mock data. */
export type SeededRandom = () => number;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, good-enough distribution for mock data. */
export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeed(seed) || 1;

  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: SeededRandom, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randomFloat(rng: SeededRandom, min: number, max: number, decimals = 1): number {
  const value = rng() * (max - min) + min;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function randomBool(rng: SeededRandom, probabilityTrue: number): boolean {
  return rng() < probabilityTrue;
}

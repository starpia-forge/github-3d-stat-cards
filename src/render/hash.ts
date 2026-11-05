/** Deterministic pseudo-randomness: the same input always draws the same Card. */
export function hash(i: number, j: number, seed: number): number {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** A standard normal sample. */
export function gauss(seed: number): number {
  const u = Math.max(1e-6, hash(seed, 1, 3));
  const v = hash(seed, 2, 3);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** A repository's seed from its opaque key. */
export const seedOf = (key: string): number => parseInt(key.slice(0, 8), 16) | 0;

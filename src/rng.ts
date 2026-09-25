// Seeded randomness: one seed per run, so any run can be replayed and bugs reproduced.

/** FNV-1a hash of a string to a 32-bit unsigned seed. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Short human-readable seed for display and sharing, e.g. "K7Q2-M9XA". */
export function randomSeedString(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    if (i === 4) out += '-';
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  }

  /** mulberry32: float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Approximately normal sample (sum of uniforms), for monitor noise. */
  normal(mean = 0, sd = 1): number {
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += this.next();
    return mean + (sum - 3) * sd * Math.SQRT2;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick() on empty array');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Returns a shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  weightedPick<T>(items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
    if (total <= 0) throw new Error('weightedPick() with no positive weights');
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weight(item));
      if (roll < 0) return item;
    }
    return items[items.length - 1]!;
  }
}

/**
 * Independent stream for one day of a run. Deriving from (seed, day) rather than
 * continuing one stream keeps Day N identical no matter what the player did earlier.
 * `attempt` lets day validation reroll deterministically.
 */
export function dayRng(runSeed: string, day: number, attempt = 0): Rng {
  return new Rng(hashSeed(`${runSeed}:day${day}:try${attempt}`));
}

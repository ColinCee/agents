// How sure a rule's effect is, from chances to break it and misses, counted per session: misses clump within a
// session, so sessions are shuffled and resampled whole, never single chances.

export type Unit = { chances: number; misses: number };
export type Pair = { old: Unit; new: Unit };
export type Effect = {
  off: number; // share of chances missed without the rule
  on: number;
  drop: number; // 1 - on / off: 0.5 is a halving, below 0 is worse
  low: number; // 90% range of the drop
  high: number;
  p: number; // how often shuffled groups differ at least this much
};
export type Verdict = "works" | "no useful effect" | "can't tell";

/** A drop smaller than this is not worth a rule's place in the every-turn file. */
export const USEFUL_DROP = 0.3;

/** A seeded generator (mulberry32), so a look taken twice gives the same answer. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rate = (units: Unit[]): number => {
  let chances = 0;
  let misses = 0;
  for (const u of units) {
    chances += u.chances;
    misses += u.misses;
  }
  return chances ? misses / chances : Number.NaN;
};
const dropOf = (off: number, on: number): number => (off > 0 ? 1 - on / off : Number.NaN);
const draw = <T>(from: T[], rng: () => number): T[] => from.map(() => from[Math.floor(rng() * from.length)] as T);

function range(drops: number[]): { low: number; high: number } {
  const sorted = drops.filter((d) => !Number.isNaN(d)).sort((a, b) => a - b);
  if (!sorted.length) return { low: Number.NaN, high: Number.NaN };
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
  return { low: at(0.05), high: at(0.95) };
}

const ROUNDS = 5000; // the p limit in use is 0.02: 5,000 shuffles put about 100 beyond it, enough to place p either side

/** Two groups of sessions, one with the rule and one without. */
export function compare(off: Unit[], on: Unit[], rng: () => number, rounds = ROUNDS): Effect {
  const [rateOff, rateOn] = [rate(off), rate(on)];
  const gap = Math.abs(rateOn - rateOff);
  const all = [...off, ...on];
  let beyond = 0;
  const drops: number[] = [];
  for (let i = 0; i < rounds; i++) {
    for (let k = all.length - 1; k > 0; k--) {
      const j = Math.floor(rng() * (k + 1));
      [all[k], all[j]] = [all[j] as Unit, all[k] as Unit];
    }
    if (Math.abs(rate(all.slice(off.length)) - rate(all.slice(0, off.length))) >= gap - 1e-12) beyond++;
    drops.push(dropOf(rate(draw(off, rng)), rate(draw(on, rng))));
  }
  return { off: rateOff, on: rateOn, drop: dropOf(rateOff, rateOn), ...range(drops), p: (beyond + 1) / (rounds + 1) };
}

/** The same moments answered under the old and the new rule, grouped by the session they came from. */
export function comparePaired(sessions: Pair[], rng: () => number, rounds = ROUNDS): Effect {
  const rates = (pairs: Pair[]) => [rate(pairs.map((x) => x.old)), rate(pairs.map((x) => x.new))] as const;
  const [rateOld, rateNew] = rates(sessions);
  const gap = Math.abs(rateNew - rateOld);
  let beyond = 0;
  const drops: number[] = [];
  for (let i = 0; i < rounds; i++) {
    const [a, b] = rates(sessions.map((x) => (rng() < 0.5 ? x : { old: x.new, new: x.old })));
    if (Math.abs(b - a) >= gap - 1e-12) beyond++;
    const [o, n] = rates(draw(sessions, rng));
    drops.push(dropOf(o, n));
  }
  return { off: rateOld, on: rateNew, drop: dropOf(rateOld, rateNew), ...range(drops), p: (beyond + 1) / (rounds + 1) };
}

/** `pLimit` is 0.02 at each of a live trial's three looks, which keeps false passes near 5% over all three; 0.05 for a replay's single look. */
export function verdict(e: Effect, pLimit: number): Verdict {
  if (e.p < pLimit && e.drop > 0) return "works";
  if (e.high < USEFUL_DROP) return "no useful effect";
  return "can't tell";
}

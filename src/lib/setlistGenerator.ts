export type GenSong = { id: string; duration: number };

export type GenOptions = {
  songs: GenSong[];
  history: string[][];
  targetSeconds: number;
  toleranceSeconds?: number;
  exclude?: string[];
  attempts?: number;
  random?: () => number;
};

export type GenResult = { ids: string[]; total: number; knownTransitions: number };

export function buildTransitions(history: string[][]) {
  const map = new Map<string, Map<string, number>>();
  for (const seq of history) {
    for (let i = 0; i < seq.length - 1; i++) {
      const a = seq[i]!;
      const b = seq[i + 1]!;
      if (a === b) continue;
      const inner = map.get(a) ?? new Map<string, number>();
      inner.set(b, (inner.get(b) ?? 0) + 1);
      map.set(a, inner);
    }
  }
  return map;
}

function buildOpeners(history: string[][]) {
  const map = new Map<string, number>();
  for (const seq of history) {
    const first = seq[0];
    if (first) map.set(first, (map.get(first) ?? 0) + 1);
  }
  return map;
}

export function generateSetlist(opts: GenOptions): GenResult {
  const tol = opts.toleranceSeconds ?? 300;
  const target = opts.targetSeconds;
  const rnd = opts.random ?? Math.random;
  const excluded = new Set(opts.exclude ?? []);
  const pool = opts.songs.filter((s) => s.duration > 0 && !excluded.has(s.id));
  const trans = buildTransitions(opts.history);
  const openers = buildOpeners(opts.history);
  const attempts = opts.attempts ?? 300;

  let best: GenResult = { ids: [], total: 0, knownTransitions: 0 };
  let bestScore = Infinity;

  for (let a = 0; a < attempts && pool.length; a++) {
    const used = new Set<string>();
    const ids: string[] = [];
    let total = 0;
    let known = 0;
    while (total < target - tol) {
      const last = ids[ids.length - 1];
      const cands = pool.filter((s) => !used.has(s.id) && total + s.duration <= target);
      if (!cands.length) break;
      const weights = cands.map((c) =>
        last ? 1 + 8 * (trans.get(last)?.get(c.id) ?? 0) : 1 + 4 * (openers.get(c.id) ?? 0),
      );
      const sum = weights.reduce((x, y) => x + y, 0);
      let r = rnd() * sum;
      let pick = cands[cands.length - 1]!;
      for (let i = 0; i < cands.length; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          pick = cands[i]!;
          break;
        }
      }
      if (last && (trans.get(last)?.get(pick.id) ?? 0) > 0) known++;
      used.add(pick.id);
      ids.push(pick.id);
      total += pick.duration;
    }
    const diff = target - total;
    const inWindow = diff >= 0 && diff <= tol;
    const score = (inWindow ? 0 : 100000 + diff) - known * 120 + rnd() * 60;
    if (score < bestScore) {
      bestScore = score;
      best = { ids, total, knownTransitions: known };
    }
  }
  return best;
}

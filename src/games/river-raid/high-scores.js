// Browser-storage high-score table for River Raid (T-202).
//
// Keeps the top MAX_HIGH_SCORES scores in localStorage under a single key. The
// module is DOM-free: every function takes a Web Storage-like object (anything
// with getItem/setItem), so node:test can drive it with a fake storage and the
// browser can pass window.localStorage. Storage access is guarded: a blocked or
// unavailable storage degrades to an in-memory no-op instead of throwing, so a
// privacy-restricted browser cannot break the game or the portal.

export const HIGH_SCORE_KEY = 'river-raid.highscores';
export const MAX_HIGH_SCORES = 5;

function safeStorage(target) {
  try {
    return target?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function defaultStorage(target = globalThis) {
  return safeStorage(target);
}

// Coerces an arbitrary stored value into a sorted, bounded list of scores.
// Anything non-numeric or negative is dropped rather than trusted.
export function normalizeScores(value) {
  if (!Array.isArray(value)) return [];
  const scores = [];
  for (const entry of value) {
    // Reject null/undefined/booleans/blank strings explicitly: Number(null) is
    // 0, which would otherwise smuggle a bogus entry into the table.
    if (entry === null || entry === undefined || typeof entry === 'boolean') continue;
    if (typeof entry === 'string' && entry.trim() === '') continue;
    const number = Number(entry);
    if (!Number.isFinite(number) || number < 0) continue;
    scores.push(Math.trunc(number));
  }
  return scores.sort((a, b) => b - a).slice(0, MAX_HIGH_SCORES);
}

export function readHighScores(storage, key = HIGH_SCORE_KEY) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return [];
    return normalizeScores(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeHighScores(storage, scores, key) {
  try {
    storage?.setItem(key, JSON.stringify(scores));
  } catch {
    // A blocked/unavailable storage must not break the game; the table simply
    // does not persist for this session.
  }
}

// Records one finished run and returns the new table plus where the score
// landed. `recorded` is false when the score is not a usable number, so callers
// can distinguish "nothing stored" from "stored at rank 1".
export function recordHighScore(storage, score, key = HIGH_SCORE_KEY) {
  const scores = readHighScores(storage, key);
  const value =
    typeof score === 'number' || typeof score === 'string' ? Number(score) : Number.NaN;
  if (!Number.isFinite(value) || value < 0) {
    return { scores, rank: null, isNewHighScore: false, recorded: false };
  }

  const entry = Math.trunc(value);
  const previousBest = scores[0] ?? null;
  const next = normalizeScores([...scores, entry]);
  writeHighScores(storage, next, key);

  return {
    scores: next,
    rank: next.indexOf(entry) + 1,
    isNewHighScore: previousBest === null || entry > previousBest,
    recorded: true,
  };
}

export function bestScore(storage, key = HIGH_SCORE_KEY) {
  return readHighScores(storage, key)[0] ?? null;
}

// Fixed-width display form shared by the game-over screen and the portal card.
export function formatScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0) return '------';
  return String(Math.trunc(value)).padStart(6, '0');
}

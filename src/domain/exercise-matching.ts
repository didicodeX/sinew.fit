/**
 * Exercise name normalisation and matching. Powers the shared exercise picker
 * and the import matcher, so "Pull ups" / "Pull-ups" / "pullups" never split history.
 */
import type { ExerciseDef } from "./types";

const COMPOUNDS: Record<string, string> = {
  pullup: "pull up",
  chinup: "chin up",
  pushup: "push up",
  situp: "sit up",
  muscleup: "muscle up",
  lsit: "l sit",
  hspu: "handstand push up",
  rdl: "romanian deadlift",
};

/** Words that end in "s" but are not plurals. */
const KEEP_S = new Set(["press", "abs", "glutes", "lats", "triceps", "biceps", "quads", "hamstrings", "plus", "ss"]);

function singular(word: string): string {
  if (KEEP_S.has(word) || word.length <= 2) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Lowercase, strip accents and punctuation. No singularisation (safe for partial input). */
export function looseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[-_/.,()'’"+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Canonical key: loose name, compounds split ("pullup" → "pull up"), each word singularised. */
export function normalizeExerciseName(name: string): string {
  const words: string[] = [];
  for (const w of looseName(name).split(" ")) {
    if (!w) continue;
    const s = singular(w);
    const compound = COMPOUNDS[s] ?? COMPOUNDS[w];
    words.push(...(compound ? compound.split(" ") : [s]));
  }
  return words.join(" ");
}

export type MatchResult =
  | { kind: "exact"; exercise: ExerciseDef; via: "name" | "alias" }
  | { kind: "suggest"; candidates: { exercise: ExerciseDef; score: number }[] }
  | { kind: "none" };

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** 0..1 similarity between two normalised names (token overlap blended with edit distance). */
export function nameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jaccard = inter / (ta.size + tb.size - inter);
  const containment = inter / Math.min(ta.size, tb.size);
  const edit = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return Math.max(jaccard * 0.5 + containment * 0.3 + edit * 0.2, edit);
}

function keysOf(ex: ExerciseDef): { key: string; via: "name" | "alias" }[] {
  return [
    { key: normalizeExerciseName(ex.name), via: "name" as const },
    ...(ex.aliases ?? []).map((a) => ({ key: normalizeExerciseName(a), via: "alias" as const })),
  ];
}

/**
 * Match a free-text name against the library. Exact (normalised) hits on name or alias
 * are automatic; anything else returns ranked suggestions for the user to confirm.
 */
export function matchExercise(input: string, library: ExerciseDef[], threshold = 0.55): MatchResult {
  const q = normalizeExerciseName(input);
  if (!q) return { kind: "none" };

  for (const ex of library) {
    for (const { key, via } of keysOf(ex)) {
      if (key === q) return { kind: "exact", exercise: ex, via };
    }
  }

  const candidates = library
    .map((exercise) => ({
      exercise,
      score: Math.max(...keysOf(exercise).map(({ key }) => nameSimilarity(q, key))),
    }))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return candidates.length ? { kind: "suggest", candidates } : { kind: "none" };
}

/**
 * Exercise picker search: recents first, then type-to-filter on name and aliases.
 * Archived exercises stay searchable but sort after active ones.
 */
export function searchExercises(
  query: string,
  library: ExerciseDef[],
  recentIds: string[] = [],
): { results: ExerciseDef[]; canCreate: boolean } {
  const q = normalizeExerciseName(query);
  const lq = looseName(query);
  const recentRank = new Map(recentIds.map((id, i) => [id, i]));

  const scored = library
    .map((ex) => {
      if (!lq) return { ex, score: 1 };
      const loose = [ex.name, ...(ex.aliases ?? [])].map(looseName);
      const keys = keysOf(ex).map((k) => k.key);
      const prefix = loose.some((k) => k.startsWith(lq) || k.split(" ").some((w) => w.startsWith(lq)));
      const contains = loose.some((k) => k.includes(lq)) || keys.some((k) => k.includes(q));
      const fuzzy = Math.max(...keys.map((k) => nameSimilarity(q, k)));
      const score = prefix ? 3 : contains ? 2 : fuzzy >= 0.6 ? fuzzy : 0;
      return { ex, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => {
      if (!!a.ex.archived !== !!b.ex.archived) return a.ex.archived ? 1 : -1;
      if (b.score !== a.score) return b.score - a.score;
      const ra = recentRank.get(a.ex.id) ?? Infinity;
      const rb = recentRank.get(b.ex.id) ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a.ex.name.localeCompare(b.ex.name);
    });

  const exact = library.some((ex) => keysOf(ex).some((k) => k.key === q));
  return { results: scored.map((s) => s.ex), canCreate: !!q && !exact };
}

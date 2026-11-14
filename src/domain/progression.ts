/**
 * Progression suggestions — always suggestions, never forced.
 *
 * Rule (docs/BRIEF.md §7): first more reps, then more sets
 * (6×2 → 5×3 → 6×3 → 5×4, read as reps × sets). Only progress when every set was
 * clean with ~2 reps in reserve. Move to the next skill variation only after hitting
 * the top of the range on every set, clean, with reserve, for 2 sessions in a row.
 */
import { DEFAULT_MAX_SETS, workingTarget } from "./session";
import type { LoggedEntry, LoggedSet, PlannedExercise, ProgressionChainDef, ExerciseDef } from "./types";

export const MIN_RIR = 2;
/** Step size when increasing a per-set target. */
export const STEP = { reps: 1, sec: 2 } as const;

export type SetQuality = "progress" | "hold" | "unknown";

/** Every planned set done, clean, at or above `goal`, with enough reserve. */
export function sessionMetGoal(sets: LoggedSet[], plannedSets: number, goal: number): SetQuality {
  const done = sets.filter((s) => s.done);
  if (done.length === 0) return "unknown";
  // Per-side sets: group by index, the weaker side decides
  const byIndex = new Map<number, LoggedSet[]>();
  for (const s of done) byIndex.set(s.index, [...(byIndex.get(s.index) ?? []), s]);
  if (byIndex.size < plannedSets) return "hold";

  for (const group of byIndex.values()) {
    for (const s of group) {
      if (s.value < goal) return "hold";
      if (s.clean === false) return "hold";
      if (s.rir !== undefined && s.rir < MIN_RIR) return "hold";
    }
  }
  return "progress";
}

export type Suggestion =
  | { kind: "none"; reason: string }
  | { kind: "more_reps"; from: PlannedTargetState; to: PlannedTargetState; message: string }
  | { kind: "more_sets"; from: PlannedTargetState; to: PlannedTargetState; message: string }
  | { kind: "next_variation"; chainId: string; fromStep: string; toStep: string; message: string };

export interface PlannedTargetState {
  sets: number;
  working: number;
}

/**
 * Suggest the next target for one planned exercise from its recent history
 * (most recent first). Deload sessions are ignored.
 */
export function suggestProgression(
  planned: PlannedExercise,
  history: LoggedEntry[],
  opts: { exercise?: ExerciseDef; chains?: ProgressionChainDef[]; isDeloadWeek?: boolean } = {},
): Suggestion {
  if (opts.isDeloadWeek) return { kind: "none", reason: "Deload week: no progression." };
  const recent = history[0];
  if (!recent) return { kind: "none", reason: "No history yet." };

  const working = workingTarget(planned);
  const unit = planned.target.unit;
  const max = planned.target.max ?? planned.target.min;
  const maxSets = planned.maxSets ?? DEFAULT_MAX_SETS;
  const from = { sets: planned.sets, working };

  const q = sessionMetGoal(recent.sets, planned.sets, working);
  if (q !== "progress") {
    return { kind: "none", reason: "Not every set was clean at target with ~2 in reserve. Repeat this target." };
  }

  const u = unit === "sec" ? " s" : "";
  if (working < max) {
    const next = Math.min(max, working + STEP[unit]);
    return {
      kind: "more_reps",
      from,
      to: { sets: planned.sets, working: next },
      message: `All ${planned.sets} sets clean at ${working}${u}. Next: ${planned.sets} × ${next}${u}.`,
    };
  }

  // At the top of the range on every set. Two sessions in a row → next variation, if there is one.
  const chainInfo = opts.exercise?.chain;
  const chain = chainInfo && opts.chains?.find((c) => c.id === chainInfo.chainId);
  if (chain && chainInfo) {
    const prev = history[1];
    const twoInARow = prev && sessionMetGoal(prev.sets, planned.sets, max) === "progress";
    const idx = chain.steps.indexOf(chainInfo.step);
    const nextStep = idx >= 0 ? chain.steps[idx + 1] : undefined;
    if (twoInARow && nextStep) {
      return {
        kind: "next_variation",
        chainId: chain.id,
        fromStep: chainInfo.step,
        toStep: nextStep,
        message: `Top of the range on every set, clean, two sessions in a row. Consider moving to ${chain.name}: ${nextStep}.`,
      };
    }
  }

  if (planned.sets < maxSets) {
    return {
      kind: "more_sets",
      from,
      to: { sets: planned.sets + 1, working: planned.target.min },
      message: `Top of the range (${max}${u}) on every set. Next: ${planned.sets + 1} × ${planned.target.min}${u}.`,
    };
  }

  return { kind: "none", reason: "At the top of the range with maximum sets. Hold here, or progress the variation." };
}

/** The most recent logged entry for each exercise, from sessions sorted newest first. */
export function lastTimeByExercise(sessions: { date: string; entries: LoggedEntry[] }[]): Map<string, { date: string; entry: LoggedEntry }> {
  const out = new Map<string, { date: string; entry: LoggedEntry }>();
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  for (const s of sorted) {
    for (const e of s.entries) {
      if (!out.has(e.exerciseId) && e.sets.some((x) => x.done)) out.set(e.exerciseId, { date: s.date, entry: e });
    }
  }
  return out;
}

/** "5 5 4" or "L 6 6 / R 6 5" — the compact "last time" hint. */
export function formatSetsCompact(sets: LoggedSet[]): string {
  const done = sets.filter((s) => s.done).sort((a, b) => a.index - b.index);
  const sided = done.some((s) => s.side);
  const fmt = (xs: LoggedSet[]) =>
    xs.map((s) => `${s.value}${s.weightKg ? `@${s.weightKg}kg` : ""}`).join(" ");
  if (!sided) return fmt(done);
  return `L ${fmt(done.filter((s) => s.side === "L"))} / R ${fmt(done.filter((s) => s.side === "R"))}`;
}

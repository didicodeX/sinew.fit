/**
 * Zero retyping: the weekly program is defined once, and every session is generated
 * from it (exercises, sets, targets, rest, order, supersets). The generated session
 * copies its planned targets, so later program edits never rewrite history.
 */
import { daysBetween, startOfWeek, weekdayOf } from "./dates";
import type {
  ExerciseDef,
  IsoDate,
  LoggedEntry,
  LoggedSession,
  LoggedSet,
  PlannedExercise,
  ProgramDef,
  SessionTemplate,
  TemplatePart,
} from "./types";

export const DEFAULT_MAX_SETS = 5;

export interface DeloadSettings {
  enabled: boolean;
  /** A deload week every N weeks (the Nth week is the deload). */
  everyWeeks: number;
  /** Monday of week 1 of the current block. */
  anchorWeek: IsoDate;
}

/** True when `date` falls in a deload week under the user's settings. */
export function isDeloadWeek(date: IsoDate, settings: DeloadSettings): boolean {
  if (!settings.enabled || settings.everyWeeks < 2) return false;
  const weeks = Math.floor(daysBetween(startOfWeek(settings.anchorWeek), startOfWeek(date)) / 7);
  if (weeks < 0) return false;
  return (weeks + 1) % settings.everyWeeks === 0;
}

/** Deload rule: −1 set on anything with 3+ sets. */
export function deloadSets(sets: number): number {
  return sets >= 3 ? sets - 1 : sets;
}

export function templateForDate(
  date: IsoDate,
  program: ProgramDef,
  templates: SessionTemplate[],
): SessionTemplate | null {
  const id = program.week[weekdayOf(date)];
  if (!id) return null;
  return templates.find((t) => t.id === id) ?? null;
}

export function workingTarget(p: PlannedExercise): number {
  return p.working ?? p.target.min;
}

export interface GenerateOptions {
  date: IsoDate;
  sessionId: string;
  /** Generates entry ids; injected so the domain stays deterministic in tests. */
  newId: () => string;
  isDeload?: boolean;
  /** Prefill from the last performance of each exercise instead of the target, when available. */
  lastSets?: Map<string, LoggedSet[]>;
}

function prefilledSets(p: PlannedExercise, ex: ExerciseDef | undefined, setCount: number): LoggedSet[] {
  const value = workingTarget(p);
  const sides: (LoggedSet["side"] | undefined)[] = ex?.perSide ? ["L", "R"] : [undefined];
  const sets: LoggedSet[] = [];
  for (let i = 0; i < setCount; i++) {
    for (const side of sides) {
      sets.push({ index: i, value, unit: p.target.unit, ...(side ? { side } : {}), done: false });
    }
  }
  return sets;
}

/** Build a ready-to-log session from a template. Nothing to type: every set is prefilled. */
export function generateSession(
  template: SessionTemplate,
  exercises: ExerciseDef[],
  opts: GenerateOptions,
): LoggedSession {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const entries: LoggedEntry[] = [];
  let order = 0;

  template.parts.forEach((part: TemplatePart, partIndex) => {
    for (const p of part.items) {
      const plannedSets = opts.isDeload ? deloadSets(p.sets) : p.sets;
      entries.push({
        id: opts.newId(),
        exerciseId: p.exerciseId,
        order: order++,
        partName: part.name,
        // Superset groups are scoped per part so "A" in two parts never merges
        ...(p.supersetGroup ? { supersetGroup: `${partIndex}:${p.supersetGroup}` } : {}),
        plannedSets,
        plannedTarget: { ...p.target },
        plannedWorking: workingTarget(p),
        ...(p.restSec !== undefined ? { restSec: p.restSec } : {}),
        sets: prefilledSets(p, byId.get(p.exerciseId), plannedSets),
      });
    }
  });

  return {
    id: opts.sessionId,
    date: opts.date,
    templateId: template.id,
    title: template.name,
    isDeload: !!opts.isDeload,
    source: "app",
    entries,
  };
}

/** Label like "4 × 10–15 s" or "3 × 5–8 /leg". */
export function formatTarget(p: Pick<PlannedExercise, "sets" | "target">, perSide = false): string {
  const { min, max, unit } = p.target;
  const range = max !== undefined && max !== min ? `${min}–${max}` : `${min}`;
  return `${p.sets} × ${range}${unit === "sec" ? " s" : ""}${perSide ? " /side" : ""}`;
}

/** "2–3 min", "90 s", "3 min". */
export function formatRest(restSec?: number, restMaxSec?: number): string {
  if (restSec === undefined) return "";
  const wholeMin = (s: number) => s >= 60 && s % 60 === 0;
  if (restMaxSec !== undefined && restMaxSec !== restSec) {
    return wholeMin(restSec) && wholeMin(restMaxSec)
      ? `${restSec / 60}–${restMaxSec / 60} min`
      : `${restSec}–${restMaxSec} s`;
  }
  return wholeMin(restSec) ? `${restSec / 60} min` : `${restSec} s`;
}

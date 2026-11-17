/**
 * Notebook-style quick entry: turns what was typed on the form ("5 5 5", "1:35", "12:40")
 * into a LoggedSession, with warnings the screen shows before saving. Pure.
 */
import { clockDurationMinutes, extractWeightKg, parseClockTime, parseRest, parseValueList } from "./parse";
import type { ExerciseDef, IsoDate, LoggedEntry, LoggedSession } from "./types";

export interface QuickBlock {
  exerciseId: string;
  /** "5 5 5", "5,5,5", "20 20 18" */
  reps: string;
  rest: string;
  /** Break between this exercise and the next. */
  breakAfter: string;
  notes: string;
  /** Superset letter, "" for none. */
  superset: string;
}

export interface QuickDraft {
  date: IsoDate;
  start: string;
  end: string;
  title: string;
  sessionNotes: string;
  blocks: QuickBlock[];
}

export interface QuickResult {
  session: LoggedSession;
  /** Problems per block index, plus session-level ones under key -1. */
  warnings: Map<number, string[]>;
  /** True when something blocks saving (no sets anywhere, unreadable values). */
  blocking: boolean;
}

export const emptyBlock = (exerciseId = ""): QuickBlock => ({
  exerciseId,
  reps: "",
  rest: "",
  breakAfter: "",
  notes: "",
  superset: "",
});

function clockToIso(date: IsoDate, hhmm: string): string | undefined {
  const mins = parseClockTime(hhmm);
  if (mins === null) return undefined;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60).toISOString();
}

export function buildQuickSession(
  draft: QuickDraft,
  exercises: ExerciseDef[],
  newId: () => string,
  sessionId: string = newId(),
): QuickResult {
  const warnings = new Map<number, string[]>();
  const warn = (i: number, msg: string) => warnings.set(i, [...(warnings.get(i) ?? []), msg]);
  const byId = new Map(exercises.map((e) => [e.id, e]));
  let blocking = false;

  const start = draft.start.trim();
  const end = draft.end.trim();
  if (start && parseClockTime(start) === null) warn(-1, `Start time "${start}" is not a time (use 12:40)`);
  if (end && parseClockTime(end) === null) warn(-1, `End time "${end}" is not a time (use 13:17)`);
  if (start && end && parseClockTime(start) !== null && parseClockTime(end) !== null && clockDurationMinutes(start, end) === null) {
    warn(-1, "End is before start");
  }
  const timesOk = start && end && clockDurationMinutes(start, end) !== null;

  const entries: LoggedEntry[] = [];
  draft.blocks.forEach((b, i) => {
    const ex = byId.get(b.exerciseId);
    if (!ex) {
      if (b.reps.trim()) {
        warn(i, "Pick an exercise");
        blocking = true;
      }
      return;
    }
    const unit = ex.kind === "hold" ? "sec" : "reps";
    const parsed = parseValueList(b.reps, unit);
    for (const w of parsed.warnings) {
      if (w.code === "empty") warn(i, "No sets typed");
      else warn(i, w.message);
      if (w.code === "unparseable" || w.code === "empty") blocking = true;
    }
    if (parsed.values.length === 0) return;

    const rest = b.rest.trim() ? parseRest(b.rest) : null;
    if (b.rest.trim() && !rest) warn(i, `Rest "${b.rest}" not understood`);
    const brk = b.breakAfter.trim() ? parseRest(b.breakAfter) : null;
    if (b.breakAfter.trim() && !brk) warn(i, `Break "${b.breakAfter}" not understood`);

    // A load written in the notes ("+10 kg") goes on the sets; the text stays in the note
    const weight = ex.allowsWeight ? extractWeightKg(b.notes) : null;
    entries.push({
      id: newId(),
      exerciseId: ex.id,
      order: entries.length,
      supersetGroup: b.superset.trim() ? b.superset.trim().slice(0, 4).toUpperCase() : undefined,
      restSec: rest?.sec,
      breakAfterSec: brk?.sec,
      notes: b.notes.trim() || undefined,
      sets: parsed.values.map((value, index) => ({
        index,
        value,
        unit,
        ...(weight ? { weightKg: weight } : {}),
        done: true,
      })),
    });
  });

  if (entries.length === 0) {
    warn(-1, "Add at least one exercise with sets");
    blocking = true;
  }

  const session: LoggedSession = {
    id: sessionId,
    date: draft.date,
    startedAt: timesOk ? clockToIso(draft.date, start) : undefined,
    endedAt: timesOk ? clockToIso(draft.date, end) : undefined,
    title: draft.title.trim() || undefined,
    sessionNotes: draft.sessionNotes.trim() || undefined,
    isDeload: false,
    source: "import",
    entries,
  };
  return { session, warnings, blocking };
}

/** Turn a logged session back into form fields (for "duplicate previous session"). */
export function draftFromSession(s: LoggedSession, date: IsoDate): QuickDraft {
  return {
    date,
    start: "",
    end: "",
    title: s.title ?? "",
    sessionNotes: "",
    blocks: s.entries.map((e) => ({
      exerciseId: e.exerciseId,
      reps: e.sets.filter((x) => x.done).map((x) => x.value).join(" "),
      rest: e.restSec !== undefined ? String(e.restSec) : "",
      breakAfter: e.breakAfterSec !== undefined ? String(e.breakAfterSec) : "",
      notes: e.notes ?? "",
      superset: e.supersetGroup ?? "",
    })),
  };
}

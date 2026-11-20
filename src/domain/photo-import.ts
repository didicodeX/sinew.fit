/**
 * Photo import (brief §6.5): what the vision model reads off a notebook page, cleaned up,
 * and turned into quick-entry drafts so the same parser, warnings and weight extraction apply.
 * Pure: the model call lives on the server, the review screen in features/import.
 */
import { isValidIsoDate } from "./dates";
import { normalizeExerciseName } from "./exercise-matching";
import type { QuickBlock, QuickDraft } from "./quick-entry";

/** Fields the model may flag as hard to read. */
export type PhotoSessionField = "date" | "start" | "end" | "sessionNotes";
export type PhotoBlockField = "name" | "reps" | "rest" | "breakAfter" | "notes" | "superset";

export interface PhotoBlock {
  name: string;
  /** Values per set, space separated ("5 5 5"; seconds for holds). */
  reps: string;
  /** True when the values are seconds (a hold). */
  hold: boolean;
  rest: string;
  breakAfter: string;
  notes: string;
  superset: string;
  uncertain: PhotoBlockField[];
}

export interface PhotoSession {
  /** ISO date, "" when it could not be read. */
  date: string;
  /** The date as written, to help the person fix it. */
  dateText: string;
  start: string;
  end: string;
  sessionNotes: string;
  /** True when the page has no header and continues the previous one (page 2 of a session). */
  continuesPrevious: boolean;
  uncertain: PhotoSessionField[];
  blocks: PhotoBlock[];
  /** Photos this session was read from (indexes in the upload). */
  photos: number[];
}

const SESSION_FIELDS: PhotoSessionField[] = ["date", "start", "end", "sessionNotes"];
const BLOCK_FIELDS: PhotoBlockField[] = ["name", "reps", "rest", "breakAfter", "notes", "superset"];

const str = (v: unknown, max = 500): string => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const flags = <T extends string>(v: unknown, allowed: T[]): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x as T)))] : [];

/** "5, 5,5" / "5-5-5" / "5|5|5" → "5 5 5". Keeps "1:20" holds and "x" as written for the parser. */
export function tidyValues(raw: string): string {
  return raw
    .replace(/[,;/|]+/g, " ")
    .replace(/(\d)\s*[-–]\s*(?=\d)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validate and clean the model's JSON (never trusted as-is). Unknown shapes give an empty list.
 * `photo` is the index of the photo the output came from.
 */
export function cleanPhotoRead(raw: unknown, photo: number): PhotoSession[] {
  const sessions = raw && typeof raw === "object" && Array.isArray((raw as { sessions?: unknown }).sessions)
    ? ((raw as { sessions: unknown[] }).sessions)
    : [];
  return sessions.slice(0, 4).flatMap((s): PhotoSession[] => {
    if (!s || typeof s !== "object") return [];
    const o = s as Record<string, unknown>;
    const exercises = Array.isArray(o.exercises) ? o.exercises : [];
    const blocks = exercises.slice(0, 40).flatMap((e): PhotoBlock[] => {
      if (!e || typeof e !== "object") return [];
      const b = e as Record<string, unknown>;
      const name = str(b.name, 80);
      const reps = tidyValues(str(b.reps, 120));
      if (!name && !reps) return [];
      return [
        {
          name,
          reps,
          hold: b.unit === "sec",
          rest: str(b.rest, 20),
          breakAfter: str(b.breakAfter, 20),
          notes: str(b.notes, 500),
          superset: str(b.superset, 4).toUpperCase(),
          uncertain: flags(b.uncertainFields, BLOCK_FIELDS),
        },
      ];
    });
    const date = str(o.date, 10);
    const session: PhotoSession = {
      date: isValidIsoDate(date) ? date : "",
      dateText: str(o.dateText, 40),
      start: str(o.start, 8),
      end: str(o.end, 8),
      sessionNotes: str(o.sessionNotes, 2000),
      continuesPrevious: o.continuesPrevious === true,
      uncertain: flags(o.uncertainFields, SESSION_FIELDS),
      blocks,
      photos: [photo],
    };
    if (!session.date && !session.uncertain.includes("date")) session.uncertain.push("date");
    return blocks.length || session.date ? [session] : [];
  });
}

/** Append a continuation page to the session before it (exercises, notes, photos). */
export function mergeInto(prev: PhotoSession, next: PhotoSession): PhotoSession {
  return {
    ...prev,
    date: prev.date || next.date,
    dateText: prev.dateText || next.dateText,
    start: prev.start || next.start,
    end: prev.end || next.end,
    sessionNotes: [prev.sessionNotes, next.sessionNotes].filter(Boolean).join("\n"),
    uncertain: [...new Set([...prev.uncertain, ...next.uncertain.filter((f) => f !== "date" || !prev.date)])],
    blocks: [...prev.blocks, ...next.blocks],
    photos: [...prev.photos, ...next.photos],
  };
}

/** Merge pages flagged as continuations into the session before them. */
export function groupPages(read: PhotoSession[]): PhotoSession[] {
  const out: PhotoSession[] = [];
  for (const s of read) {
    const prev = out[out.length - 1];
    if (prev && s.continuesPrevious) out[out.length - 1] = mergeInto(prev, s);
    else out.push(s);
  }
  return out;
}

/**
 * Turn a reviewed session into a quick-entry draft. `idOf` gives the exercise id for a read
 * name, or null to leave the block out (skipped). Skipped blocks keep their slot with no
 * values, so warning indexes still line up with the review screen.
 */
export function photoToDraft(s: PhotoSession, idOf: (name: string) => string | null): QuickDraft {
  return {
    date: s.date,
    start: s.start,
    end: s.end,
    title: "",
    sessionNotes: s.sessionNotes,
    blocks: s.blocks.map((b): QuickBlock => {
      const id = idOf(b.name);
      return {
        exerciseId: id ?? "",
        reps: id ? b.reps : "",
        rest: b.rest,
        breakAfter: b.breakAfter,
        notes: b.notes,
        superset: b.superset,
      };
    }),
  };
}

/** Distinct exercise names across sessions, merged by normalised form. */
export function photoExerciseNames(sessions: PhotoSession[]): { key: string; name: string; count: number; hold: boolean }[] {
  const m = new Map<string, { name: string; count: number; hold: boolean }>();
  for (const s of sessions)
    for (const b of s.blocks) {
      const key = normalizeExerciseName(b.name);
      if (!key) continue;
      const cur = m.get(key) ?? { name: b.name, count: 0, hold: false };
      cur.count++;
      if (b.hold) cur.hold = true;
      m.set(key, cur);
    }
  return [...m.entries()].map(([key, v]) => ({ key, ...v }));
}

/** Dates used by more than one session of the same import. */
export function duplicateDates(sessions: PhotoSession[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const s of sessions) {
    if (!s.date) continue;
    if (seen.has(s.date)) dup.add(s.date);
    seen.add(s.date);
  }
  return [...dup].sort();
}

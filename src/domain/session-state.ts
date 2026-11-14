/**
 * Live-session state transitions. Pure: every action returns a new session, and time is
 * passed in (`now`, epoch ms), so the same logic can drive the web app and a watch app.
 */
import type { LoggedEntry, LoggedSession, LoggedSet, RestTimer, Side } from "./types";

export const DEFAULT_REST_SEC = 90;
/** Gaps longer than this between two sets are not counted as rest (phone left aside, etc.). */
export const MAX_MEASURED_REST_SEC = 15 * 60;
const MAX_VALUE = 999;

export interface SetRef {
  entryId: string;
  index: number;
  side?: Side;
}

export type SetPatch = Partial<Pick<LoggedSet, "weightKg" | "rir" | "clean" | "assistance" | "note">>;

export type SessionAction =
  | { type: "start"; now: number }
  | { type: "finish"; now: number }
  | { type: "confirmSet"; ref: SetRef; now: number; value?: number }
  | { type: "undoSet"; ref: SetRef }
  | { type: "setValue"; ref: SetRef; value: number }
  | { type: "adjustValue"; ref: SetRef; delta: number }
  | { type: "patchSet"; ref: SetRef; patch: SetPatch }
  | { type: "addSet"; entryId: string }
  | { type: "removeLastSet"; entryId: string }
  | { type: "entryNotes"; entryId: string; notes: string }
  | { type: "sessionNotes"; notes: string }
  | { type: "skipRest" }
  | { type: "adjustRest"; deltaSec: number };

const sameRef = (s: LoggedSet, ref: SetRef) => s.index === ref.index && (s.side ?? null) === (ref.side ?? null);

function mapEntry(session: LoggedSession, entryId: string, fn: (e: LoggedEntry) => LoggedEntry): LoggedSession {
  return { ...session, entries: session.entries.map((e) => (e.id === entryId ? fn(e) : e)) };
}

function mapSet(session: LoggedSession, ref: SetRef, fn: (s: LoggedSet) => LoggedSet): LoggedSession {
  return mapEntry(session, ref.entryId, (e) => ({ ...e, sets: e.sets.map((s) => (sameRef(s, ref) ? fn(s) : s)) }));
}

const clampValue = (v: number) => Math.max(0, Math.min(MAX_VALUE, Math.round(v)));

/** All sides of a set index are done (per-side exercises rest after L and R). */
function indexComplete(entry: LoggedEntry, index: number): boolean {
  return entry.sets.filter((s) => s.index === index).every((s) => s.done);
}

/**
 * Should confirming this set start a rest timer?
 * - not until every side of the set index is done
 * - inside a superset, only after the last exercise of the group for this round
 * - never after the very last set of the session
 */
export function restAfter(session: LoggedSession, entryId: string, index: number): number | null {
  const pos = session.entries.findIndex((e) => e.id === entryId);
  const entry = session.entries[pos];
  if (!entry || !indexComplete(entry, index)) return null;

  if (entry.supersetGroup) {
    const next = session.entries[pos + 1];
    if (next?.supersetGroup === entry.supersetGroup && next.sets.some((s) => s.index === index && !s.done)) return null;
  }

  const remaining = session.entries.some((e) => e.sets.some((s) => !s.done));
  if (!remaining) return null;
  return entry.restSec ?? DEFAULT_REST_SEC;
}

export function reduceSession(session: LoggedSession, action: SessionAction): LoggedSession {
  switch (action.type) {
    case "start":
      return session.startedAt ? session : { ...session, startedAt: new Date(action.now).toISOString() };

    case "finish": {
      const { rest: _rest, ...rest } = session;
      return { ...rest, endedAt: new Date(action.now).toISOString(), startedAt: session.startedAt ?? new Date(action.now).toISOString() };
    }

    case "confirmSet": {
      const { ref, now } = action;
      const entry = session.entries.find((e) => e.id === ref.entryId);
      const target = entry?.sets.find((s) => sameRef(s, ref));
      if (!entry || !target || target.done) return session;

      let next = session.startedAt ? session : reduceSession(session, { type: "start", now });

      // Measure real rest (same exercise) or the break after the previous exercise
      const gapSec = next.lastSet ? Math.round((now - next.lastSet.at) / 1000) : undefined;
      const measured = gapSec !== undefined && gapSec >= 0 && gapSec <= MAX_MEASURED_REST_SEC ? gapSec : undefined;
      const prevEntryId = next.lastSet?.entryId;
      if (measured !== undefined && prevEntryId && prevEntryId !== ref.entryId) {
        next = mapEntry(next, prevEntryId, (e) => ({ ...e, breakAfterSec: measured }));
      }

      next = mapSet(next, ref, (s) => ({
        ...s,
        ...(action.value !== undefined ? { value: clampValue(action.value) } : {}),
        done: true,
        ...(measured !== undefined && prevEntryId === ref.entryId && !ref.side ? { restActualSec: measured } : {}),
      }));
      next = { ...next, lastSet: { at: now, entryId: ref.entryId } };

      const restSec = restAfter(next, ref.entryId, ref.index);
      const rest: RestTimer | undefined = restSec ? { startedAt: now, durationSec: restSec, entryId: ref.entryId } : undefined;
      const { rest: _old, ...withoutRest } = next;
      return rest ? { ...withoutRest, rest } : withoutRest;
    }

    case "undoSet":
      return mapSet(session, action.ref, (s) => {
        const { restActualSec: _r, ...rest } = s;
        return { ...rest, done: false };
      });

    case "setValue":
      return mapSet(session, action.ref, (s) => ({ ...s, value: clampValue(action.value) }));

    case "adjustValue":
      return mapSet(session, action.ref, (s) => ({ ...s, value: clampValue(s.value + action.delta) }));

    case "patchSet":
      return mapSet(session, action.ref, (s) => ({ ...s, ...action.patch }));

    case "addSet":
      return mapEntry(session, action.entryId, (e) => {
        const lastIndex = Math.max(-1, ...e.sets.map((s) => s.index));
        const template = e.sets.filter((s) => s.index === lastIndex);
        const unit = template[0]?.unit ?? e.plannedTarget?.unit ?? "reps";
        const value = template[0]?.value ?? e.plannedWorking ?? e.plannedTarget?.min ?? 0;
        const sides = template.length > 1 ? template.map((s) => s.side) : [template[0]?.side];
        const added: LoggedSet[] = sides.map((side) => ({
          index: lastIndex + 1,
          value,
          unit,
          ...(side ? { side } : {}),
          ...(template[0]?.weightKg !== undefined ? { weightKg: template[0].weightKg } : {}),
          ...(template[0]?.assistance ? { assistance: template[0].assistance } : {}),
          done: false,
        }));
        return { ...e, sets: [...e.sets, ...added] };
      });

    case "removeLastSet":
      return mapEntry(session, action.entryId, (e) => {
        const lastIndex = Math.max(-1, ...e.sets.map((s) => s.index));
        if (lastIndex <= 0) return e;
        return { ...e, sets: e.sets.filter((s) => s.index !== lastIndex) };
      });

    case "entryNotes":
      return mapEntry(session, action.entryId, (e) => ({ ...e, notes: action.notes || undefined }));

    case "sessionNotes":
      return { ...session, sessionNotes: action.notes || undefined };

    case "skipRest": {
      const { rest: _rest, ...rest } = session;
      return rest;
    }

    case "adjustRest":
      if (!session.rest) return session;
      return { ...session, rest: { ...session.rest, durationSec: Math.max(0, session.rest.durationSec + action.deltaSec) } };
  }
}

/** Seconds left on the rest timer (negative once overdue). */
export function restRemaining(rest: RestTimer, now: number): number {
  return Math.ceil(rest.durationSec - (now - rest.startedAt) / 1000);
}

/** The next set to do: first not-done set in session order. */
export function nextSet(session: LoggedSession): SetRef | null {
  for (const e of session.entries) {
    const s = [...e.sets].sort((a, b) => a.index - b.index || (a.side ?? "").localeCompare(b.side ?? "")).find((x) => !x.done);
    if (s) return { entryId: e.id, index: s.index, ...(s.side ? { side: s.side } : {}) };
  }
  return null;
}

export function sessionProgress(session: LoggedSession): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const e of session.entries)
    for (const s of e.sets) {
      total++;
      if (s.done) done++;
    }
  return { done, total };
}

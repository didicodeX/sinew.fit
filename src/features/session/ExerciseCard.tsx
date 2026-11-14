"use client";

import { useState } from "react";
import {
  formatRest,
  formatSetsCompact,
  formatTarget,
  type ExerciseDef,
  type LoggedEntry,
  type LoggedSet,
  type SessionAction,
  type SetPatch,
  type SetRef,
} from "@domain/index";
import { cn } from "@shared/utils";

export interface LastTime {
  date: string;
  entry: LoggedEntry;
}

const refOf = (entryId: string, s: LoggedSet): SetRef => ({ entryId, index: s.index, ...(s.side ? { side: s.side } : {}) });
const keyOf = (s: LoggedSet) => `${s.index}${s.side ?? ""}`;

export function ExerciseCard({
  entry,
  exercise,
  lastTime,
  nextKey,
  dispatch,
  onHold,
}: {
  entry: LoggedEntry;
  exercise?: ExerciseDef;
  lastTime?: LastTime;
  /** Key of the session's next set, if it belongs to this entry. */
  nextKey?: string;
  dispatch: (a: SessionAction) => void;
  onHold: (ref: SetRef) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(Boolean(entry.notes));
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const isHold = exercise?.kind === "hold";
  const unit = isHold ? "s" : "";
  const sets = [...entry.sets].sort((a, b) => a.index - b.index || (a.side ?? "").localeCompare(b.side ?? ""));
  const allDone = sets.every((s) => s.done);

  return (
    <article
      className={cn(
        "rounded-2xl border bg-surface",
        allDone ? "border-line opacity-70" : "border-line",
        entry.supersetGroup && "border-l-4 border-l-accent",
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">{exercise?.name ?? "Exercise"}</h3>
          <p className="tabular text-sm text-muted">
            {entry.plannedTarget
              ? formatTarget({ sets: entry.plannedSets ?? 0, target: entry.plannedTarget }, exercise?.perSide)
              : null}
            {entry.restSec ? ` · rest ${formatRest(entry.restSec)}` : ""}
          </p>
          {lastTime ? (
            <p className="tabular text-sm">
              <span className="text-muted">Last ({lastTime.date.slice(5)}): </span>
              {formatSetsCompact(lastTime.entry.sets)}
              {isHold ? " s" : ""}
            </p>
          ) : null}
        </div>
      </header>

      <ol className="mt-2 divide-y divide-line">
        {sets.map((s) => {
          const ref = refOf(entry.id, s);
          const key = keyOf(s);
          const isNext = key === nextKey;
          return (
            <li key={key} className={cn("px-2", isNext && "bg-surface-2")}>
              <div className="flex items-center gap-1 py-1.5">
                <button
                  type="button"
                  onClick={() => setDetailsFor(detailsFor === key ? null : key)}
                  className="tabular h-12 w-12 shrink-0 rounded-lg text-sm text-muted"
                  aria-label={`Set ${s.index + 1}${s.side ? ` ${s.side}` : ""} details`}
                >
                  {s.index + 1}
                  {s.side ? <span className="ml-0.5 text-xs">{s.side}</span> : null}
                </button>

                {s.done ? (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "undoSet", ref })}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-xl"
                    aria-label="Undo set"
                  >
                    <span className="tabular font-semibold">
                      {s.value}
                      {unit}
                    </span>
                    {s.weightKg ? <span className="text-sm text-muted">+{s.weightKg} kg</span> : null}
                    {s.clean === false ? <span className="text-sm text-warn">not clean</span> : null}
                    <span className="text-accent">✓</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "adjustValue", ref, delta: -1 })}
                      className="h-12 w-12 rounded-xl border border-line text-2xl"
                      aria-label="Minus one"
                    >
                      −
                    </button>
                    <div className="tabular flex-1 text-center text-2xl font-bold">
                      {s.value}
                      <span className="text-base font-normal text-muted">{unit}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "adjustValue", ref, delta: 1 })}
                      className="h-12 w-12 rounded-xl border border-line text-2xl"
                      aria-label="Plus one"
                    >
                      +
                    </button>
                    {isHold ? (
                      <button
                        type="button"
                        onClick={() => onHold(ref)}
                        className="h-12 w-14 rounded-xl border border-line text-sm"
                        aria-label="Start hold timer"
                      >
                        ▶ s
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "confirmSet", ref, now: Date.now() })}
                      className={cn(
                        "h-12 w-16 rounded-xl text-xl font-bold",
                        isNext ? "bg-accent text-accent-fg" : "border border-accent/60 text-accent",
                      )}
                      aria-label="Confirm set"
                    >
                      ✓
                    </button>
                  </>
                )}
              </div>

              {detailsFor === key ? (
                <SetDetails
                  set={s}
                  exercise={exercise}
                  onPatch={(patch) => dispatch({ type: "patchSet", ref, patch })}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      <footer className="flex flex-wrap gap-2 px-4 py-3 text-sm">
        <button type="button" onClick={() => dispatch({ type: "addSet", entryId: entry.id })} className="h-10 rounded-lg border border-line px-3">
          + Set
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "removeLastSet", entryId: entry.id })}
          disabled={sets.length <= (exercise?.perSide ? 2 : 1)}
          className="h-10 rounded-lg border border-line px-3 disabled:opacity-40"
        >
          − Set
        </button>
        <button type="button" onClick={() => setNotesOpen((o) => !o)} className="h-10 rounded-lg border border-line px-3">
          {entry.notes ? "Notes •" : "Notes"}
        </button>
      </footer>

      {notesOpen ? (
        <div className="px-4 pb-4">
          <textarea
            defaultValue={entry.notes ?? ""}
            onBlur={(e) => dispatch({ type: "entryNotes", entryId: entry.id, notes: e.target.value.trim() })}
            rows={2}
            placeholder="e.g. Getting stronger, try 5 5 6"
            className="w-full rounded-xl border border-line bg-surface-2 p-3 text-base"
          />
        </div>
      ) : null}
    </article>
  );
}

/** Optional per-set fields, tucked behind the set number (brief §4b). */
function SetDetails({
  set,
  exercise,
  onPatch,
}: {
  set: LoggedSet;
  exercise?: ExerciseDef;
  onPatch: (patch: SetPatch) => void;
}) {
  return (
    <div className="space-y-3 px-2 pb-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-16 text-muted">RIR</span>
        {[0, 1, 2, 3, 4].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onPatch({ rir: set.rir === r ? undefined : r })}
            className={cn("tabular h-10 w-10 rounded-lg border", set.rir === r ? "border-accent text-accent" : "border-line")}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 text-muted">Clean</span>
        {(
          [
            ["Yes", true],
            ["No", false],
          ] as const
        ).map(([label, v]) => (
          <button
            key={label}
            type="button"
            onClick={() => onPatch({ clean: set.clean === v ? undefined : v })}
            className={cn("h-10 rounded-lg border px-4", set.clean === v ? "border-accent text-accent" : "border-line")}
          >
            {label}
          </button>
        ))}
      </div>
      {exercise?.allowsWeight ? (
        <label className="flex items-center gap-2">
          <span className="w-16 text-muted">Load</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            defaultValue={set.weightKg ?? ""}
            onBlur={(e) => onPatch({ weightKg: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="h-10 w-24 rounded-lg border border-line bg-surface-2 px-3"
          />
          <span className="text-muted">kg</span>
        </label>
      ) : null}
      {exercise?.allowsAssistance ? (
        <label className="flex items-center gap-2">
          <span className="w-16 text-muted">Band</span>
          <input
            type="text"
            defaultValue={set.assistance?.label ?? ""}
            placeholder="e.g. red"
            onBlur={(e) =>
              onPatch({ assistance: e.target.value.trim() ? { type: "band", label: e.target.value.trim() } : undefined })
            }
            className="h-10 flex-1 rounded-lg border border-line bg-surface-2 px-3"
          />
        </label>
      ) : null}
    </div>
  );
}

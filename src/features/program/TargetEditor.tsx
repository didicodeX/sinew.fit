"use client";

import { useState, useTransition } from "react";
import { todayIn, type ExerciseDef, type PlannedExercise } from "@domain/index";
import { editPlannedTarget, getTargetHistory, type TargetHistoryEntry } from "@/server/program/edit-target";
import { removePlannedExercise, swapPlannedExercise } from "@/server/program/edit-structure";
import { ExercisePicker } from "./ExercisePicker";

function Stepper({ label, value, onChange, min = 0, step = 1 }: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${label} minus`} className="size-11 rounded-xl border border-line text-xl"
          onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <span className="tabular w-12 text-center text-lg font-semibold">{value || "–"}</span>
        <button type="button" aria-label={`${label} plus`} className="size-11 rounded-xl border border-line text-xl"
          onClick={() => onChange(value + step)}>+</button>
      </div>
    </div>
  );
}

function History({ plannedId, unit }: { plannedId: string; unit: string }) {
  const [rows, setRows] = useState<TargetHistoryEntry[] | null>(null);
  const [opened, setOpened] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="text-sm text-accent"
        onClick={() => {
          setOpened(!opened);
          if (!rows) void getTargetHistory(plannedId).then(setRows);
        }}
      >
        {opened ? "Hide history" : "Target history"}
      </button>
      {opened ? (
        rows === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No changes yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {rows.map((r) => (
              <li key={r.id} className="tabular">
                <span className="text-muted">{r.effectiveFrom}</span> {r.sets}×{r.targetMin}
                {r.targetMax ? `–${r.targetMax}` : ""} {unit}
                {r.reason ? <span className="text-muted"> · {r.reason}</span> : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/** Inline editor for one planned exercise: sets, range, rest, swap, remove. Saves with a history entry. */
export function TargetEditor({ item, library, onDone }: { item: PlannedExercise; library: ExerciseDef[]; onDone: () => void }) {
  const [sets, setSets] = useState(item.sets);
  const [min, setMin] = useState(item.target.min);
  const [max, setMax] = useState(item.target.max ?? item.target.min);
  const [rest, setRest] = useState(item.restSec ?? 0);
  const [restMax, setRestMax] = useState(item.restMaxSec ?? 0);
  const [reason, setReason] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unit = item.target.unit === "sec" ? "s" : "reps";

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) onDone();
      else setError(r.error);
    });

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-surface-2 p-3">
      <Stepper label="Sets" value={sets} min={1} onChange={setSets} />
      <Stepper label={`Min ${unit}`} value={min} min={1} onChange={(n) => { setMin(n); if (max < n) setMax(n); }} />
      <Stepper label={`Max ${unit}`} value={max} min={min} onChange={setMax} />
      <Stepper label="Rest (s)" value={rest} step={15} onChange={(n) => { setRest(n); if (restMax && restMax < n) setRestMax(n); }} />
      <Stepper label="Rest max (s)" value={restMax} min={rest} step={15} onChange={setRestMax} />
      <input
        className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || !item.id}
          className="h-11 flex-1 rounded-xl bg-accent font-semibold text-bg"
          onClick={() =>
            run(() =>
              editPlannedTarget(item.id!, {
                sets,
                targetMin: min,
                targetMax: max > min ? max : null,
                restSec: rest > 0 ? rest : null,
                restMaxSec: rest > 0 && restMax > rest ? restMax : null,
                reason,
                effectiveFrom: todayIn(),
              }),
            )
          }
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-xl border border-line px-4">
          Cancel
        </button>
      </div>

      <div className="flex items-center gap-4 border-t border-line pt-2 text-sm">
        <button type="button" className="text-accent" onClick={() => setSwapping(!swapping)}>
          Swap exercise
        </button>
        {confirmRemove ? (
          <button type="button" disabled={pending} className="text-red-500" onClick={() => run(() => removePlannedExercise(item.id!))}>
            Confirm remove
          </button>
        ) : (
          <button type="button" className="text-red-500" onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        )}
      </div>
      {swapping ? (
        <ExercisePicker exercises={library} disabled={pending} onPick={(id) => run(() => swapPlannedExercise(item.id!, id))} />
      ) : null}
      {item.id ? <History plannedId={item.id} unit={unit} /> : null}
    </div>
  );
}

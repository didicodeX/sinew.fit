"use client";

import { useState, useTransition } from "react";
import { todayIn, type PlannedExercise } from "@domain/index";
import { editPlannedTarget } from "@/server/program/edit-target";

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
        <span className="tabular w-12 text-center text-lg font-semibold">{value}</span>
        <button type="button" aria-label={`${label} plus`} className="size-11 rounded-xl border border-line text-xl"
          onClick={() => onChange(value + step)}>+</button>
      </div>
    </div>
  );
}

/** Inline editor for one planned exercise: sets, rep/second range, rest. Saves with a history entry. */
export function TargetEditor({ item, onDone }: { item: PlannedExercise; onDone: () => void }) {
  const [sets, setSets] = useState(item.sets);
  const [min, setMin] = useState(item.target.min);
  const [max, setMax] = useState(item.target.max ?? item.target.min);
  const [rest, setRest] = useState(item.restSec ?? 0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unit = item.target.unit === "sec" ? "s" : "reps";

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-surface-2 p-3">
      <Stepper label="Sets" value={sets} min={1} onChange={setSets} />
      <Stepper label={`Min ${unit}`} value={min} min={1} onChange={(n) => { setMin(n); if (max < n) setMax(n); }} />
      <Stepper label={`Max ${unit}`} value={max} min={min} onChange={setMax} />
      <Stepper label="Rest (s)" value={rest} step={15} onChange={setRest} />
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
            start(async () => {
              const r = await editPlannedTarget(item.id!, {
                sets,
                targetMin: min,
                targetMax: max > min ? max : null,
                restSec: rest > 0 ? rest : null,
                restMaxSec: rest > 0 && item.restMaxSec && item.restMaxSec >= rest ? item.restMaxSec : null,
                reason,
                effectiveFrom: todayIn(),
              });
              if (r.ok) onDone();
              else setError(r.error);
            })
          }
        >
          Save
        </button>
        <button type="button" onClick={onDone} className="h-11 rounded-xl border border-line px-4">
          Cancel
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import type { ExerciseDef } from "@domain/index";
import { addPlannedExercise } from "@/server/program/edit-structure";
import { ExercisePicker } from "./ExercisePicker";

export function AddExercise({ partId, exercises }: { partId: string; exercises: ExerciseDef[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="mt-2 text-sm text-accent" onClick={() => setOpen(true)}>
        + Add exercise
      </button>
    );
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-surface-2 p-3">
      <ExercisePicker
        exercises={exercises}
        disabled={pending}
        onPick={(id) =>
          start(async () => {
            const r = await addPlannedExercise(partId, id);
            if (r.ok) setOpen(false);
            else setError(r.error);
          })
        }
      />
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <button type="button" className="text-sm text-muted" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { formatRest, formatTarget, type ExerciseDef, type PlannedExercise } from "@domain/index";
import { TargetEditor } from "./TargetEditor";

export function ExerciseRow({
  item,
  exercise,
  index,
  library,
}: {
  item: PlannedExercise;
  exercise?: ExerciseDef;
  index: number;
  /** When given, the row can be edited, swapped and removed. */
  library?: ExerciseDef[];
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="py-2">
      <div className="flex items-baseline gap-3">
        <span className="tabular w-5 shrink-0 text-sm text-muted">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{exercise?.name ?? item.exerciseId}</div>
          {item.notes ? <div className="text-sm text-muted">{item.notes}</div> : null}
        </div>
        <div className="tabular shrink-0 text-right">
          <div className="font-semibold">{formatTarget(item, exercise?.perSide)}</div>
          <div className="text-sm text-muted">{formatRest(item.restSec, item.restMaxSec)}</div>
        </div>
        {library && item.id && !editing ? (
          <button type="button" className="shrink-0 text-sm text-accent" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : null}
      </div>
      {editing ? <TargetEditor item={item} library={library ?? []} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}

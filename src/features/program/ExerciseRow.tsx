"use client";

import { useState, useTransition } from "react";
import { formatRest, formatTarget, type ExerciseDef, type PlannedExercise } from "@domain/index";
import { moveExercise } from "@/server/program/edit-program";
import { TargetEditor } from "./TargetEditor";

export function ExerciseRow({
  item,
  exercise,
  index,
  isLast = false,
  library,
}: {
  item: PlannedExercise;
  exercise?: ExerciseDef;
  index: number;
  isLast?: boolean;
  /** When given, the row can be edited, swapped and removed. */
  library?: ExerciseDef[];
}) {
  const [editing, setEditing] = useState(false);
  const [moving, startMove] = useTransition();
  const move = (dir: "up" | "down") => startMove(async () => void (await moveExercise(item.id!, dir)));
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
        {library && item.id ? (
          <div className="flex shrink-0 flex-col">
            <button type="button" aria-label="Move up" disabled={moving || index === 0}
              className="h-7 w-9 text-lg leading-none text-accent disabled:opacity-25" onClick={() => move("up")}>↑</button>
            <button type="button" aria-label="Move down" disabled={moving || isLast}
              className="h-7 w-9 text-lg leading-none text-accent disabled:opacity-25" onClick={() => move("down")}>↓</button>
          </div>
        ) : null}
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

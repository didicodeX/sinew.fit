"use client";

import { useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { formatRest, formatTarget, type ExerciseDef, type PlannedExercise } from "@domain/index";
import { PencilIcon } from "@shared/components/icons";
import { TargetEditor } from "./TargetEditor";

export function ExerciseRow({
  item,
  exercise,
  index,
  library,
  handle,
  rowRef,
  rowStyle,
  dragging = false,
}: {
  item: PlannedExercise;
  exercise?: ExerciseDef;
  index: number;
  /** When given, the row can be edited, swapped and removed. */
  library?: ExerciseDef[];
  /** Drag handle (editable lists only). */
  handle?: ReactNode;
  rowRef?: Ref<HTMLLIElement>;
  rowStyle?: CSSProperties;
  dragging?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li ref={rowRef} style={rowStyle} className={dragging ? "relative z-10 bg-surface py-2 shadow-lg" : "py-2"}>
      <div className="flex items-center gap-2">
        {handle}
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
          <button
            type="button"
            aria-label={`Edit ${exercise?.name ?? "exercise"}`}
            aria-expanded={editing}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-accent"
            onClick={() => setEditing(!editing)}
          >
            <PencilIcon />
          </button>
        ) : null}
      </div>
      {editing ? <TargetEditor item={item} library={library ?? []} onDone={() => setEditing(false)} /> : null}
    </li>
  );
}

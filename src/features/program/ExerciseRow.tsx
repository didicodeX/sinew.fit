import { formatRest, formatTarget, type ExerciseDef, type PlannedExercise } from "@domain/index";

export function ExerciseRow({
  item,
  exercise,
  index,
}: {
  item: PlannedExercise;
  exercise?: ExerciseDef;
  index: number;
}) {
  return (
    <li className="flex items-baseline gap-3 py-2">
      <span className="tabular w-5 shrink-0 text-sm text-muted">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{exercise?.name ?? item.exerciseId}</div>
        {item.notes ? <div className="text-sm text-muted">{item.notes}</div> : null}
      </div>
      <div className="tabular shrink-0 text-right">
        <div className="font-semibold">{formatTarget(item, exercise?.perSide)}</div>
        <div className="text-sm text-muted">{formatRest(item.restSec, item.restMaxSec)}</div>
      </div>
    </li>
  );
}

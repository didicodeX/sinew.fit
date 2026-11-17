import { WARMUPS, type ExerciseDef, type SessionTemplate } from "@domain/index";
import { AddExercise } from "./AddExercise";
import { ExerciseRow } from "./ExerciseRow";
import { AddPart, PartControls } from "./PartControls";

export function TemplateParts({
  template,
  exercises,
  editable = false,
}: {
  template: SessionTemplate;
  exercises: ExerciseDef[];
  editable?: boolean;
}) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return (
    <div className="space-y-3">
      {template.parts.map((part) => {
        const warmup = WARMUPS.find((w) => w.key === part.warmupKey);
        return (
          <details key={part.id ?? part.name} open className="rounded-2xl border border-line bg-surface">
            <summary className="flex items-center gap-2 px-4 py-3">
              <span className="chevron text-muted transition-transform">›</span>
              <span className="flex-1 font-semibold">{part.name}</span>
            </summary>
            <div className="border-t border-line px-4 pb-3">
              {part.goal ? <p className="pt-3 text-sm text-muted">{part.goal}</p> : null}
              {warmup ? (
                <details className="mt-2 rounded-xl bg-surface-2">
                  <summary className="px-3 py-2 text-sm text-muted">
                    {warmup.name}
                    {warmup.minutes ? ` · ${warmup.minutes} min` : ""}
                  </summary>
                  <ul className="list-disc space-y-0.5 px-8 pb-3 text-sm">
                    {warmup.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <ol className="divide-y divide-line">
                {part.items.map((item, i) => (
                  <ExerciseRow
                    key={`${item.exerciseId}-${i}`}
                    item={item}
                    exercise={byId.get(item.exerciseId)}
                    index={i}
                    library={editable ? exercises : undefined}
                  />
                ))}
              </ol>
              {editable && part.id ? <AddExercise partId={part.id} exercises={exercises} /> : null}
              {editable && part.id ? <PartControls key={part.name} partId={part.id} name={part.name} /> : null}
            </div>
          </details>
        );
      })}
      {editable ? <AddPart templateId={template.id} /> : null}
    </div>
  );
}

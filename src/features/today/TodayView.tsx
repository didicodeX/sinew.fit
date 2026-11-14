"use client";

import { useState, useSyncExternalStore } from "react";
import {
  addDays,
  startOfWeek,
  templateForDate,
  todayIn,
  TRAINING_RULES,
  WEEKDAY_NAMES,
  weekdayOf,
  type ExerciseDef,
  type ProgramDef,
  type SessionTemplate,
} from "@domain/index";
import { TemplateParts } from "@features/program/TemplateParts";
import { StartSession } from "./StartSession";
import { cn } from "@shared/utils";

const noopSubscribe = () => () => {};

/**
 * Today screen + week strip (replaces the notebook's "prepare the week" step).
 * The program comes from the user's account; the date logic runs in the browser.
 */
export function TodayView({
  program,
  templates,
  exercises,
}: {
  program: ProgramDef;
  templates: SessionTemplate[];
  exercises: ExerciseDef[];
}) {
  // The local calendar date is only known in the browser (null during prerender)
  const today = useSyncExternalStore(
    noopSubscribe,
    () => todayIn(),
    () => null,
  );
  const [picked, setSelected] = useState<string | null>(null);
  const selected = picked ?? today;

  if (!today || !selected) return <div className="h-40" aria-busy />;

  const monday = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const template = templateForDate(selected, program, templates);
  const dayName = WEEKDAY_NAMES[weekdayOf(selected)];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">{selected === today ? "Today" : dayName}</p>
        <h1 className="text-3xl font-bold tracking-tight">{template ? template.name : "Rest day"}</h1>
      </header>

      <ol className="grid grid-cols-7 gap-1" aria-label="This week">
        {week.map((d) => {
          const t = templateForDate(d, program, templates);
          const short = t ? t.name.split(" → ")[0] : "Rest";
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => setSelected(d)}
                aria-pressed={d === selected}
                className={cn(
                  "flex h-16 w-full flex-col items-center justify-center rounded-xl border text-xs",
                  d === selected ? "border-accent bg-surface-2" : "border-line bg-surface",
                  d === today && "font-bold",
                )}
              >
                <span className="text-muted">{WEEKDAY_NAMES[weekdayOf(d)].slice(0, 3)}</span>
                <span className="tabular">{short}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {template && selected === today ? (
        <StartSession date={today} template={template} exercises={exercises} />
      ) : null}

      {template ? (
        <TemplateParts template={template} exercises={exercises} />
      ) : (
        <p className="rounded-2xl border border-line bg-surface p-4 text-muted">
          Full rest. Handstand GTG is optional.
        </p>
      )}

      <details className="rounded-2xl border border-line bg-surface">
        <summary className="px-4 py-3 font-semibold">Rules</summary>
        <ul className="list-disc space-y-1 border-t border-line px-8 py-3 text-sm">
          {TRAINING_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

"use client";

import { useState } from "react";
import { looseName, type ExerciseDef } from "@domain/index";

/** Type-to-filter list of the library (retired exercises are left out). */
export function ExercisePicker({ exercises, onPick, disabled }: {
  exercises: ExerciseDef[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const f = looseName(q);
  const list = exercises
    .filter((e) => !e.archived && (!f || [e.name, ...(e.aliases ?? [])].some((n) => looseName(n).includes(f))))
    .slice(0, 8);
  return (
    <div className="space-y-2">
      <input
        className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        placeholder="Search exercises"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="space-y-1">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(e.id)}
              className="h-11 w-full rounded-xl border border-line px-3 text-left"
            >
              {e.name}
            </button>
          </li>
        ))}
        {list.length === 0 ? <li className="text-sm text-muted">No match.</li> : null}
      </ul>
    </div>
  );
}

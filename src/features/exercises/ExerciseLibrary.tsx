"use client";

import { useState, useTransition } from "react";
import { looseName, type ExerciseDef } from "@domain/index";
import {
  createExercise,
  setExerciseArchived,
  updateExercise,
  type ExerciseInput,
} from "@/server/exercises/actions";

const EMPTY: ExerciseInput = {
  name: "",
  kind: "reps",
  perSide: false,
  allowsWeight: false,
  allowsAssistance: false,
  aliases: [],
  notes: "",
};

const toInput = (e: ExerciseDef): ExerciseInput => ({
  name: e.name,
  kind: e.kind,
  perSide: e.perSide,
  allowsWeight: e.allowsWeight,
  allowsAssistance: e.allowsAssistance ?? false,
  aliases: e.aliases ?? [],
  notes: e.notes ?? "",
});

function Editor({ initial, onSave, onCancel }: {
  initial: ExerciseInput;
  onSave: (v: ExerciseInput) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [aliases, setAliases] = useState(initial.aliases.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const flag = (k: "perSide" | "allowsWeight" | "allowsAssistance", label: string) => (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} />
      {label}
    </label>
  );
  return (
    <form
      className="space-y-3 rounded-2xl border border-accent bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const list = aliases.split(",").map((a) => a.trim()).filter(Boolean);
          setError(await onSave({ ...v, aliases: list }));
        });
      }}
    >
      <input
        className="h-12 w-full rounded-xl border border-line bg-bg px-3"
        placeholder="Name"
        value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })}
        required
      />
      <select
        className="h-12 w-full rounded-xl border border-line bg-bg px-3"
        value={v.kind}
        onChange={(e) => setV({ ...v, kind: e.target.value as "reps" | "hold" })}
      >
        <option value="reps">Reps</option>
        <option value="hold">Hold (seconds)</option>
      </select>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {flag("perSide", "Per side")}
        {flag("allowsWeight", "Weighted")}
        {flag("allowsAssistance", "Assisted")}
      </div>
      <input
        className="h-12 w-full rounded-xl border border-line bg-bg px-3"
        placeholder="Aliases, comma separated"
        value={aliases}
        onChange={(e) => setAliases(e.target.value)}
      />
      <textarea
        className="w-full rounded-xl border border-line bg-bg p-3"
        placeholder="Notes"
        rows={2}
        value={v.notes}
        onChange={(e) => setV({ ...v, notes: e.target.value })}
      />
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-12 flex-1 rounded-xl bg-accent font-semibold text-bg">
          Save
        </button>
        <button type="button" onClick={onCancel} className="h-12 rounded-xl border border-line px-4">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function ExerciseLibrary({ exercises }: { exercises: ExerciseDef[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, start] = useTransition();

  const q = looseName(query);
  const shown = exercises.filter(
    (e) => !q || [e.name, ...(e.aliases ?? [])].some((n) => looseName(n).includes(q)),
  );
  const active = shown.filter((e) => !e.archived);
  const archived = shown.filter((e) => e.archived);

  const row = (e: ExerciseDef) =>
    editing === e.id ? (
      <li key={e.id}>
        <Editor
          initial={toInput(e)}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            const r = await updateExercise(e.id, v);
            if (r.ok) setEditing(null);
            return r.ok ? null : r.error;
          }}
        />
      </li>
    ) : (
      <li key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(e.id)}>
          <span className="block truncate font-semibold">{e.name}</span>
          <span className="block text-sm text-muted">
            {e.kind === "hold" ? "Hold" : "Reps"}
            {e.perSide ? " · per side" : ""}
            {e.allowsWeight ? " · weighted" : ""}
            {e.allowsAssistance ? " · assisted" : ""}
          </span>
        </button>
        <button
          type="button"
          className="text-sm text-muted"
          onClick={() => start(async () => void (await setExerciseArchived(e.id, !e.archived)))}
        >
          {e.archived ? "Restore" : "Retire"}
        </button>
      </li>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Exercises</h1>
        <button type="button" onClick={() => setEditing("new")} className="h-10 rounded-xl bg-accent px-4 font-semibold text-bg">
          Add
        </button>
      </header>
      {editing === "new" ? (
        <Editor
          initial={EMPTY}
          onCancel={() => setEditing(null)}
          onSave={async (v) => {
            const r = await createExercise(v);
            if (r.ok) setEditing(null);
            return r.ok ? null : r.error;
          }}
        />
      ) : null}
      <input
        className="h-12 w-full rounded-xl border border-line bg-surface px-3"
        placeholder="Search name or alias"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="space-y-2">{active.map(row)}</ul>
      {archived.length ? (
        <details>
          <summary className="py-2 text-muted">Retired ({archived.length})</summary>
          <ul className="space-y-2">{archived.map(row)}</ul>
        </details>
      ) : null}
    </div>
  );
}

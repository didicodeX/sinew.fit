"use client";

import { useState, useTransition } from "react";
import type { SessionTemplate } from "@domain/index";
import {
  assignDay,
  createTemplateForDay,
  deleteTemplate,
  renameTemplate,
  type EditResult,
} from "@/server/program/edit-program";

const btn = "h-11 rounded-xl border border-line px-3 text-sm";

/** Which template a weekday uses, plus create / rename / delete of templates. */
export function DayControls({ weekday, current, templates }: {
  weekday: number;
  current: SessionTemplate | undefined;
  templates: SessionTemplate[];
}) {
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState(current?.name ?? "");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<EditResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.error);
      if (r.ok) after?.();
    });

  return (
    <div className="mb-3 space-y-2 rounded-xl bg-surface-2 p-3">
      <select
        className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        value={current?.id ?? ""}
        disabled={pending}
        onChange={(e) => run(() => assignDay(weekday, e.target.value || null))}
      >
        <option value="">Full rest</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <input className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm" placeholder="New template name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="button" disabled={pending || !newName.trim()} className={btn} onClick={() => run(() => createTemplateForDay(weekday, newName), () => setNewName(""))}>
          Create
        </button>
      </div>
      {current ? (
        <>
          <div className="flex gap-2">
            <input className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm" value={rename} onChange={(e) => setRename(e.target.value)} />
            <button type="button" disabled={pending || rename.trim() === current.name} className={btn} onClick={() => run(() => renameTemplate(current.id, rename))}>
              Rename
            </button>
          </div>
          <button
            type="button"
            disabled={pending}
            className={`${btn} text-red-500`}
            onClick={() => (confirm ? run(() => deleteTemplate(current.id), () => setConfirm(false)) : setConfirm(true))}
          >
            {confirm ? "Confirm delete template (days using it become rest)" : "Delete template"}
          </button>
        </>
      ) : null}
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

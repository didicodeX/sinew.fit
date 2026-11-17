"use client";

import { useState, useTransition } from "react";
import { addPart, movePart, removePart, renamePart, type EditResult } from "@/server/program/edit-program";

const btn = "h-11 rounded-xl border border-line px-3 text-sm";

/** Rename, reorder and remove one part of a template. */
export function PartControls({ partId, name }: { partId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<EditResult>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : r.error);
    });
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <div className="flex gap-2">
        <input className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="button" disabled={pending || value.trim() === name} className={btn} onClick={() => run(() => renamePart(partId, value))}>
          Rename
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => movePart(partId, "up"))}>Part ↑</button>
        <button type="button" disabled={pending} className={btn} onClick={() => run(() => movePart(partId, "down"))}>Part ↓</button>
        <button
          type="button"
          disabled={pending}
          className={`${btn} ml-auto text-red-500`}
          onClick={() => (confirm ? run(() => removePart(partId)) : setConfirm(true))}
        >
          {confirm ? "Confirm remove part" : "Remove part"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

export function AddPart({ templateId }: { templateId: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [kind, setKind] = useState("other");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="text-sm text-accent" onClick={() => setOpen(true)}>
        + Add part
      </button>
    );
  return (
    <div className="space-y-2 rounded-xl bg-surface-2 p-3">
      <input className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm" placeholder="Part name (e.g. Pull)" value={value} onChange={(e) => setValue(e.target.value)} />
      <select className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
        {["pull", "push", "legs", "core", "other"].map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-accent font-semibold text-bg"
          onClick={() =>
            start(async () => {
              const r = await addPart(templateId, value, kind);
              if (r.ok) { setOpen(false); setValue(""); } else setError(r.error);
            })
          }
        >
          Add
        </button>
        <button type="button" className={btn} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pullSessions } from "@lib/local/sync";
import { undoBatch, type BatchRow } from "@/server/import/actions";

/** Import history: what each file added, with undo. */
export function BatchList({ batches }: { batches: BatchRow[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (batches.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="pt-2 text-lg font-semibold">Import history</h2>
      {error ? <p className="text-sm text-amber-500">{error}</p> : null}
      <ul className="space-y-2">
        {batches.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{b.sourceName ?? "Import"}</p>
              <p className="tabular text-sm text-muted">
                {b.createdAt.slice(0, 10)} · {b.sessions} sessions · {b.sets} sets
                {b.replaced ? ` · ${b.replaced} replaced` : ""}
                {b.status === "undone" ? " · undone" : b.status === "draft" ? " · unfinished" : ""}
              </p>
            </div>
            {b.status !== "undone" ? (
              <button
                type="button"
                disabled={pending}
                className="h-11 shrink-0 rounded-xl border border-line px-3 text-sm text-red-500"
                onClick={() => {
                  if (confirm !== b.id) return setConfirm(b.id);
                  start(async () => {
                    const r = await undoBatch(b.id);
                    await pullSessions({ full: true });
                    if (!r.ok) setError(r.error ?? "Could not undo.");
                    setConfirm(null);
                    router.refresh();
                  });
                }}
              >
                {confirm === b.id ? "Confirm undo" : "Undo"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { generateSession, type ExerciseDef, type IsoDate, type SessionTemplate } from "@domain/index";
import { putSession, sessionForDate, type LocalSession } from "@lib/local/db";
import { sessionProgress } from "@domain/session-state";

/**
 * Full page load on purpose: client routing would fetch an RSC payload, which fails offline,
 * while a navigation is answered by the service worker's cached /session page.
 */
const openSession = (id: string) =>
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- offline navigation, see above
  window.location.assign(`/session?id=${encodeURIComponent(id)}`);

export function StartSession({
  date,
  template,
  exercises,
}: {
  date: IsoDate;
  template: SessionTemplate;
  exercises: ExerciseDef[];
}) {
  const [existing, setExisting] = useState<LocalSession | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void sessionForDate(date).then((s) => {
      if (!cancelled) setExisting(s ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  async function start() {
    const used = new Set(template.parts.flatMap((p) => p.items.flatMap((i) => [i.exerciseId, ...(i.altExerciseIds ?? [])])));
    const session = generateSession(template, exercises, {
      date,
      sessionId: crypto.randomUUID(),
      newId: () => crypto.randomUUID(),
    });
    await putSession(session, exercises.filter((e) => used.has(e.id)));
    openSession(session.id);
  }

  if (existing === undefined) return <div className="h-16" aria-busy />;

  if (existing) {
    const p = sessionProgress(existing);
    return (
      <button
        type="button"
        onClick={() => openSession(existing.id)}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl border border-accent text-lg font-semibold text-accent"
      >
        {existing.endedAt ? "Done ✓ · View session" : "Resume session"}
        <span className="tabular text-sm font-normal text-muted">
          {p.done}/{p.total} sets
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      className="h-16 w-full rounded-2xl bg-accent text-xl font-bold text-accent-fg"
    >
      Start session
    </button>
  );
}

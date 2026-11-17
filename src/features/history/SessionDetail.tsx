"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WEEKDAY_NAMES, weekdayOf, type LoggedSet } from "@domain/index";
import { useRouter } from "next/navigation";
import { getSession, saveLocalSession, type LocalSession } from "@lib/local/db";
import { pushNow } from "@lib/local/sync";

function setLabel(s: LoggedSet): string {
  const v = `${s.value}${s.unit === "sec" ? "s" : ""}${s.side ? ` ${s.side}` : ""}`;
  const extra = [
    s.weightKg ? `+${s.weightKg} kg` : null,
    s.assistance ? `${s.assistance.label ?? s.assistance.type}` : null,
    s.rir !== undefined ? `RIR ${s.rir}` : null,
  ].filter(Boolean);
  return extra.length ? `${v} (${extra.join(", ")})` : v;
}

export function SessionDetail({ id }: { id: string }) {
  const router = useRouter();
  const [session, setSession] = useState<LocalSession | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    void getSession(id).then((s) => setSession(s ?? null));
  }, [id]);

  if (session === undefined) return <div className="h-40" aria-busy />;
  if (session === null) return <p className="py-10 text-center text-muted">Session not found on this device.</p>;

  const names = new Map(session.exerciseDefs.map((d) => [d.id, d.name]));
  return (
    <div className="space-y-4">
      <Link href="/history" className="text-sm text-accent">
        ← History
      </Link>
      <header>
        <p className="text-sm text-muted">
          {WEEKDAY_NAMES[weekdayOf(session.date)]} · <span className="tabular">{session.date}</span>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{session.title ?? "Session"}</h1>
      </header>
      <ul className="space-y-2">
        {session.entries.map((e) => {
          const done = e.sets.filter((x) => x.done);
          if (done.length === 0) return null;
          return (
            <li key={e.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="font-semibold">{names.get(e.exerciseId) ?? "Exercise"}</p>
              <p className="tabular text-sm">{done.map(setLabel).join(" · ")}</p>
              {e.notes ? <p className="mt-1 text-sm text-muted">{e.notes}</p> : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="h-11 rounded-xl border border-line px-4 text-sm text-red-500"
        onClick={async () => {
          if (!confirm) return setConfirm(true);
          const now = Date.now();
          await saveLocalSession({ ...session, deletedAt: now, updatedAt: now, dirty: 1 });
          void pushNow();
          router.push("/history");
        }}
      >
        {confirm ? "Confirm delete session" : "Delete session"}
      </button>
      {session.sessionNotes ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-sm">{session.sessionNotes}</p>
      ) : null}
    </div>
  );
}
